---
name: doc-sharing-tool-decisions
description: Product and hosting decisions for the Drive doc-sharing tool that are not in the code (Cloudflare free tier, full drive scope with never-delete rule, copy-per-client, own drive only)
type: project
---

Decisions made by the user on 2026-09-12 for the doc-sharing tool (thin mobile wrapper over Google Drive):

- Hosting: Cloudflare Workers free tier via `@opennextjs/cloudflare`. Not Vercel.
- OAuth scope: full `drive` (+ `drive.appdata`). User wanted "except delete"; no such Google scope exists, so the rule is enforced in code and a vitest guard (no DELETE / trash calls).
- Sharing: two buttons per file. "Share link" on the master file, and "Copy for client" which copies into `Client Shares/<Client>/` and shares the copy.
- Hot list: user-defined groups, stored as `hotlist.json` in Drive appDataFolder (no database).
- Own My Drive only, no shared drives.
- Single user; sign-in allowlisted to the user's Workspace email. Google Cloud project and Cloudflare account setup are still the user's manual steps (not done as of 2026-09-12).

**Why:** These came from a design discussion before implementation; the spec file `SPEC.md` in the repo records the contract, but not the rejected alternatives.

**How to apply:** Do not propose Vercel, a database, shared-drive support, or client login. Keep the never-delete rule when adding Drive calls. Preserve the user's preference to discuss design before agents implement.
