import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	extractToolingConfigArgs,
	loadWorkersToolingConfig,
} from './tooling-config.js';
import type { IWorkerTopology, TEnvName, TWorkerId } from './types.js';

const SUPPORTED_ENVS = new Set<TEnvName>(['staging', 'production']);

type IArgs = {
	secretName?: string;
	env?: TEnvName;
	workers?: TWorkerId[];
	value?: string;
	fromEnv?: string;
	generate?: boolean;
	dryRun?: boolean;
	listWorkers?: boolean;
};

const usage = () => {
	console.log(`Usage:
  node --import tsx ./src/rotate-worker-secret.ts --secret <SECRET_NAME> --env <staging|production> [options]

Options:
  --secret <SECRET_NAME>  Secret name to rotate. Must exist in topology.requiredSecrets.
  --workers <id1,id2>     Comma-separated worker IDs. Defaults to all workers requiring the given secret.
  --value <secret>        Use the provided secret value directly.
  --from-env <VAR_NAME>   Read the secret value from process.env[VAR_NAME].
  --generate              Generate a new random 32-byte hex secret.
  --dry-run               Print the target workers without writing secrets.
  --list-workers          Print all eligible worker IDs and exit.
  --config <path>         Path to workers-tooling config.
  --root <path>           Starting directory for config discovery.
  --help                  Show this help text.

Examples:
  workers-tooling secret rotate --secret API_TOKEN --env staging --generate
  workers-tooling secret rotate --secret WEBHOOK_SECRET --env production --workers api,webhook --from-env WEBHOOK_SECRET_NEXT
`);
};

const resolveEligibleWorkers = (
	topology: IWorkerTopology,
	secretName: string,
) => {
	return topology.workers
		.filter((worker) => worker.requiredSecrets.includes(secretName))
		.map((worker) => worker.id);
};

const parseArgs = (argv: string[]) => {
	const args: IArgs = {};

	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (token === '--') {
			continue;
		}
		if (token === '--help' || token === '-h') {
			usage();
			process.exit(0);
		}
		if (token === '--dry-run') {
			args.dryRun = true;
			continue;
		}
		if (token === '--generate') {
			args.generate = true;
			continue;
		}
		if (token === '--list-workers') {
			args.listWorkers = true;
			continue;
		}
		if (token === '--secret') {
			const value = argv[index + 1];
			if (!value) {
				throw new Error('--secret requires a secret name');
			}
			args.secretName = value;
			index += 1;
			continue;
		}
		if (token === '--env') {
			const value = argv[index + 1];
			if (!value || !SUPPORTED_ENVS.has(value as TEnvName)) {
				throw new Error('--env must be one of: staging, production');
			}
			args.env = value as TEnvName;
			index += 1;
			continue;
		}
		if (token === '--workers') {
			const value = argv[index + 1];
			if (!value) {
				throw new Error('--workers requires a comma-separated value');
			}
			args.workers = value
				.split(',')
				.map((item) => item.trim())
				.filter(Boolean) as TWorkerId[];
			index += 1;
			continue;
		}
		if (token === '--value') {
			const value = argv[index + 1];
			if (!value) {
				throw new Error('--value requires a secret value');
			}
			args.value = value;
			index += 1;
			continue;
		}
		if (token === '--from-env') {
			const value = argv[index + 1];
			if (!value) {
				throw new Error('--from-env requires an environment variable name');
			}
			args.fromEnv = value;
			index += 1;
			continue;
		}
		throw new Error(`Unknown argument: ${token}`);
	}

	return args;
};

const resolveWorkers = (params: {
	requestedWorkers?: TWorkerId[];
	eligibleWorkers: TWorkerId[];
	secretName: string;
}) => {
	const { requestedWorkers, eligibleWorkers, secretName } = params;
	const workers = requestedWorkers ?? eligibleWorkers;
	for (const workerId of workers) {
		if (!eligibleWorkers.includes(workerId)) {
			throw new Error(
				`Worker '${workerId}' is not eligible for ${secretName}. Eligible workers: ${eligibleWorkers.join(', ')}`,
			);
		}
	}
	return workers;
};

const resolveSecretValue = (args: IArgs) => {
	const sources = [
		args.value !== undefined,
		args.fromEnv !== undefined,
		args.generate,
	].filter(Boolean).length;
	if (sources !== 1) {
		throw new Error(
			'Exactly one of --value, --from-env, or --generate must be provided',
		);
	}

	if (args.value !== undefined) {
		return args.value;
	}
	if (args.fromEnv !== undefined) {
		const value = process.env[args.fromEnv];
		if (!value) {
			throw new Error(
				`Environment variable '${args.fromEnv}' is missing or empty`,
			);
		}
		return value;
	}
	return randomBytes(32).toString('hex');
};

const fingerprintSecret = (secretValue: string) => {
	return createHash('sha256').update(secretValue).digest('hex').slice(0, 12);
};

const putSecret = async (params: {
	rootDir: string;
	topology: IWorkerTopology;
	secretName: string;
	workerId: TWorkerId;
	env: Exclude<TEnvName, 'local'>;
	secretValue: string;
}) => {
	const worker = params.topology.workers.find(
		(candidate) => candidate.id === params.workerId,
	);
	if (!worker) {
		throw new Error(`Worker '${params.workerId}' not found in topology`);
	}

	const cwd = path.join(params.rootDir, worker.dir);

	await new Promise<void>((resolve, reject) => {
		const child = spawn(
			'pnpm',
			[
				'exec',
				'wrangler',
				'secret',
				'put',
				params.secretName,
				'--env',
				params.env,
			],
			{
				cwd,
				env: process.env,
				stdio: ['pipe', 'inherit', 'inherit'],
			},
		);

		child.on('error', reject);
		child.stdin.write(params.secretValue);
		child.stdin.end('\n');

		child.on('close', (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(
				new Error(
					`wrangler secret put failed for worker '${params.workerId}' with exit code ${code ?? 'unknown'}`,
				),
			);
		});
	});
};

export const runRotateWorkerSecretCli = async (
	argv = process.argv.slice(2),
) => {
	const configArgs = extractToolingConfigArgs(argv);
	const context = await loadWorkersToolingConfig(configArgs);
	const topology = context.topology;
	const args = parseArgs(configArgs.remainingArgs);
	if (!args.secretName) {
		throw new Error('--secret is required');
	}
	const eligibleWorkers = resolveEligibleWorkers(topology, args.secretName);
	if (eligibleWorkers.length === 0) {
		throw new Error(
			`No workers in topology declare required secret '${args.secretName}'`,
		);
	}

	if (args.listWorkers) {
		console.log(eligibleWorkers.join('\n'));
		return;
	}

	if (!args.env || args.env === 'local') {
		throw new Error('--env is required and must be staging or production');
	}

	const workers = resolveWorkers({
		requestedWorkers: args.workers,
		eligibleWorkers,
		secretName: args.secretName,
	});
	const secretValue = resolveSecretValue(args);
	const fingerprint = fingerprintSecret(secretValue);

	console.log(
		JSON.stringify(
			{
				secretName: args.secretName,
				env: args.env,
				workerCount: workers.length,
				workers,
				fingerprint,
				dryRun: Boolean(args.dryRun),
			},
			null,
			2,
		),
	);

	if (args.dryRun) {
		return;
	}

	const rotatedWorkers: TWorkerId[] = [];

	for (const workerId of workers) {
		console.log(`Rotating ${args.secretName} for ${workerId} (${args.env})...`);
		await putSecret({
			rootDir: context.rootDir,
			topology,
			secretName: args.secretName,
			workerId,
			env: args.env,
			secretValue,
		});
		rotatedWorkers.push(workerId);
	}

	console.log(
		JSON.stringify(
			{
				secretName: args.secretName,
				env: args.env,
				fingerprint,
				rotatedWorkers,
			},
			null,
			2,
		),
	);
};

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectExecution) {
	runRotateWorkerSecretCli().catch((error) => {
		console.error(
			error instanceof Error ? error.message : 'rotate secret failed',
		);
		process.exitCode = 1;
	});
}
