# @common/sync-ai-context

Configuration-driven generator for AI context files such as `AGENTS.md`,
`CLAUDE.md`, `GEMINI.md`, and canonical context documents. It assembles Markdown
fragments into fully inlined adapter files and can either write the files or
check whether they are already up to date.

---

## Rules & Guardrails

- Keep this package independent of this repository's `infra/ai-context` layout.
- Do not hard-code agent names, output paths, or fragment names in the library.
- Keep runtime dependencies at zero unless a feature cannot be implemented with
  Node standard APIs.
- Preserve deterministic output: same config and fragments must generate the same
  files.
- Run `pnpm run build`, `pnpm run check:type`, and `pnpm run check:test` before
  publishing or wiring into another package.

---

## Public API

```typescript
import { defineConfig, syncAiContext } from '@common/sync-ai-context'

const config = defineConfig({
  fragmentsDir: 'ai/fragments',
  specificPath: 'ai/fragments/specific.md',
  fragmentTitles: {
    rules: 'Rules & Guardrails',
    core: 'Core Project Context',
  },
  documents: [
    {
      name: 'Agents',
      output: 'AGENTS.md',
      title: '# Global Agent Instructions',
      introLines: ['AUTO-GENERATED. DO NOT EDIT.'],
      fragments: ['rules', 'core'],
      specificKey: 'agents-specific-instructions',
    },
  ],
})

await syncAiContext({
  config,
  mode: 'write',
  rootDir: process.cwd(),
})
```

---

## CLI

Create `ai-context.config.mjs` in the target repository:

```javascript
import { defineConfig } from '@common/sync-ai-context'

export default defineConfig({
  fragmentsDir: 'ai/fragments',
  documents: [
    {
      name: 'Agents',
      output: 'AGENTS.md',
      title: '# Global Agent Instructions',
      fragments: ['rules', 'core', 'coding'],
    },
  ],
})
```

Then run:

```bash
sync-ai-context sync --config ai-context.config.mjs
sync-ai-context check --config ai-context.config.mjs
```

`sync` writes generated files. `check` exits with a non-zero status when any
generated file differs from disk, which makes it suitable for CI.

---

## Fragment Rules

- Each fragment is read from `${fragmentsDir}/${id}.md`.
- A leading top-level Markdown title is removed from each fragment before it is
  inserted into a generated document.
- Generated sections use `fragmentTitles[id]` when present; otherwise the raw
  fragment id is used as the section heading.
- `specificPath` is optional. When present, its `##` headings are slugified and
  matched against each document profile's `specificKey`.
