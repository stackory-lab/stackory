#!/usr/bin/env node
import { runApplyLocalD1MigrationsCli } from './apply-local-d1-migrations.js';
import { runCheckWorkerTopologyCli } from './check-worker-topology.js';
import { runDeployWorkersCli } from './deploy-workers.js';
import { runPrintWorkerTopologyCli } from './print-worker-topology.js';
import { runRotateWorkerSecretCli } from './rotate-worker-secret.js';

const usage = () => {
	console.log(`Usage:
  workers-tooling validate [--config <path>] [--root <path>]
  workers-tooling print [--config <path>] [--root <path>]
  workers-tooling deploy <staging|production> [--workers <ids>] [--dry-run] [--config <path>] [--root <path>]
  workers-tooling secret rotate --secret <name> [--env <staging|production>] [options]
  workers-tooling d1 apply-local <preset> [workerDir]

Commands:
  validate           Validate wrangler.jsonc files against topology.
  print              Print the resolved topology as JSON.
  deploy             Deploy workers in topology order.
  secret rotate      Rotate a Worker secret across eligible workers.
  d1 apply-local     Apply local D1 migrations using a preset.
`);
};

const main = async () => {
	const [command, subcommand, ...restArgs] = process.argv.slice(2);

	if (!command || command === '--help' || command === '-h') {
		usage();
		return;
	}

	if (command === 'validate') {
		await runCheckWorkerTopologyCli([subcommand, ...restArgs].filter(Boolean));
		return;
	}

	if (command === 'print') {
		await runPrintWorkerTopologyCli([subcommand, ...restArgs].filter(Boolean));
		return;
	}

	if (command === 'deploy') {
		await runDeployWorkersCli([subcommand, ...restArgs].filter(Boolean));
		return;
	}

	if (command === 'secret' && subcommand === 'rotate') {
		await runRotateWorkerSecretCli(restArgs);
		return;
	}

	if (command === 'd1' && subcommand === 'apply-local') {
		await runApplyLocalD1MigrationsCli(restArgs);
		return;
	}

	throw new Error(
		`Unknown command: ${[command, subcommand].filter(Boolean).join(' ')}`,
	);
};

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
