/*
 * TradeToolkit waitlist — first-party event capture.
 *
 * Three events are recorded, all as form posts to the capture endpoint:
 *   "view"    — a unique visit to the page (deduped per visitor per window)
 *   "signup"  — a completed waitlist signup
 *   "question" — an optional question for the support desk
 *
 * A question is its own event type on purpose. It carries the address and the
 * text, it lands in its own file, and it never enters the signup tally or the
 * view log, so a question can never be counted as a signup and can never move
 * the demand-gate numbers.
 *
 * The view and the signup carry a stable visitor id, so the signup rate can be
 * computed as signups / unique views without a third-party analytics tracker.
 * Every event also carries product, page_path and capture_surface per the
 * event contract ("landing_page" here; "result_block" / "spec_sheet_end" on
 * the tool pages) and the finance data contract (product id per product).
 *
 * Every event also carries the measurement payload (definition v1.1.0): the
 * referrer is classified by the standard's own rules at count time, and the
 * same payload can be replayed into the platform collector when it lands.
 * The question event is the exception: it is a support message rather than a
 * measurement event, so it carries no measurement envelope and can never be
 * read as one.
 *
 * Events are queued in localStorage and flushed to the endpoint, so a
 * signup that happens while the endpoint is unreachable is not lost.
 */
(function () {
  "use strict";

  var CFG = window.WAITLIST_CONFIG || {};
  var ENDPOINT = (CFG.CAPTURE_ENDPOINT || "").trim();
  var TOKEN = (CFG.CAPTURE_TOKEN || "").trim();
  var QUEUE_KEY = "st_event_queue";
  var VID_KEY = "st_visitor_id";
  var LAST_VIEW_KEY = "st_last_view_ts";

  /* ── helpers ──────────────────────────────────────────── */

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    // Fallback shaped like a UUIDv4 so it still matches the measurement
    // standard's visitor-id pattern when the crypto API is absent.
    var b = new Uint8Array(16);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(b);
    else for (var i = 0; i < 16; i += 1) b[i] = Math.floor(Math.random() * 256);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var hex = [];
    for (var j = 0; j < 16; j += 1) hex.push(b[j].toString(16).padStart(2, "0"));
    return hex.slice(0, 4).join("") + "-" + hex.slice(4, 6).join("") + "-" +
      hex.slice(6, 8).join("") + "-" + hex.slice(8, 10).join("") + "-" +
      hex.slice(10, 16).join("");
  }

  function visitorId() {
    try {
      var v = localStorage.getItem(VID_KEY);
      if (!v) { v = uuid(); localStorage.setItem(VID_KEY, v); }
      return v;
    } catch (e) {
      return uuid();
    }
  }

  function readQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); }
    catch (e) { return []; }
  }

  function writeQueue(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch (e) { /* full or blocked */ }
  }

  function enqueue(evt) {
    var q = readQueue();
    q.push(evt);
    // Only signups and questions are queued (see recordView), and the bound
    // stops a long outage from filling the browser's storage.
    var max = CFG.MAX_QUEUED_SIGNUPS || 20;
    while (q.length > max) q.shift();
    writeQueue(q);
  }

  function campaignFields() {
    var out = {};
    var params = new URLSearchParams(location.search);
    var keys = CFG.SOURCE_FIELDS || ["src"];
    keys.forEach(function (k) {
      var v = params.get(k);
      if (v) out[k] = v;
    });
    out.page_path = location.pathname;
    out.referrer = document.referrer || "";
    out.product = CFG.PRODUCT_ID || "p1-tradetoolkit";
    return out;
  }

  /* ── measurement fields (definition v1.1.0) ──
   *
   * Every event carries the standard payload next to this page's readable fields:
   *   v  payload version              e  event type
   *   pa page path                    r  referrer
   *   t  client timestamp (epoch ms)  c  analytics consent state
   *   o  event properties
   *
   * The referrer travels as a URL and is classified by the standard's own
   * rules at count time (search vs direct vs own property vs other), so the
   * classification lives in one implementation instead of two.
   */

  function measurementFields(kind) {
    var params = new URLSearchParams(location.search);
    var referrer = document.referrer || "";
    var source = params.get("src") || params.get("utm_source") || "";
    if (!source && referrer) {
      try { source = new URL(referrer).hostname; } catch (e) { source = ""; }
    }
    if (!source) source = "direct";
    return {
      v: 1,
      e: (CFG.EVENT_NAME && CFG.EVENT_NAME[kind]) || kind,
      pa: location.pathname,
      r: referrer,
      t: Date.now(),
      // P1 is a professional audience and the measurement standard sets its
      // consent mode to "not-required" for that audience, so this page sets no
      // analytics consent state. The marketing consent the visitor ticks is
      // carried in its own field and is not the same thing.
      c: "unknown",
      o: { source: source }
    };
  }

  /* ── transport ────────────────────────────────────────── */

  function toFormBody(evt) {
    var body = new URLSearchParams();
    Object.keys(evt).forEach(function (k) {
      var v = evt[k];
      if (v === null || v === undefined || v === "") return;
      if (Array.isArray(v)) v = v.join(", ");
      // The A7 props field is an object, but the relay takes a form body, so
      // a nested object has to be encoded as text or it is flattened to
      // "[object Object]" and the properties are lost. It is encoded as JSON
      // and decoded when the event is read back, so the props survive the
      // round trip and can be replayed into the collector unchanged.
      if (typeof v === "object") v = JSON.stringify(v);
      body.append(k, v);
    });
    return body;
  }

  function post(evt) {
    if (!ENDPOINT) return Promise.resolve({ queued: true, reason: "no-endpoint" });
    return fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json",
        // The write path's shared secret. The capture service refuses a
        // write that does not carry it, so the endpoint is not a public form
        // anyone can post to.
        "X-Waitlist-Token": TOKEN
      },
      body: toFormBody(evt)
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
    }).then(function (text) {
      // The relay answers HTTP 200 with {"success":"false","message":"..."} when
      // it refuses a submission. A 200 alone is not acceptance, so a refusal
      // must not read as a signup.
      //
      // "success" arrives as a string ("true" / "false"), so it is normalised
      // before it is read: comparing it to the boolean false would let every
      // refusal through as a success.
      var parsed = null;
      try { parsed = JSON.parse(text); } catch (e) { parsed = null; }
      if (parsed && typeof parsed === "object") {
        var accepted = true;
        if (parsed.success !== undefined && parsed.success !== null) {
          accepted = String(parsed.success).trim().toLowerCase() === "true";
        }
        if (parsed.error) accepted = false;
        if (!accepted) {
          var err = new Error(parsed.message || "capture refused the submission");
          err.refused = true;
          throw err;
        }
      }
      return text;
    });
  }

  function flush() {
    if (!ENDPOINT) return;
    var q = readQueue();
    if (!q.length) return;
    var remaining = [];
    var chain = Promise.resolve();
    q.forEach(function (evt) {
      chain = chain.then(function () {
        return post(evt).catch(function () { remaining.push(evt); });
      });
    });
    chain.then(function () { writeQueue(remaining); });
  }

  /* ── events ───────────────────────────────────────────── */

  /* ── bot handling ──────────────────────────────────────── */

  // The measurement standard excludes bots by User-Agent at ingest. The
  // capture service is the ingest point now and checks the User-Agent too;
  // this check keeps the request off the wire in the first place.
  function isBot() {
    var ua = (navigator.userAgent || "").toLowerCase();
    if (navigator.webdriver) return true;
    return /(bot\b|crawler|crawl|spider|slurp|mediapartners|baidu|yandex|semrush|ahrefs|dataminr|headless|phantomjs|facebookexternalhit|bingpreview)/.test(ua);
  }

  function recordView() {
    if (isBot()) return;
    var now = Date.now();
    var windowMs = (CFG.VIEW_DEDUPE_MINUTES || 1440) * 60000;
    try {
      var last = parseInt(localStorage.getItem(LAST_VIEW_KEY) || "0", 10);
      if (last && now - last < windowMs) return;   // already counted this visit
      localStorage.setItem(LAST_VIEW_KEY, String(now));
    } catch (e) { /* proceed */ }

    var evt = Object.assign({
      event: "view",
      event_version: "1",
      definition_version: CFG.MEASUREMENT_DEFINITION_VERSION || "1.1.0",
      capture_surface: CFG.CAPTURE_SURFACE || "landing_page",
      ts: new Date().toISOString(),
      visitor_id: visitorId(),
      page_title: document.title,
      // Subject line in the catch inbox, so the daily tally can tell a page
      // view from a signup without opening each message.
      _subject: "P1 waitlist - page view"
    }, measurementFields("view"), campaignFields());

    // A view is best-effort: it is sent once and not queued. A queue of failed
    // views would be retried on every later visit. A signup is never dropped:
    // it is kept on the visitor's device and retried.
    post(evt).catch(function () { /* lost, and that is the trade */ });
  }

  function recordSignup(form) {
    var sizing = Array.prototype.slice
      .call(form.querySelectorAll('input[name="sizing"]:checked'))
      .map(function (i) { return i.value; });

    var evt = Object.assign({
      event: "signup",
      event_version: "1",
      definition_version: CFG.MEASUREMENT_DEFINITION_VERSION || "1.1.0",
      capture_surface: CFG.CAPTURE_SURFACE || "landing_page",
      ts: new Date().toISOString(),
      visitor_id: visitorId(),
      email: (form.email.value || "").trim(),
      company: (form.company.value || "").trim(),
      segment: form.segment.value,
      sizing: sizing,
      consent: form.consent.checked ? "yes" : "no",
      _subject: "P1 waitlist - signup"
    }, measurementFields("signup"), campaignFields());

    enqueue(evt);
    return post(evt);
  }

  function recordQuestion(email, company, question) {
    // A support-desk question. It is deliberately not a measurement event:
    // it carries no measurement envelope, so nothing downstream can read it
    // as a page view or an email capture, and it lands in its own file.
    var max = CFG.MAX_QUESTION_CHARS || 2000;
    var evt = Object.assign({
      event: "question",
      event_version: "1",
      capture_surface: CFG.CAPTURE_SURFACE || "landing_page",
      ts: new Date().toISOString(),
      visitor_id: visitorId(),
      email: email,
      company: company,
      question: question.slice(0, max),
      page_title: document.title,
      // Subject line, so the desk can tell a question from a signup in the
      // queue without opening each row.
      _subject: "P1 waitlist - question"
    }, campaignFields());

    enqueue(evt);
    return post(evt);
  }

  /* ── form wiring ──────────────────────────────────────── */

  function wireForm() {
    var form = document.getElementById("waitlist-form");
    if (!form) return;
    var btn = document.getElementById("submit-btn");
    var status = document.getElementById("form-status");

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      status.className = "form-status";
      status.textContent = "";

      if (!form.email.value.trim() || !/.+@.+\..+/.test(form.email.value)) {
        status.className = "form-status err";
        status.textContent = "Please enter a valid email address.";
        form.email.focus();
        return;
      }
      // A question stands on its own: an address and the text, no signup and
      // no marketing tick. The tick is for the launch email, and the launch
      // email is the only thing it is for. Somebody who wants their details
      // deleted, or who wants us to stop emailing them, must not have to opt
      // in to a marketing email to ask.
      var question = (form.question ? form.question.value : "").trim();
      var wantsSignup = form.consent.checked;
      if (!wantsSignup && !question) {
        status.className = "form-status err";
        status.textContent = "Please tick the box so we can email you, or write us a question.";
        form.consent.focus();
        return;
      }
      // Honeypot: a filled hidden field means an automated submitter. Do not
      // send it, and do not tell it the form worked.
      if (form.website && form.website.value.trim()) {
        if (window.console) console.warn("signup rejected by honeypot");
        status.className = "form-status err";
        status.textContent = "That didn't save. Please try again in a moment.";
        btn.disabled = false;
        return;
      }

      btn.disabled = true;
      status.textContent = "Sending…";

      // Read the address and the company before the form is reset: they are
      // needed to send the question as its own event.
      var emailAddress = (form.email.value || "").trim();
      var companyName = (form.company.value || "").trim();

      // No endpoint configured (pre-publish): never fake a success. Keep the
      // signup queued on-device and tell the visitor plainly what to do.
      if (!ENDPOINT) {
        if (wantsSignup) recordSignup(form).catch(function () {});
        if (question) {
          recordQuestion(emailAddress, companyName, question).catch(function () {});
        }
        status.className = "form-status err";
        status.textContent = "The signup list isn't live yet — please check back soon.";
        btn.disabled = false;
        return;
      }

      // The question is sent as its own event, in parallel with the signup and
      // never as part of it. Two reasons: a question is never counted as a
      // signup, and a failure to save the signup cannot lose the question.
      // Each is queued on the visitor's device on its own, so each retries on
      // its own.
      // A signup only happens when the tick is on. Without the tick there is
      // no signup: the visitor asked a question, and a question is not a
      // signup and is never counted as one.
      var signupResult = wantsSignup
        ? recordSignup(form).then(
            function () { return { ok: true }; },
            function (err) { return { ok: false, err: err }; }
          )
        : Promise.resolve({ ok: true, skipped: true });
      var questionResult = question
        ? recordQuestion(emailAddress, companyName, question).then(
            function () { return { ok: true }; },
            function (err) { return { ok: false, err: err }; }
          )
        : Promise.resolve({ ok: true });

      Promise.all([signupResult, questionResult]).then(function (results) {
        var signup = results[0];
        var asked = results[1];
        btn.disabled = false;

        if (!signup.ok) {
          // The signup stays queued on-device and retries on the next visit
          // (flush on boot + on 'online'). Tell the visitor.
          status.className = "form-status err";
          status.textContent = question && asked.ok
            ? "Your question was sent, but your signup didn't save. Please try again in a moment."
            : "That didn't save. Please try again in a moment.";
          if (window.console) console.error("signup post failed", signup.err);
          return;
        }

        form.reset();
        status.className = "form-status ok";
        if (!wantsSignup) {
          // A question on its own. The visitor is not on the list, and is
          // not told that they are.
          if (asked.ok) {
            status.textContent = "Your question was sent to the support desk. We reply by email within 1 business day.";
          } else {
            status.className = "form-status err";
            status.textContent = "Your question didn't send. It is saved on this device and will retry.";
          }
          return;
        }
        status.textContent = "You're on the list. We'll email you when the calculators go live.";
        if (!question) return;
        if (asked.ok) {
          status.textContent = "You're on the list — we'll email you when the calculators go live. Your question has been sent to the support desk.";
        } else {
          status.className = "form-status err";
          status.textContent = "You're on the list, but your question didn't send. It is saved on this device and will retry.";
        }
      });
    });
  }

  /* ── boot ─────────────────────────────────────────────── */

  function boot() {
    recordView();
    wireForm();
    flush();
    window.addEventListener("online", flush);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
