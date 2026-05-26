# Examples & Patterns

## Adding a Workspace Dependency
1. Update the target package's `package.json` with `pnpm add <dep> --filter <package> --save-exact`.
2. If dependency is internal, use `workspace:*` version, and run `pnpm install`.
3. update `ncu.json` when appropriate
