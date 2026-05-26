# Architecture Notes

- **Infra Presets (`infra/`)** centralize tsconfig and dependency rules.
- **Testing / Validation**: Nx `pnpm run check:*` targets orchestrate Biome, Vitest, TS, dependency cruiser. Keep new packages wired into Nx project graph.
