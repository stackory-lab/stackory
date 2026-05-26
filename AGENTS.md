# Global Agent Instructions

⚠️ AUTO-GENERATED. DO NOT EDIT.
Used by ChatGPT / Codex-compatible agents. Source of truth: ai/CONTEXT.md fragments.

## Rules & Guardrails

- Never commit secrets or sample credentials. Keep `.env*` files local and rely on Wrangler/Cloudflare env vars for Workers.
- Align tooling with repo engines: Node 24.x, pnpm 11.1.x. If caches drift, run `pnpm clean`.
- Prefer incremental, reviewable diffs. Ask before schema changes, auth rewrites, or other refactors that impact multiple packages.
- Do not invent APIs, file structures, or commands. Derive everything from the repo or ask for clarification.
- Always mention which tests or commands should be run to validate the change; if you could not run them, say so explicitly.

---

## Core Project Context

- This is a TypeScript-first monorepo managed by **Nx** plus **pnpm** workspaces. Internal packages reference each other through `workspace:*` versions.

---

## Architecture Notes

- **Infra Presets (`infra/`)** centralize tsconfig and dependency rules.
- **Testing / Validation**: Nx `pnpm run check:*` targets orchestrate Biome, Vitest, TS, dependency cruiser. Keep new packages wired into Nx project graph.

---

## Coding Style

- Language: TypeScript (strict). Prefer async/await.
- Formatting: Biome-managed, 2-space indentation, single quotes for TS/JS, trailing commas per formatter.
- File/Folder naming: MUST use kebab-case (hyphen-case) or lowercase with dots (e.g., `file.config.ts`). DO NOT use camelCase, PascalCase, or UPPERCASE for file and folder names, unless there are default specifications (e.g., README.md, CLAUDE.md, AGENTS.md, GEMINI.md).
- Interfaces and type must be prefixed with `I` (e.g., `interface IUser` `type IAccount`). Avoid `any`; choose `unknown` or specific types.
- Imports: prefer workspace aliases (`@package/ui-auth`, `@package/core-types`) over long relative paths.
- Testing: co-locate specs alongside source (`*.test.ts` / `*.spec.ts`) and exercise public APIs. Avoid fixtures hitting the network.
- Commit style: imperative conventional form (`fix: normalize auth client id casing`). Keep diffs minimal, call out breaking changes and env vars.
- Return types: Do not explicitly annotate function return types unless necessary. Prefer TypeScript's type inference; only specify return types for public APIs, complex generics, or when you need to constrain inference.
- Void keyword: Avoid `void` operator to ignore promises and `: void` / `: Promise<void>` return type annotations. Exception: callback type signatures (e.g., `onClick: () => void`). Handle async errors explicitly with `.catch()` or try-catch.
- Class methods: As a general rule, class methods **should be defined using arrow functions (`() => {}`)** to ensure `this` is lexically bound to the instance. This avoids manual binding and prevents context loss when methods are used as callbacks or event handlers.
  - Exceptions: Use prototype methods (`method() {}`) only when inheritance via `super`, method overriding, or performance considerations (large numbers of instances) are required.
- Require curly braces for all control statements. Disallow single-line if statements without braces.

---

## Output & Collaboration Expectations

- Default tone: concise, friendly teammate. Lead with the change intent, then details. Mirror request language when possible.
- Always reference touched files with inline paths + line numbers (e.g., ``common/utils/foo.ts:42``). Avoid line ranges or URLs.
- Use fenced code blocks with language identifiers for multi-line snippets; keep single-line snippets inline.
- When proposing edits, prefer `apply_patch`-friendly diffs or clearly scoped instructions. Avoid rewriting whole files unless necessary.

---

## Examples & Patterns

## Adding a Workspace Dependency
1. Update the target package's `package.json` with `pnpm add <dep> --filter <package> --save-exact`.
2. If dependency is internal, use `workspace:*` version, and run `pnpm install`.
3. update `ncu.json` when appropriate

---

## Agents-Specific Instructions

- Provide a short plan for work with multiple steps and keep answers concise.
- Format responses exactly as requested in developer instructions (bullets, file refs, tests).
- If blocked or unsure, ask clarifying questions instead of guessing.
