# @stackory/workers-tooling

Topology schema, config loading, validation, deploy, secret, and local D1 tooling for Cloudflare Workers projects.

## Commands

```bash
pnpm --filter @stackory/workers-tooling build
pnpm --filter @stackory/workers-tooling check:type
nx run @stackory/workers-tooling:check:worker-topology
nx run @stackory/workers-tooling:print:worker-topology
```

The command scripts route through the unified CLI entry:

```bash
node --import tsx ./src/cli.ts validate
node --import tsx ./src/cli.ts print
node --import tsx ./src/cli.ts deploy staging --workers api,webhook --dry-run
node --import tsx ./src/cli.ts secret rotate --secret API_TOKEN --env staging --dry-run --generate
node --import tsx ./src/cli.ts d1 apply-local app-db
```

Commands load topology from `workers-tooling.config.ts` by default. This
repository keeps its topology in the root `workers-tooling.config.ts`; the
package source does not embed repository-specific Worker, account, D1, KV,
Queue, R2, or secret facts.

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
pnpm --filter @stackory/workers-tooling run deploy:staging
pnpm --filter @stackory/workers-tooling run deploy:production
```

Deploy a specific subset. The provided IDs are validated, then filtered into
topology order before publishing:

```bash
pnpm --filter @stackory/workers-tooling run deploy -- staging --workers api,webhook
pnpm --filter @stackory/workers-tooling run deploy -- production --workers api,worker-b,webhook
```

Preview the resolved deploy order without publishing:

```bash
pnpm --filter @stackory/workers-tooling run deploy -- staging --dry-run
pnpm --filter @stackory/workers-tooling run deploy -- staging --workers webhook,api --dry-run
```

Dry runs print the resolved deploy plan, including `command`, `args`, `cwd`,
`packageDir`, and `workerId`.

The deploy command stops on the first failed Worker deploy and prints a JSON
summary with `successful`, `failed`, and `skipped` Worker IDs.

In this repository, each Worker declares an Nx deploy command in the root
`workers-tooling.config.ts`, so deploys run from the repository root:

```bash
npm run nx deploy:staging @worker/api
npm run nx deploy:production @worker/api
```

For external topology configs, Workers without an explicit `deploy` block default
to:

```bash
wrangler deploy --env <env>
```

### Rotate worker secrets

```bash
pnpm --filter @stackory/workers-tooling run rotate:secret -- --env production --workers api,webhook --secret WEBHOOK_SECRET --generate
```

### Apply local D1 migrations

Local D1 migration presets are read from `topology.d1MigrationPresets`. The
tooling package does not own project-specific preset names.

```bash
pnpm --filter @stackory/workers-tooling run apply-local-d1-migrations -- app-db
node --import tsx ./src/cli.ts d1 apply-local app-db
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
