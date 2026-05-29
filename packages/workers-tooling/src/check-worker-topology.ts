import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	extractToolingConfigArgs,
	loadWorkersToolingConfig,
} from './tooling-config.js';
import type {
	IDurableObjectClass,
	IWorkerMeta,
	IWorkerTopology,
	TEnvName,
	TWorkerId,
} from './types.js';
import { readWranglerConfig } from './wrangler-config.js';

interface ICheckIssue {
	filePath: string;
	expected: string;
	actual: string;
	source: string;
}

type TDeployEnvName = Exclude<TEnvName, 'local'>;

const deployEnvironments: TDeployEnvName[] = ['staging', 'production'];

const normalizeList = (values: string[]) => {
	return [...values].sort((left, right) => left.localeCompare(right));
};

const toJson = (value: unknown) => {
	return JSON.stringify(value, null, 0);
};

const addIssue = (
	issues: ICheckIssue[],
	filePath: string,
	expected: string,
	actual: string,
	source: string,
) => {
	issues.push({
		filePath,
		expected,
		actual,
		source,
	});
};

const scriptNameForWorker = (
	workerId: TWorkerId,
	envName: Exclude<TEnvName, 'local'>,
) => {
	return `${workerId}-${envName}`;
};

const getExpectedServiceBindings = (
	topology: IWorkerTopology,
	workerId: TWorkerId,
	envName: Exclude<TEnvName, 'local'>,
) => {
	return topology.serviceBindings
		.filter((binding) => binding.fromWorker === workerId)
		.map((binding) => ({
			binding: binding.bindingName,
			service: scriptNameForWorker(binding.toWorker, envName),
		}));
};

const getExpectedExternalDurableObjectBindings = (
	topology: IWorkerTopology,
	workerId: TWorkerId,
	envName: TDeployEnvName,
) => {
	return topology.externalDurableObjectBindings
		.filter((binding) => binding.consumerWorker === workerId)
		.map((binding) => ({
			name: binding.bindingName,
			class_name: binding.className,
			script_name: scriptNameForWorker(binding.ownerWorker, envName),
		}));
};

const getExpectedQueueProducers = (
	topology: IWorkerTopology,
	workerId: TWorkerId,
	envName: TDeployEnvName,
) => {
	return topology.queueProducerBindings
		.filter((binding) => binding.producerWorker === workerId)
		.map((binding) => {
			const queue = topology.queues.find((item) => item.id === binding.queueId);
			if (!queue) {
				throw new Error(`Queue ${binding.queueId} is not defined in topology.`);
			}
			return {
				binding: binding.bindingName,
				queue: queue.queueName[envName],
			};
		});
};

const getExpectedQueueConsumers = (
	topology: IWorkerTopology,
	workerId: TWorkerId,
	envName: TDeployEnvName,
) => {
	return topology.queues
		.filter((queue) => queue.consumerWorker === workerId)
		.map((queue) => ({
			queue: queue.queueName[envName],
		}));
};

const getExpectedD1Bindings = (
	topology: IWorkerTopology,
	workerId: TWorkerId,
	envName: TDeployEnvName,
) => {
	return topology.d1
		.filter((resource) => resource.consumerWorkers.includes(workerId))
		.map((resource) => ({
			binding: resource.bindingName,
			database_name: resource.databaseName[envName],
			database_id: resource.databaseId[envName],
		}));
};

const getExpectedR2Bindings = (
	topology: IWorkerTopology,
	workerId: TWorkerId,
	envName: TDeployEnvName,
) => {
	return topology.r2
		.filter((resource) => resource.consumerWorkers.includes(workerId))
		.map((resource) => ({
			binding: resource.bindingName,
			bucket_name: resource.bucketName[envName],
		}));
};

const getExpectedKvBindings = (
	topology: IWorkerTopology,
	workerId: TWorkerId,
	envName: TDeployEnvName,
) => {
	return topology.kv
		.filter((resource) => resource.consumerWorkers.includes(workerId))
		.map((resource) => ({
			id: resource.namespaceId[envName],
			binding: resource.bindingName,
		}));
};

const getExpectedVars = (
	topology: IWorkerTopology,
	workerId: TWorkerId,
	envName: TDeployEnvName,
) => {
	const vars = new Map<string, string>();

	for (const globalVar of topology.globalVars) {
		vars.set(globalVar.name, globalVar.values[envName]);
	}

	for (const workerVar of topology.workerVars) {
		if (workerVar.worker === workerId) {
			vars.set(workerVar.name, workerVar.values[envName]);
		}
	}

	return Object.fromEntries(
		[...vars.entries()].sort(([left], [right]) => left.localeCompare(right)),
	);
};

const buildOwnedDurableObjects = (durableObjects: IDurableObjectClass[]) => {
	return durableObjects.map((durableObject) => ({
		name: durableObject.bindingName,
		class_name: durableObject.className,
	}));
};

const compareExactList = (
	issues: ICheckIssue[],
	filePath: string,
	source: string,
	expected: unknown[],
	actual: unknown[],
) => {
	if (
		toJson(normalizeList(expected.map((item) => toJson(item)))) ===
		toJson(normalizeList(actual.map((item) => toJson(item))))
	) {
		return;
	}

	addIssue(
		issues,
		filePath,
		`${source} ${toJson(expected)}`,
		`${source} ${toJson(actual)}`,
		source,
	);
};

const compareExpectedRecordSubset = (
	issues: ICheckIssue[],
	filePath: string,
	source: string,
	expected: Record<string, string>,
	actual: Record<string, string>,
) => {
	const actualSubset = Object.fromEntries(
		Object.keys(expected)
			.sort((left, right) => left.localeCompare(right))
			.map((key) => [key, actual[key] ?? '(missing)']),
	);

	if (toJson(expected) === toJson(actualSubset)) {
		return;
	}

	addIssue(
		issues,
		filePath,
		`${source} ${toJson(expected)}`,
		`${source} ${toJson(actualSubset)}`,
		source,
	);
};

const getActualWorkersDev = (
	config: {
		workers_dev?: boolean;
		env?: Partial<Record<TEnvName, { workers_dev?: boolean }>>;
	},
	envName: TDeployEnvName,
) => {
	const envWorkersDev = config.env?.[envName]?.workers_dev;
	if (envWorkersDev !== undefined) {
		return envWorkersDev;
	}

	return config.workers_dev;
};

const checkPlatformProfile = (
	topology: IWorkerTopology,
	issues: ICheckIssue[],
	filePath: string,
	worker: IWorkerMeta,
	config: {
		compatibility_date?: string;
		compatibility_flags?: string[];
		account_id?: string;
		workers_dev?: boolean;
		env?: Partial<Record<TEnvName, { workers_dev?: boolean }>>;
	},
) => {
	if (config.compatibility_date !== topology.platform.compatibilityDate) {
		addIssue(
			issues,
			filePath,
			`compatibility_date ${topology.platform.compatibilityDate}`,
			`compatibility_date ${config.compatibility_date ?? '(missing)'}`,
			'topology.platform.compatibilityDate',
		);
	}

	const expectedFlags = normalizeList(topology.platform.compatibilityFlags);
	const actualFlags = normalizeList(config.compatibility_flags ?? []);
	if (toJson(expectedFlags) !== toJson(actualFlags)) {
		addIssue(
			issues,
			filePath,
			`compatibility_flags ${toJson(expectedFlags)}`,
			`compatibility_flags ${toJson(actualFlags)}`,
			'topology.platform.compatibilityFlags',
		);
	}

	const expectedAccountIds = normalizeList(
		deployEnvironments
			.map((envName) => topology.platform.accountIdByEnv[envName])
			.filter((value): value is string => Boolean(value)),
	);
	const actualAccountId = config.account_id ?? '(missing)';
	if (
		expectedAccountIds.length > 0 &&
		!expectedAccountIds.every((value) => value === actualAccountId)
	) {
		addIssue(
			issues,
			filePath,
			`account_id ${expectedAccountIds[0]}`,
			`account_id ${actualAccountId}`,
			'topology.platform.accountIdByEnv',
		);
	}

	const expectedWorkersDev = normalizeList(
		deployEnvironments
			.map((envName) => worker.workersDevByEnv[envName])
			.filter((value): value is boolean => value !== undefined)
			.map((value) => String(value)),
	);
	const actualWorkersDev = normalizeList(
		deployEnvironments
			.map((envName) => getActualWorkersDev(config, envName))
			.filter((value): value is boolean => value !== undefined)
			.map((value) => String(value)),
	);
	if (
		expectedWorkersDev.length > 0 &&
		toJson(expectedWorkersDev) !== toJson(actualWorkersDev)
	) {
		addIssue(
			issues,
			filePath,
			`workers_dev ${toJson(expectedWorkersDev)}`,
			`workers_dev ${toJson(actualWorkersDev)}`,
			'topology.workers[].workersDevByEnv',
		);
	}

	if (config.compatibility_date && worker.entry.length === 0) {
		throw new Error(`Worker ${worker.id} entry is invalid.`);
	}
};

export const checkWorkerTopology = async (
	topology: IWorkerTopology,
	options: {
		rootDir?: string;
	} = {},
) => {
	const issues: ICheckIssue[] = [];

	for (const worker of topology.workers) {
		const relativeFilePath = `${worker.dir}/wrangler.jsonc`;
		const { filePath, config } = await readWranglerConfig(relativeFilePath, {
			rootDir: options.rootDir,
		});

		checkPlatformProfile(topology, issues, filePath, worker, config);

		for (const envName of deployEnvironments) {
			const envConfig = config.env?.[envName] ?? {};
			const envLabel = `env.${envName}`;

			compareExactList(
				issues,
				filePath,
				`topology.serviceBindings -> ${envLabel}.services`,
				getExpectedServiceBindings(topology, worker.id, envName),
				envConfig.services ?? [],
			);

			compareExactList(
				issues,
				filePath,
				`topology.externalDurableObjectBindings -> ${envLabel}.durable_objects.bindings`,
				getExpectedExternalDurableObjectBindings(topology, worker.id, envName),
				(envConfig.durable_objects?.bindings ?? []).filter(
					(binding) => binding.script_name !== undefined,
				),
			);

			compareExactList(
				issues,
				filePath,
				`topology.durableObjects -> ${envLabel}.durable_objects.bindings`,
				buildOwnedDurableObjects(
					topology.durableObjects.filter(
						(durableObject) => durableObject.ownerWorker === worker.id,
					),
				),
				(envConfig.durable_objects?.bindings ?? []).filter(
					(binding) => binding.script_name === undefined,
				),
			);

			compareExactList(
				issues,
				filePath,
				`topology.queueProducerBindings -> ${envLabel}.queues.producers`,
				getExpectedQueueProducers(topology, worker.id, envName),
				envConfig.queues?.producers ?? [],
			);

			compareExactList(
				issues,
				filePath,
				`topology.queues -> ${envLabel}.queues.consumers`,
				getExpectedQueueConsumers(topology, worker.id, envName),
				(envConfig.queues?.consumers ?? []).map((consumer) => ({
					queue: consumer.queue,
				})),
			);

			compareExactList(
				issues,
				filePath,
				`topology.d1 -> ${envLabel}.d1_databases`,
				getExpectedD1Bindings(topology, worker.id, envName),
				envConfig.d1_databases ?? [],
			);

			compareExactList(
				issues,
				filePath,
				`topology.r2 -> ${envLabel}.r2_buckets`,
				getExpectedR2Bindings(topology, worker.id, envName),
				envConfig.r2_buckets ?? [],
			);

			compareExactList(
				issues,
				filePath,
				`topology.kv -> ${envLabel}.kv_namespaces`,
				getExpectedKvBindings(topology, worker.id, envName),
				envConfig.kv_namespaces ?? [],
			);

			compareExpectedRecordSubset(
				issues,
				filePath,
				`topology.globalVars/workerVars -> ${envLabel}.vars`,
				getExpectedVars(topology, worker.id, envName),
				envConfig.vars ?? {},
			);
		}
	}

	return issues;
};

export const formatCheckIssues = (issues: ICheckIssue[]) => {
	return issues.map((issue) => {
		const relativePath =
			path.relative(process.cwd(), issue.filePath) || issue.filePath;
		return [
			`[worker-topology] mismatch in ${relativePath}`,
			`  expected ${issue.expected}`,
			`  actual   ${issue.actual}`,
			`  source   ${issue.source}`,
		].join('\n');
	});
};

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);

export const runCheckWorkerTopologyCli = async (
	argv = process.argv.slice(2),
) => {
	const configArgs = extractToolingConfigArgs(argv);
	const context = await loadWorkersToolingConfig(configArgs);
	const issues = await checkWorkerTopology(context.topology, context);
	if (issues.length === 0) {
		console.log('[worker-topology] OK');
		return;
	}

	for (const message of formatCheckIssues(issues)) {
		console.error(message);
	}
	process.exitCode = 1;
};

if (isDirectExecution) {
	runCheckWorkerTopologyCli().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[worker-topology] ${message}`);
		process.exit(1);
	});
}
