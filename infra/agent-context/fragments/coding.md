# Coding Style

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