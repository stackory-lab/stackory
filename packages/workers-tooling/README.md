# @stackory/workers-tooling

Topology schema, config loading, validation, deploy, secret, and local D1 tooling for Cloudflare Workers projects.

## Install

```bash
pnpm add -D @stackory/workers-tooling wrangler
```

## Commands

```bash
pnpm --filter @stackory/workers-tooling build
pnpm --filter @stackory/workers-tooling check:type
```

After installation, use the `workers-tooling` CLI:

```bash
workers-tooling validate
workers-tooling print
workers-tooling deploy staging --workers api,webhook --dry-run
workers-tooling secret rotate --secret API_TOKEN --env staging --dry-run --generate
workers-tooling d1 apply-local app-db
```

Commands look for `workers-tooling.config.ts`, `workers-tooling.config.mjs`, or
`workers-tooling.config.js` from the current working directory upward by default.
Pass `--config <path>` for an explicit config file or `--root <path>` to choose a
different starting directory for discovery. The package source does not embed
repository-specific Worker, account, D1, KV, Queue, R2, or secret facts.

External projects can define their own config:

```ts
import { defineWorkersTopology } from '@stackory/workers-tooling/core';

export default defineWorkersTopology({
	platform: {
		compatibilityDate: '2026-03-03',
		compatibilityFlags: ['nodejs_compat'],
		accountIdByEnv: {
			staging: 'example-account-id',
			production: 'example-account-id',
		},
	},
	workers: [
		{
			id: 'api',
			dir: 'workers/api',
			entry: 'src/index.ts',
			devPort: 8787,
			workersDevByEnv: {
				staging: true,
				production: false,
			},
			localVarsFiles: ['.dev.vars'],
			requiredSecrets: ['API_TOKEN'],
		},
	],
	durableObjects: [],
	externalDurableObjectBindings: [],
	serviceBindings: [],
	queues: [],
	queueProducerBindings: [],
	d1: [],
	r2: [],
	kv: [],
	globalVars: [],
	workerVars: [],
});
```

### Deploy workers

Deploy all Workers in topology order:

```bash
workers-tooling deploy staging
workers-tooling deploy production
```

Deploy a specific subset. The provided IDs are validated, then filtered into
topology order before publishing:

```bash
workers-tooling deploy staging --workers api,webhook
workers-tooling deploy production --workers api,worker-b,webhook
```

Preview the resolved deploy order without publishing:

```bash
workers-tooling deploy staging --dry-run
workers-tooling deploy staging --workers webhook,api --dry-run
```

Dry runs print the resolved deploy plan, including `command`, `args`, `cwd`,
`packageDir`, and `workerId`.

The deploy command stops on the first failed Worker deploy and prints a JSON
summary with `successful`, `failed`, and `skipped` Worker IDs.

If a Worker declares a custom deploy command in `workers-tooling.config.ts`,
deploys use that command instead of the default. For example, a topology can run
an Nx deploy command from the repository root:

```bash
npm run nx deploy:staging @worker/api
npm run nx deploy:production @worker/api
```

Workers without an explicit `deploy` block default to running Wrangler through
the project package manager:

```bash
pnpm exec wrangler deploy --env <env>
```

### Rotate worker secrets

```bash
workers-tooling secret rotate --env production --workers api,webhook --secret WEBHOOK_SECRET --generate
```

### Apply local D1 migrations

Local D1 migration presets are read from `topology.d1MigrationPresets`. The
tooling package does not own project-specific preset names.

```bash
workers-tooling d1 apply-local app-db
```

## Scope

- `src/types.ts`: topology schema types
- `src/define-workers-topology.ts`: typed topology definition helper
- `src/tooling-config.ts`: config discovery and loading
- `src/check-worker-topology.ts`: injectable `wrangler.jsonc` consistency checker
- `src/deploy-workers.ts`: topology-ordered Worker deploy entry
- `src/print-worker-topology.ts`: injectable topology printer entry

Current migration keeps `wrangler.jsonc` as the source of actual runtime config
and uses the project `workers-tooling.config.ts` as the source of expected
shared facts.
