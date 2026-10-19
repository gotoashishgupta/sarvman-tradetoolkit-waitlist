# PUBLISH RUNBOOK — P1 TradeToolkit waitlist (SAR-79)

Zero spend. Free tier only. No domain purchase, no paid tools, no ads.

## What is ready

Static page, no build step: `index.html` + `assets/` (style.css, app.js, config.js).
Verified: serves with 200s, valid markup, no duplicate ids, `node --check` clean
on both JS files, responsive CSS breakpoints (860px / 620px) for mobile + desktop.

## Blockers (need CTO, same day per issue)

1. **Inbox address** for capture. Set in `assets/config.js`:
   - `CAPTURE_ENDPOINT: "https://formsubmit.co/ajax/<inbox-address>"`
   - `CONTACT_EMAIL: "<same-inbox-address>"`
   - Then submit the form once yourself: FormSubmit sends an **activation email**
     to that inbox — click it or submissions are silently dropped.
2. **Hosting account** (free tier). Any one of these, ~10 min:
   - Cloudflare Pages (free, `*.pages.dev` subdomain), or
   - Netlify Drop (drag the `waitlist/` folder, free `*.netlify.app` subdomain), or
   - GitHub Pages (free `*.github.io`, needs a repo).
   All three are free-tier subdomains, which the issue explicitly accepts.

Until both are done the page **must not** be presented as live: with no endpoint
the form queues on-device and tells the visitor the list isn't live yet (no fake
success — see `app.js` pre-publish guard).

## Publish steps

1. Set the two config values above.
2. Drag/drop or push the `waitlist/` folder contents to the host. No build command.
3. Smoke test on the public URL (phone + desktop):
   - Page loads, no console errors.
   - `?src=test` visit → a `view` event posts (check inbox / endpoint log).
   - Submit the form with a real address + consent → success message,
     submission email arrives in the inbox with `event=signup`, `visitor_id`,
     `src`/`utm_*`, `referrer`, `role`, `sizing`.
   - Validation paths: bad email and missing consent each show inline errors.
4. Post the live URL in a comment on **SAR-79 and B2 (SAR-20)**.
5. Daily: count inbox `signup` emails per day + source (`src`/`utm_source`/
   `referrer`, bots excluded by the 30-min visitor-dedupe window) and post the
   tally on B2 as gate evidence.

## Moving capture later (no page rewrite)

When the A8 first-party store lands, change only `CAPTURE_ENDPOINT` to the new
POST URL. Event shape (`event`, `event_version`, `visitor_id`, `capture_surface`,
`page_path`, `src`/`utm_*`, `referrer`) is stable per the SAR-66 contract.
