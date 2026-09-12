---
name: doc-sharing-tool-phase2
description: Phase 2 decisions for the doc-sharing tool (publish OAuth app unverified, share expiry with on-open sweep not cron, email notify on, KV allowlist with request-access) and that the user implements it in Cursor from IMPLEMENTATION_PLAN.md
type: project
---

Decisions made 2026-09-12, after research the user asked for:

- **Publish the Google OAuth app unverified** (option B). Accepts one-time "unverified app" screen and 100-user lifetime cap; will not seek verification (restricted `drive` scope would need CASA ~$540/yr). Blocked until Branding page has home/privacy/terms URLs, hence branding pages are feature 1.
- **Share expiry**: email shares use native Drive `expirationTime`; anyone-links revoked by an **on-open sweep** only. User explicitly chose no cron (avoids storing refresh token). UI must say "for scheduled revocation contact the developer".
- **Email shares now send Google's notification email** (`sendNotificationEmail=true`) with optional message field and a toggle.
- **Share log** page: every share ever made, active + history, Revoke/Extend. Entries never deleted, only status-changed.
- **Access requests**: sign in with Google first, then request; admins approve in-app; allowlist moves to Cloudflare KV, `ADMIN_EMAILS` env seeds admins.
- Never-delete rule amended: exactly one DELETE allowed, `revokePermission()` in `src/lib/shares.ts`, permissions only.

**Why:** User wanted multi-user without weekly re-login, and link hygiene for client shares, while avoiding any server-side Google credential.

**Status:** Phase 2 shipped 2026-09-13. All three PRs merged (access requests, share expiry + log, branding pages), deployed to https://drivedash.shubhammathur.in, and the Google OAuth app published. Reviews were done by Claude with adversarial probes; the user implemented in Cursor.

**How to apply:** `IMPLEMENTATION_PLAN.md` is now historical; the code and `SPEC.md` are the source of truth. Keep the no-cron and no-stored-token constraints unless the user reopens them. Remaining known nits are listed in the last PR review (KV seeded-read cost, sweep entry attribution) and are non-blocking.

Related: [[doc-sharing-tool-decisions]], [[doc-sharing-tool-deploy]]
