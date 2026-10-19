/*
 * Sarvman TradeToolkit — waitlist landing page
 * Single source of truth for the capture endpoint and experiment thresholds.
 * Changing CAPTURE_ENDPOINT is the only edit needed to move capture between
 * providers (e.g. first-party form endpoint once the platform lands).
 */
window.SARVMAN_CONFIG = {
  // Product this page belongs to. Stamped on every event per the SAR-94
  // finance data contract so the weekly digest can report per product.
  // P1 TradeToolkit = "p1-tradetoolkit" (SAR-30); P2/P3 pages use their own id.
  PRODUCT_ID: "p1-tradetoolkit",

  // FormSubmit AJAX endpoint. Format: https://formsubmit.co/ajax/<inbox-address>
  // Every submission is delivered as an email to that inbox, with a JSON response.
  // EMPTY until the CTO supplies the inbox address (SAR-79 blocker): while empty
  // the form queues signups on-device and tells the visitor the list is not
  // live yet instead of faking a success. Set this before publishing.
  CAPTURE_ENDPOINT: "",

  // Public contact shown on the form when capture is unreachable. Same inbox
  // as CAPTURE_ENDPOINT in production; a mailto fallback so no signup is lost.
  CONTACT_EMAIL: "",

  // Hidden fields stamped on every event so a submission can be traced back
  // to the campaign that produced it.
  SOURCE_FIELDS: ["src", "utm_source", "utm_medium", "utm_campaign", "utm_content"],

  // Which capture surface this page is. SAR-66 event contract: every email-
  // capture submit fires one analytics event carrying page_path and
  // capture_surface, one of "result_block" | "spec_sheet_end" | "landing_page".
  // Tool and spec-sheet pages built under B6 set this to their surface.
  CAPTURE_SURFACE: "landing_page",

  // Minimum minutes between two "view" events from the same visitor id.
  // Keeps the signup-rate denominator honest (one visit per visitor per window).
  VIEW_DEDUPE_MINUTES: 30,

  // Pre-registered pass/fail thresholds for the D+5 demand gate.
  // See the evidence pack: SAR-20 / "demand-validation plan".
  THRESHOLDS: {
    signupRatePass: 0.02,        // visitor -> email capture rate (SAR-1 plan rev.3, section 6)
    signupRateMarginal: 0.005,    // below this the demand signal is treated as absent
    minSignups: 20,               // absolute floor below which a rate is not meaningful
    minConversations: 10,         // completed contractor conversations
    minConversationsQualifying: 5 // conversations confirming the problem and the job
  }
};
