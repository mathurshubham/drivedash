# Claude memory notes

Working notes kept by Claude Code while building DriveDash. They record decisions, deployment facts and gotchas that are not derivable from the code or git history. Update them when the facts change.

- [Decisions](doc-sharing-tool-decisions.md) — hosting, OAuth scope and never-delete rule, copy-per-client, own-drive-only, single-user origin.
- [Deploy](doc-sharing-tool-deploy.md) — production URL, Cloudflare Worker, Google Cloud project and OAuth client, secrets locations, `.dev.vars` gotcha.
- [Phase 2](doc-sharing-tool-phase2.md) — publish-unverified decision, on-open sweep (no cron), email notifications, KV allowlist with access requests; implemented from `IMPLEMENTATION_PLAN.md`.

Secrets are never recorded here. Client ids and project ids are not secrets.
