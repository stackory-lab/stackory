# Architecture Notes

- **Infra Presets (`infra/`)** centralize tsconfig and dependency rules.
- **Testing / Validation**: use Nx targets as the standard validation path. The core check targets are `check:lint`, `check:type`, `check:dep`, and `check:test`; `build` should be included when validating package outputs.
- For affected changes, run `pnpm run check:affected`, which executes `check:lint`, `check:test`, `check:type`, `check:dep`, and `build` through Nx for affected projects.
- For one project, use `pnpm nx run <project>:<target>` (for example, `pnpm nx run @stackory/agent-runtime-core:check:test`). Do not run bare `pnpm nx run --help` as a validation command; Nx requires a project and target for `run`.
- For multiple projects, use `pnpm nx run-many -t check:lint,check:type,check:dep,check:test,build -p <project-a> <project-b>`. Omit `-p` only when intentionally validating every project.
- Run `pnpm run monosync` to validate workspace package metadata sync. Use `pnpm run monosync:update` only when intentionally updating `monosync.json` and package metadata.
- Keep new packages wired into the Nx project graph and monosync workspace metadata so these validation commands include them.
