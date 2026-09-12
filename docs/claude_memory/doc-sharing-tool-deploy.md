---
name: doc-sharing-tool-deploy
description: Where the doc-sharing tool is deployed and which Google Cloud project / accounts back it (Cloudflare Worker URL, GCP project id, OAuth account)
type: reference
---

- Production URL: https://drivedash.shubhammathur.in (custom domain on a Cloudflare Worker named `drivedash`; zone shubhammathur.in is on Cloudflare, account mathurshubham@gmail.com). Deployed 2026-09-12 with `pnpm run deploy` under Node 22 via `fnm exec --using=22.23.2`. The project was renamed from doc-sharing-tool to DriveDash on 2026-09-12; the old Worker `doc-sharing-tool` was deleted on 2026-09-12. GitHub repo: mathurshubham/drivedash.
- Google Cloud project: `doc-sharing-tool`, project id `scenic-patrol-508413-b7`, owned by the personal account mathurshubham@gmail.com (not the bluehorizonsgroup Workspace account). OAuth consent is External, in Testing mode, one test user (mathurshubham@gmail.com). Testing mode expires refresh tokens after 7 days; publishing the app removes that.
- OAuth client "doc-sharing-tool web" has redirect URIs for localhost:3000 and https://drivedash.shubhammathur.in only. Authorised domains: mathurshubham.workers.dev, shubhammathur.in.
- Secrets live in `.env.local` / `.dev.vars` locally (gitignored) and as Worker secrets via `wrangler secret bulk`. `ALLOWED_EMAILS` = mathurshubham@gmail.com.
- Gotcha: `.dev.vars` is loaded by `next dev` too (OpenNext dev init) and overrides `.env.local`; keep them in sync.

Related: [[doc-sharing-tool-decisions]]
