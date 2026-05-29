import { access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IWorkerTopology } from './types.js';

export interface IToolingConfigContext {
	configPath?: string;
	rootDir: string;
	topology: IWorkerTopology;
}

export interface IToolingConfigArgs {
	configPath?: string;
	remainingArgs: string[];
	rootDir?: string;
}

const defaultConfigFileNames = [
	'workers-tooling.config.ts',
	'workers-tooling.config.mjs',
	'workers-tooling.config.js',
];

const fileExists = async (filePath: string) => {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
};

const resolveConfigExport = (value: unknown) => {
	if (isWorkerTopology(value)) {
		return value;
	}

	if (
		value &&
		typeof value === 'object' &&
		'topology' in value &&
		isWorkerTopology(value.topology)
	) {
		return value.topology;
	}

	throw new Error(
		'workers-tooling config must export an IWorkerTopology or { topology }.',
	);
};

const isWorkerTopology = (value: unknown): value is IWorkerTopology => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Partial<IWorkerTopology>;
	return Boolean(
		candidate.platform &&
			Array.isArray(candidate.workers) &&
			Array.isArray(candidate.durableObjects) &&
			Array.isArray(candidate.serviceBindings),
	);
};

export const extractToolingConfigArgs = (
	argv: string[],
): IToolingConfigArgs => {
	const remainingArgs: string[] = [];
	let configPath: string | undefined;
	let rootDir: string | undefined;

	for (let index = 0; index < argv.length; index += 1) {
		const token = argv[index];
		if (token === '--config') {
			const value = argv[index + 1];
			if (!value) {
				throw new Error('--config requires a file path');
			}
			configPath = value;
			index += 1;
			continue;
		}
		if (token === '--root') {
			const value = argv[index + 1];
			if (!value) {
				throw new Error('--root requires a directory path');
			}
			rootDir = value;
			index += 1;
			continue;
		}
		remainingArgs.push(token);
	}

	return {
		configPath,
		remainingArgs,
		rootDir,
	};
};

export const loadWorkersToolingConfig = async (
	input: { configPath?: string; rootDir?: string } = {},
): Promise<IToolingConfigContext> => {
	const initialRootDir = input.rootDir
		? path.resolve(input.rootDir)
		: process.cwd();
	const explicitConfigPath = input.configPath
		? path.resolve(initialRootDir, input.configPath)
		: undefined;
	const discoveredConfigPath = explicitConfigPath
		? explicitConfigPath
		: await findConfigPath(initialRootDir);

	if (!discoveredConfigPath) {
		throw new Error(
			`workers-tooling config not found in ${initialRootDir}. Pass --config <path> or create workers-tooling.config.ts.`,
		);
	}

	if (!(await fileExists(discoveredConfigPath))) {
		throw new Error(
			`workers-tooling config not found: ${discoveredConfigPath}`,
		);
	}

	const importedConfig = (await import(
		pathToFileURL(discoveredConfigPath).href
	)) as {
		default?: unknown;
		repoWorkerTopology?: unknown;
		topology?: unknown;
		workerTopology?: unknown;
	};
	const topology = resolveConfigExport(
		importedConfig.default ??
			importedConfig.repoWorkerTopology ??
			importedConfig.topology ??
			importedConfig.workerTopology,
	);

	return {
		configPath: discoveredConfigPath,
		rootDir:
			explicitConfigPath && input.rootDir
				? initialRootDir
				: path.dirname(discoveredConfigPath),
		topology,
	};
};

const findConfigPath = async (startDir: string) => {
	let currentDir = startDir;

	while (true) {
		for (const fileName of defaultConfigFileNames) {
			const filePath = path.join(currentDir, fileName);
			if (await fileExists(filePath)) {
				return filePath;
			}
		}

		const parentDir = path.dirname(currentDir);
		if (parentDir === currentDir) {
			return undefined;
		}
		currentDir = parentDir;
	}
};
