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

**How to apply:** The user said they will implement phase 2 in **Cursor** from `IMPLEMENTATION_PLAN.md` in the repo. If asked to help, work from that plan; don't redesign. Keep the no-cron and no-stored-token constraints unless the user reopens them.

Related: [[doc-sharing-tool-decisions]], [[doc-sharing-tool-deploy]]
