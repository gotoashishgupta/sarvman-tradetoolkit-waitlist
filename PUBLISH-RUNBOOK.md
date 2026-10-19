# PUBLISH RUNBOOK — P1 TradeToolkit waitlist (SAR-79)

Zero spend. Free tier only. No domain purchase, no paid tools, no ads.

**Live URL:** https://gotoashishgupta.github.io/sarvman-tradetoolkit-waitlist/
(company GitHub account, GitHub Pages, free tier, no custom domain)

## What is ready

Static page, no build step: `index.html` + `assets/` (style.css, app.js, config.js,
favicon.svg). No dependencies, no tracking script, no cookie banner.

Verified 2026-10-20 with headless Chrome (CDP): **0 console messages, 0 page
exceptions, 0 failed requests**, at 390x844 and 1280x900.

## Capture — how it works, and the two things it depends on

Every event is a form post to one endpoint (`CAPTURE_ENDPOINT` in
`assets/config.js`). The relay delivers each one as an email to the catch inbox,
so the durable record of a signup is the email itself.

Two dependencies, both on the same inbox:

1. **The relay is per-origin and needs a one-time activation.** The first
   submission from a new page origin makes FormSubmit email the catch inbox an
   "Activate Form" link, and submissions from that origin are refused until it
   is clicked. The published origin is activated. A new origin (a preview
   deploy, a new domain) needs its own click.
2. **The catch inbox must be readable by the Marketing Lead.** Until A8 lands
   there is no company store, so the inbox is the list.

Both move to the A8 first-party collector by changing `CAPTURE_ENDPOINT` and
`CONTACT_EMAIL` — no other file changes.

### The page never shows a success it did not get

The relay answers HTTP 200 with `{"success":"false"}` when it refuses a
submission. `app.js` normalises that field and treats anything but `"true"` as
a refusal, so a refused signup shows the failure path and stays queued on the
visitor's device for retry. Verified against a mock relay that refuses
(2026-10-20): the page showed "That didn't send…" and kept the event queued.

The client also sends a honeypot field (`website`, off-screen). A filled
honeypot means an automated submitter: the event is not sent.

## Instrumentation (SAR-13 / A7, definition v1.1.0)

Every event carries the A7 payload next to this page's readable fields:

| A7 field | Value sent |
| --- | --- |
| `v` | `1` |
| `e` | `pageview` (view) / `email_capture` (signup) |
| `pa` | page path |
| `r` | referrer URL |
| `t` | client timestamp, epoch ms |
| `c` | `unknown` — P1 is a professional audience and A7 sets its consent mode to `not-required` (platform `products.ts`), so this page sets no analytics consent state. The marketing consent the visitor ticks is a separate field and is not the same thing. |
| `o` | `{ source }` — `src`, else `utm_source`, else the referrer host, else `direct` |

Also sent, for the SAR-66 / SAR-94 contracts: `event`, `event_version`,
`definition_version`, `capture_surface`, `product`, `ts`, `visitor_id`,
`page_title`, `page_path`, `referrer`, `src`/`utm_*`. On a signup: `email`,
`company`, `role`, `sizing`, `consent`.

`_subject` is set per event so the inbox can be tallied without opening each
message: `P1 waitlist - page view` and `P1 waitlist - signup`.

### Deviations from A7, and why

- **Transport.** A7 assumes the A8 collector (Cloudflare Worker + D1). The
  company hosting and analytics accounts cannot be created before the board
  approval at the D+5 gate, so events travel through a free-tier mail relay
  and are counted from the catch inbox. The payload is A7-shaped, so it can be
  replayed into the A8 collector unchanged.
- **Visitor id.** A7 takes the visitor id from a server-set `sv_uid` cookie.
  There is no server here, so the id is a UUIDv4 kept in `localStorage` on the
  page's own origin. It matches A7's `VISITOR_ID_PATTERN`.
- **Bot exclusion.** A7 excludes bots by User-Agent at ingest. A browser post
  carries a real User-Agent, so the relay cannot filter the way the collector
  would. The honeypot and the 30-minute per-visitor view dedupe are the
  compensating controls.

## Daily tally (for the D+5 demand gate)

Per day, from the catch inbox:

1. Count the emails with subject `P1 waitlist - signup`. That is the day's
   signups.
2. Split them by source: `src`, else `utm_source`, else the referrer host in
   `r`. A signup from a search-engine referrer is the contractor-targeted
   traffic the gate's reach threshold is counted on; the rest are reported
   separately, not dropped.
3. Page views: count the `P1 waitlist - page view` emails for the day. One
   view per visitor per 30 minutes, so this is the day's unique visitors.
4. Signup rate = signups / unique views.

Post the tally on B2 ([SAR-20](/SAR/issues/SAR-20)) as it accumulates, with
the raw numbers, in the format the gate protocol asks for.

When A8 lands, replace the inbox tally with the A8 collector's own report so
the numbers carry the ratified definition version.
