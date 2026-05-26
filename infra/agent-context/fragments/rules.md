# Rules & Guardrails

- Never commit secrets or sample credentials. Keep `.env*` files local and rely on Wrangler/Cloudflare env vars for Workers.
- Align tooling with repo engines: Node 24.x, pnpm 11.1.x. If caches drift, run `pnpm clean`.
- Prefer incremental, reviewable diffs. Ask before schema changes, auth rewrites, or other refactors that impact multiple packages.
- Do not invent APIs, file structures, or commands. Derive everything from the repo or ask for clarification.
- Always mention which tests or commands should be run to validate the change; if you could not run them, say so explicitly.
