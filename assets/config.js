/*
 * Sarvman TradeToolkit — waitlist landing page
 * Single source of truth for the capture endpoint and experiment thresholds.
 * Changing CAPTURE_ENDPOINT is the only edit needed to move capture between
 * providers (e.g. first-party form endpoint once the platform lands).
 */
window.SARVMAN_CONFIG = {
  // FormSubmit AJAX endpoint. Format: https://formsubmit.co/ajax/<inbox-address>
  // Every submission is delivered as an email to that inbox, with a JSON response.
  CAPTURE_ENDPOINT: "",

  // Hidden fields stamped on every event so a submission can be traced back
  // to the campaign that produced it.
  SOURCE_FIELDS: ["src", "utm_source", "utm_medium", "utm_campaign", "utm_content"],

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
