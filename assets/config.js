/*
 * TradeToolkit waitlist — landing page configuration.
 *
 * Single source of truth for the capture endpoint and the event contract.
 * Changing CAPTURE_ENDPOINT is the only edit needed to move capture between
 * providers (e.g. first-party form endpoint once the platform lands).
 */
window.WAITLIST_CONFIG = {
  // Capture endpoint: the site's own capture service, published to the public
  // internet through a zero-account network tunnel. The host name changes when
  // the tunnel is restarted; scripts/waitlist-tunnel.sh rewrites this line and
  // publishes it, so the page always points at the tunnel that is running.
  //
  // The previous endpoint was a free third-party form relay. It refused every
  // submission from this network with HTTP 429 - verified 2026-10-20 on the
  // live form id, on an unused form id, and on both the AJAX and the plain
  // endpoint - so a signup was being dropped at the moment it happened. This
  // endpoint has no quota, no third party in the write path, and no cost.
  CAPTURE_ENDPOINT: "https://api.trycloudflare.com/capture",

  // Shared secret on the write path. The capture service refuses a write
  // that does not carry it, so the endpoint is not a public form anyone
  // can post to.
  //
  // It travels as the X-Waitlist-Token header, not as a form field. A
  // header is what makes a cross-site post fail in the browser: a request
  // with a header is preflighted, and the preflight only passes for the
  // page's own origin.
  //
  // The value is public by design: the page is static, so anything the page
  // can send, a reader of the page source can send too. It raises the bar
  // for a drive-by post and it stops a stranger's browser being used as the
  // writer; it is not a secret against somebody who reads the page. A
  // first-party host with a server-side origin check is the real fix and
  // lands with the host move.
  CAPTURE_TOKEN: "e048f37f56384f9cb58bf719bbf7d1816bd5af5a9b5bce98",

  // Product this page belongs to. Stamped on every event so the weekly digest
  // can report per product.
  PRODUCT_ID: "p1-tradetoolkit",

  // Hidden fields stamped on every event so a submission can be traced back
  // to the campaign that produced it.
  SOURCE_FIELDS: ["src", "utm_source", "utm_medium", "utm_campaign", "utm_content"],

  // Which capture surface this page is: "landing_page" here. Tool and
  // spec-sheet pages set their own surface.
  CAPTURE_SURFACE: "landing_page",

  // The measurement definition this page is instrumented against. Stamped on
  // every event so a number computed from these events carries the definition
  // it was computed with.
  MEASUREMENT_DEFINITION_VERSION: "1.1.0",

  // Event names, so the same payload can be replayed into the platform
  // collector when it lands without touching this page.
  //
  // A support-desk question is deliberately absent: it is a support message,
  // not a measurement event, and it carries no measurement envelope. It is
  // stored in its own file and is never counted as a signup.
  EVENT_NAME: {
    view: "pageview",
    signup: "email_capture"
  },

  // Longest question text kept. The box on the page has the same limit, and
  // the capture service caps it again on arrival.
  MAX_QUESTION_CHARS: 2000,

  // Minimum hours between two "view" events from the same visitor id.
  //
  // One view event per visitor per day. This does not change any number the
  // standard measures: unique visitors are counted from distinct visitor ids,
  // so the daily tally computes "unique visitors today" and "unique visitors
  // over the period" from the same events.
  VIEW_DEDUPE_MINUTES: 1440,

  // Most signups kept on a visitor's device waiting to be sent. A signup that
  // could not be sent is retried on the next visit; the bound stops a long
  // outage from filling the browser's storage.
  MAX_QUEUED_SIGNUPS: 20,

  // The demand gate's pass/fail thresholds are the CEO's, pre-registered in
  // the P1 D+5 demand gate protocol. They are not duplicated here on purpose:
  // this page measures, it does not decide.
};
