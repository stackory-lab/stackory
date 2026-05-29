import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	extractToolingConfigArgs,
	loadWorkersToolingConfig,
} from './tooling-config.js';
import type {
	IWorkerDeployConfig,
	IWorkerMeta,
	IWorkerTopology,
	TEnvName,
	TWorkerId,
} from './types.js';

type IDeployEnvName = Exclude<TEnvName, 'local'>;

interface IDeployArgs {
	env?: IDeployEnvName;
	dryRun?: boolean;
	workers?: TWorkerId[];
}

interface IResolvedDeployArgs extends IDeployArgs {
	env: IDeployEnvName;
}

interface IPackageJson {
	name?: string;
	scripts?: Record<string, string>;
}

interface IDeploySummary {
	env: IDeployEnvName;
	successful: TWorkerId[];
	failed: {
		worker: TWorkerId;
		error: string;
	}[];
	skipped: TWorkerId[];
}

interface IDeployPlanItem {
	args: string[];
	command: string;
	cwd: string;
	packageDir: string;
	packageName?: string;
	requirePackageScript: boolean;
	scriptName: string;
	workerId: TWorkerId;
}

const SUPPORTED_ENVS = new Set<IDeployEnvName>(['staging', 'production']);
const envToken = '$' + '{env}';
const packageNameToken = '$' + '{packageName}';
const workerIdToken = '$' + '{workerId}';

const usage = () => {
	console.log(`Usage:
  node --import tsx ./src/deploy-workers.ts <staging|production> [options]
  node --import tsx ./src/deploy-workers.ts --env <staging|production> [options]

Options:
  --env <env>   Target deploy environment. Must be staging or production.
  --workers <ids>  Comma-separated worker IDs to deploy in topology order.
  --dry-run     Print the deployment order without running deploy commands.
  --config <path>  Path to workers-tooling config.
  --root <path>    Starting directory for config discovery.
  --help        Show this help text.

Examples:
  pnpm --filter @infra/workers-tooling run deploy:staging
  pnpm --filter @infra/workers-tooling run deploy -- production
  pnpm --filter @infra/workers-tooling run deploy -- staging --workers api,webhook
`);
};

const parseArgs = (argv: string[]) => {
	const args: IDeployArgs = {};

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
		if (token === '--env') {
			const value = argv[index + 1];
			if (!value || !SUPPORTED_ENVS.has(value as IDeployEnvName)) {
				throw new Error('--env must be one of: staging, production');
			}
			args.env = value as IDeployEnvName;
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
		if (SUPPORTED_ENVS.has(token as IDeployEnvName) && !args.env) {
			args.env = token as IDeployEnvName;
			continue;
		}
		throw new Error(`Unknown argument: ${token}`);
	}

	if (!args.env) {
		throw new Error('Deploy environment is required: staging or production');
	}

	return args as IResolvedDeployArgs;
};

const resolveWorkerIds = (
	topology: IWorkerTopology,
	requestedWorkers?: TWorkerId[],
) => {
	const topologyWorkerIds = topology.workers.map((worker) => worker.id);
	if (!requestedWorkers) {
		return topologyWorkerIds;
	}

	const invalidWorkerIds = requestedWorkers.filter(
		(workerId) => !topologyWorkerIds.includes(workerId),
	);
	if (invalidWorkerIds.length > 0) {
		throw new Error(
			`Unknown worker IDs: ${invalidWorkerIds.join(', ')}. Valid workers: ${topologyWorkerIds.join(', ')}`,
		);
	}

	const requestedWorkerIdSet = new Set(requestedWorkers);
	return topologyWorkerIds.filter((workerId) =>
		requestedWorkerIdSet.has(workerId),
	);
};

const replaceCommandTokens = (
	values: string[],
	params: {
		env: IDeployEnvName;
		packageName: string;
		worker: IWorkerMeta;
	},
) => {
	return values.map((value) =>
		value
			.replaceAll(envToken, params.env)
			.replaceAll(packageNameToken, params.packageName)
			.replaceAll(workerIdToken, params.worker.id),
	);
};

const getWorkerPackageName = (worker: IWorkerMeta) => {
	return worker.deploy?.packageName ?? `@worker/${worker.id}`;
};

const getWorkerDeployConfig = (
	worker: IWorkerMeta,
	env: IDeployEnvName,
): Required<Pick<IWorkerDeployConfig, 'command' | 'args' | 'cwd'>> &
	Pick<IWorkerDeployConfig, 'packageName' | 'requirePackageScript'> => {
	const packageName = getWorkerPackageName(worker);
	const config = worker.deploy ?? {};
	const command = config.command ?? 'pnpm';
	const args = config.args ?? ['exec', 'wrangler', 'deploy', '--env', envToken];
	const cwd = config.cwd ?? worker.dir;

	return {
		args: replaceCommandTokens(args, { env, packageName, worker }),
		command,
		cwd,
		packageName,
		requirePackageScript: config.requirePackageScript ?? false,
	};
};

const readWorkerPackage = async (
	rootDir: string,
	workerDir: string,
	packageName: string,
) => {
	const packageJsonPath = path.join(rootDir, workerDir, 'package.json');
	const packageJsonContent = await readFile(packageJsonPath, 'utf-8');
	const packageJson = JSON.parse(packageJsonContent) as IPackageJson;

	if (packageJson.name !== packageName) {
		throw new Error(
			`${packageJsonPath} name must be ${packageName}, found ${packageJson.name ?? '(missing)'}`,
		);
	}

	return {
		packageJsonPath,
		packageName: packageJson.name,
		scripts: packageJson.scripts ?? {},
	};
};

const validateDeployPlan = async (rootDir: string, plan: IDeployPlanItem[]) => {
	for (const item of plan) {
		if (!item.requirePackageScript || !item.packageName) {
			continue;
		}
		const workerPackage = await readWorkerPackage(
			rootDir,
			item.packageDir,
			item.packageName,
		);
		if (!workerPackage.scripts[item.scriptName]) {
			throw new Error(
				`${workerPackage.packageJsonPath} is missing scripts.${item.scriptName}`,
			);
		}
	}
};

const createDeployPlan = (params: {
	env: IDeployEnvName;
	rootDir: string;
	topology: IWorkerTopology;
	workerIds: TWorkerId[];
}) => {
	const { env, rootDir, topology, workerIds } = params;
	const scriptName = `deploy:${env}`;

	return workerIds.map((workerId) => {
		const worker = topology.workers.find(
			(candidate) => candidate.id === workerId,
		);
		if (!worker) {
			throw new Error(`Worker '${workerId}' not found in topology`);
		}
		const deployConfig = getWorkerDeployConfig(worker, env);
		return {
			args: deployConfig.args,
			command: deployConfig.command,
			cwd: path.resolve(rootDir, deployConfig.cwd),
			packageDir: worker.dir,
			packageName: deployConfig.packageName,
			requirePackageScript: Boolean(deployConfig.requirePackageScript),
			scriptName,
			workerId,
		};
	});
};

const runDeployPlanItem = async (item: IDeployPlanItem) => {
	const displayCommand = [item.command, ...item.args].join(' ');

	await new Promise((resolve, reject) => {
		const child = spawn(item.command, item.args, {
			cwd: item.cwd,
			env: process.env,
			stdio: 'inherit',
		});

		child.on('error', reject);
		child.on('close', (code) => {
			if (code === 0) {
				resolve(undefined);
				return;
			}
			reject(
				new Error(
					`${displayCommand} failed with exit code ${code ?? 'unknown'}`,
				),
			);
		});
	});
};

const formatError = (error: unknown) => {
	return error instanceof Error ? error.message : String(error);
};

const printDeploySummary = (summary: IDeploySummary) => {
	console.log(
		JSON.stringify(
			{
				env: summary.env,
				successfulCount: summary.successful.length,
				failedCount: summary.failed.length,
				skippedCount: summary.skipped.length,
				successful: summary.successful,
				failed: summary.failed,
				skipped: summary.skipped,
			},
			null,
			2,
		),
	);
};

export const runDeployWorkersCli = async (argv = process.argv.slice(2)) => {
	const configArgs = extractToolingConfigArgs(argv);
	const context = await loadWorkersToolingConfig(configArgs);
	const topology = context.topology;
	const rootDir = context.rootDir;
	const args = parseArgs(configArgs.remainingArgs);
	const workerIds = resolveWorkerIds(topology, args.workers);
	const plan = createDeployPlan({
		env: args.env,
		rootDir,
		topology,
		workerIds,
	});

	await validateDeployPlan(rootDir, plan);

	console.log(
		JSON.stringify(
			{
				env: args.env,
				workerCount: workerIds.length,
				workers: plan.map((item) => ({
					args: item.args,
					command: item.command,
					cwd: item.cwd,
					packageDir: item.packageDir,
					workerId: item.workerId,
				})),
				dryRun: Boolean(args.dryRun),
			},
			null,
			2,
		),
	);

	if (args.dryRun) {
		return;
	}

	const summary: IDeploySummary = {
		env: args.env,
		successful: [],
		failed: [],
		skipped: [],
	};

	for (let index = 0; index < plan.length; index += 1) {
		const item = plan[index];
		const workerId = item.workerId;
		console.log(`Deploying ${workerId} (${args.env})...`);
		try {
			await runDeployPlanItem(item);
			summary.successful.push(workerId);
		} catch (error: unknown) {
			summary.failed.push({
				worker: workerId,
				error: formatError(error),
			});
			summary.skipped = plan
				.slice(index + 1)
				.map((planItem) => planItem.workerId);
			break;
		}
	}

	printDeploySummary(summary);

	if (summary.failed.length > 0) {
		process.exitCode = 1;
	}
};

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectExecution) {
	runDeployWorkersCli().catch((error) => {
		console.error(formatError(error));
		process.exitCode = 1;
	});
}
