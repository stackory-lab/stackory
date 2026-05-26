# AI Context Workflow

This maintains a single canonical prompt (`infra/ai-context/CONTEXT.md`) that is rebuilt from modular fragments and then inlined into the adapter files (`CLAUDE.md`, `AGENTS.md`, `GEMINI.md`). Every coding agent reads only the adapter that matches its expected filename, so these instructions must stay in sync.

## Canonical Source of Truth

- Edit files under `infra/ai-context/fragments/` instead of touching the adapters directly.
- `infra/ai-context/CONTEXT.md` is generated; never hand-edit it.
- Treat adapter files as build artifacts. Regenerate them whenever fragments or model-specific notes change.

## Fragment Directory

| File | Purpose |
| --- | --- |
| `rules.md` | Non-negotiable guardrails (security, formatting, review policy). |
| `core.md` | Repository overview, commands, and testing approach. |
| `arch.md` | Architecture and dependency guidance. |
| `coding.md` | Style conventions, naming, and testing heuristics. |
| `output.md` | Response-format requirements for agents. |
| `examples.md` | Few-shot workflows and checklists. |
| `specific.md` | Markdown sections for per-model overrides (e.g., Claude/Gemini notes). Section headings are slugified and matched to model profiles. |

Add new fragments when you need additional scoped context; keep each file focused so profiles can pick only what they need.

## Sync Process

1. Make your edits in `infra/ai-context/fragments/*.md` (and/or add a new section in `specific.md`).
2. Run `pnpm run nx sync:context @infra/toolkit`. The toolkit script:
   - Loads every fragment and rebuilds `infra/ai-context/CONTEXT.md`.
   - Applies the model profile definitions from `ai-context.config.mjs`.
   - Injects the appropriate `specific.md` section (matched by heading slug) into each adapter.
3. Review the regenerated `CLAUDE.md`, `AGENTS.md`, and `GEMINI.md`. They must remain fully inlined—no links or “see other file” pointers.
4. Commit both the fragment changes and the generated files.

## Model Profiles

The profile table inside `ai-context.config.mjs` selects which fragments load for each agent and optionally assigns a `specificKey` (matching a heading in `specific.md`). Update these profiles when:

- A new coding tool expects its own adapter filename.
- Token budgets require a different fragment subset (e.g., Gemini omits examples).
- You add another section to `specific.md` and want to link it to an adapter.

## Validation Checklist

- Run `pnpm run nx sync:context @infra/toolkit` after every context edit.
- Confirm adapter ordering: **rules → core → arch → coding → output → examples → model extras** (unless a profile purposely omits some sections).
- Skim each adapter’s top 200 lines to ensure the most important rules appear early (Claude is sensitive to rule order; Gemini prefers concise openings).
