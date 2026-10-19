/*
 * Sarvman TradeToolkit — waitlist landing page
 * Single source of truth for the capture endpoint and experiment thresholds.
 * Changing CAPTURE_ENDPOINT is the only edit needed to move capture between
 * providers (e.g. first-party form endpoint once the platform lands).
 */
window.SARVMAN_CONFIG = {
  // Capture endpoint. Format: https://formsubmit.co/ajax/<form-id>
  // The form id is the activated handle for this site's endpoint; it is not the
  // inbox address. Every submission is delivered as an email to the company
  // mail catch, which is where the lead list lives until the A8 platform store
  // is ready. Changing this value is the only edit needed to move capture to a
  // first-party endpoint later.
  CAPTURE_ENDPOINT: "https://formsubmit.co/ajax/a75a3e890dd0d599cf4ea72f8ee32e40",

  // Hidden fields stamped on every event so a submission can be traced back
  // to the campaign that produced it.
  SOURCE_FIELDS: ["src", "utm_source", "utm_medium", "utm_campaign", "utm_content"],

  // Minimum minutes between two "view" events from the same visitor id.
  // Keeps the signup-rate denominator honest (one visit per visitor per window).
  VIEW_DEDUPE_MINUTES: 30,

  // The demand gate's pass/fail thresholds are the CEO's, pre-registered in the
  // P1 D+5 demand gate protocol (SAR-21, document `gate-protocol`). They are not
  // duplicated here on purpose: this page measures, it does not decide.
};
