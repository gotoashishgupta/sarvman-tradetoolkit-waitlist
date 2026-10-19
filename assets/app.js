/*
 * TradeToolkit waitlist — first-party event capture.
 *
 * Two events are recorded, both as form posts to the capture endpoint:
 *   "view"   — a unique visit to the page (deduped per visitor per window)
 *   "signup" — a completed waitlist signup
 *
 * Both carry a stable visitor id, so the signup rate can be computed as
 * signups / unique views without a third-party analytics tracker.
 * Events are queued in localStorage and flushed to the endpoint, so a
 * signup that happens while the endpoint is unreachable is not lost.
 */
(function () {
  "use strict";

  var CFG = window.SARVMAN_CONFIG || {};
  var ENDPOINT = (CFG.CAPTURE_ENDPOINT || "").trim();
  var QUEUE_KEY = "st_event_queue";
  var VID_KEY = "st_visitor_id";
  var LAST_VIEW_KEY = "st_last_view_ts";

  /* ── helpers ──────────────────────────────────────────── */

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "v-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  }

  function visitorId() {
    try {
      var v = localStorage.getItem(VID_KEY);
      if (!v) { v = uuid(); localStorage.setItem(VID_KEY, v); }
      return v;
    } catch (e) {
      return "v-volatile";
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
    return out;
  }

  /* ── transport ────────────────────────────────────────── */

  function toFormBody(evt) {
    var body = new URLSearchParams();
    Object.keys(evt).forEach(function (k) {
      var v = evt[k];
      if (v === null || v === undefined || v === "") return;
      if (Array.isArray(v)) v = v.join(", ");
      body.append(k, v);
    });
    return body;
  }

  function post(evt) {
    if (!ENDPOINT) return Promise.resolve({ queued: true, reason: "no-endpoint" });
    return fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json" },
      body: toFormBody(evt)
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.text();
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

  function recordView() {
    var now = Date.now();
    var windowMs = (CFG.VIEW_DEDUPE_MINUTES || 30) * 60000;
    try {
      var last = parseInt(localStorage.getItem(LAST_VIEW_KEY) || "0", 10);
      if (last && now - last < windowMs) return;   // already counted this visit
      localStorage.setItem(LAST_VIEW_KEY, String(now));
    } catch (e) { /* proceed */ }

    var evt = Object.assign({
      event: "view",
      event_version: "1",
      ts: new Date().toISOString(),
      visitor_id: visitorId(),
      page_title: document.title
    }, campaignFields());

    enqueue(evt);
    post(evt).catch(function () { /* stays queued */ });
  }

  function recordSignup(form) {
    var sizing = Array.prototype.slice
      .call(form.querySelectorAll('input[name="sizing"]:checked'))
      .map(function (i) { return i.value; });

    var evt = Object.assign({
      event: "signup",
      event_version: "1",
      ts: new Date().toISOString(),
      visitor_id: visitorId(),
      email: (form.email.value || "").trim(),
      company: (form.company.value || "").trim(),
      role: form.role.value,
      sizing: sizing,
      consent: form.consent.checked ? "yes" : "no"
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
      if (!form.consent.checked) {
        status.className = "form-status err";
        status.textContent = "Please tick the box so we can email you.";
        form.consent.focus();
        return;
      }

      btn.disabled = true;
      status.textContent = "Sending…";

      recordSignup(form).then(function () {
        form.reset();
        status.className = "form-status ok";
        status.textContent = "You're on the list. Check your inbox to confirm — we'll email you when the calculators go live.";
        btn.disabled = false;
      }).catch(function (err) {
        status.className = "form-status err";
        status.textContent = "That didn't send. Please try again, or email us directly.";
        btn.disabled = false;
        if (window.console) console.error("signup post failed", err);
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
