/*
 * Sarvman TradeToolkit — waitlist landing page
 * Single source of truth for the capture endpoint and event contract.
 * Changing CAPTURE_ENDPOINT is the only edit needed to move capture between
 * providers (e.g. first-party form endpoint once the platform lands).
 */
window.SARVMAN_CONFIG = {
  // Capture endpoint. Format: https://formsubmit.co/ajax/<form-id>
  // The form id is the activated handle for this site's endpoint; it is not the
  // inbox address, so the page does not publish the mailbox. Every submission
  // is delivered as an email to the company mail catch, which is where the
  // lead list lives until the A8 platform store is ready. Changing this value
  // is the only edit needed to move capture to a first-party endpoint later.
  //
  // The relay activates per page origin, not per form: a submission from an
  // origin it has not seen is refused with "This form needs Activation" and
  // dropped. The published origin below is activated (verified 2026-10-20).
  // A new origin — a preview deploy, the company domain — needs its own
  // one-click activation before it can accept anything.
  CAPTURE_ENDPOINT: "https://formsubmit.co/ajax/a75a3e890dd0d599cf4ea72f8ee32e40",

  // Product this page belongs to. Stamped on every event per the SAR-94
  // finance data contract so the weekly digest can report per product.
  // P1 TradeToolkit = "p1-tradetoolkit" (SAR-30); P2/P3 pages use their own id.
  PRODUCT_ID: "p1-tradetoolkit",

  // Hidden fields stamped on every event so a submission can be traced back
  // to the campaign that produced it.
  SOURCE_FIELDS: ["src", "utm_source", "utm_medium", "utm_campaign", "utm_content"],

  // Which capture surface this page is. SAR-66 event contract: every email-
  // capture submit fires one analytics event carrying page_path and
  // capture_surface, one of "result_block" | "spec_sheet_end" | "landing_page".
  // Tool and spec-sheet pages built under B6 set this to their surface.
  CAPTURE_SURFACE: "landing_page",

  // Measurement standard this page is instrumented against: SAR-13 (A7)
  // definition v1.1.0. Stamped on every event so a number computed from these
  // events carries the definition it was computed with.
  MEASUREMENT_DEFINITION_VERSION: "1.1.0",

  // A7 event names (SAR-13, constants.ts EVENT_TYPES). The page sends both
  // names on every event: "event" is this page's readable label and "e" is the
  // A7 event type, so the same payload can be replayed into the A8 collector
  // when it lands without touching this page.
  A7_EVENT_NAME: {
    view: "pageview",
    signup: "email_capture"
  },

  // Minimum minutes between two "view" events from the same visitor id.
  // Keeps the signup-rate denominator honest (one visit per visitor per window).
  VIEW_DEDUPE_MINUTES: 30,

  // The demand gate's pass/fail thresholds are the CEO's, pre-registered in the
  // P1 D+5 demand gate protocol (SAR-21, document `gate-protocol`). They are not
  // duplicated here on purpose: this page measures, it does not decide.
};
