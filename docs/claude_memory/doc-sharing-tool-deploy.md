---
name: doc-sharing-tool-deploy
description: Where the doc-sharing tool is deployed and which Google Cloud project / accounts back it (Cloudflare Worker URL, GCP project id, OAuth account)
type: reference
---

- Production URL: https://drivedash.shubhammathur.in (custom domain on a Cloudflare Worker named `drivedash`; zone shubhammathur.in is on Cloudflare, account mathurshubham@gmail.com). Deployed 2026-09-12 with `pnpm run deploy` under Node 22 via `fnm exec --using=22.23.2`. The project was renamed from doc-sharing-tool to DriveDash on 2026-09-12; the old Worker `doc-sharing-tool` was deleted on 2026-09-12. GitHub repo: mathurshubham/drivedash.
- Google Cloud project: `doc-sharing-tool`, project id `scenic-patrol-508413-b7`, owned by the personal account mathurshubham@gmail.com (not the bluehorizonsgroup Workspace account). OAuth consent is External and **In production (published unverified) since 2026-09-13**. Consent app name is "DriveDash". Branding URLs point at https://drivedash.shubhammathur.in/about, /privacy, /terms. Unverified restricted scope `drive` means: one-time "Google hasn't verified this app" screen per user and a 100-user lifetime cap. Not seeking verification.
- OAuth client "doc-sharing-tool web" has redirect URIs for localhost:3000 and https://drivedash.shubhammathur.in only. Authorised domains: mathurshubham.workers.dev, shubhammathur.in.
- Secrets live in `.env.local` / `.dev.vars` locally (gitignored) and as Worker secrets via `wrangler secret bulk`: AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, AUTH_URL, AUTH_TRUST_HOST, ADMIN_EMAILS (= mathurshubham@gmail.com, the admin), ALLOWED_EMAILS (one-time KV seed only). Access control now lives in Cloudflare KV namespace `ACCESS` (id 41268e2d0a9640ffa18029e8b209966a), managed from /admin/users in the app.
- Gotcha: `.dev.vars` is loaded by `next dev` too (OpenNext dev init) and overrides `.env.local`; keep them in sync.

Related: [[doc-sharing-tool-decisions]]
