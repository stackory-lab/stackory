import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'jsonc-parser';
import type { TEnvName } from './types.js';

export interface IWranglerDurableObjectBinding {
	name: string;
	class_name: string;
	script_name?: string;
}

export interface IWranglerServiceBinding {
	binding: string;
	service: string;
}

export interface IWranglerQueueProducer {
	binding: string;
	queue: string;
}

export interface IWranglerQueueConsumer {
	queue: string;
}

export interface IWranglerD1Binding {
	binding: string;
	database_name: string;
	database_id: string;
}

export interface IWranglerR2Binding {
	binding: string;
	bucket_name: string;
}

export interface IWranglerKvBinding {
	binding: string;
	id: string;
}

export interface IWranglerEnvConfig {
	workers_dev?: boolean;
	durable_objects?: {
		bindings?: IWranglerDurableObjectBinding[];
	};
	services?: IWranglerServiceBinding[];
	queues?: {
		producers?: IWranglerQueueProducer[];
		consumers?: IWranglerQueueConsumer[];
	};
	d1_databases?: IWranglerD1Binding[];
	r2_buckets?: IWranglerR2Binding[];
	kv_namespaces?: IWranglerKvBinding[];
	vars?: Record<string, string>;
}

export interface IWranglerConfig {
	name?: string;
	compatibility_date?: string;
	compatibility_flags?: string[];
	account_id?: string;
	workers_dev?: boolean;
	env?: Partial<Record<TEnvName, IWranglerEnvConfig>>;
}

export const getDefaultRootDir = () => {
	return process.cwd();
};

export const getRepoRoot = () => {
	return getDefaultRootDir();
};

export const readWranglerConfig = async (
	relativeFilePath: string,
	options: {
		rootDir?: string;
	} = {},
) => {
	const filePath = path.join(
		options.rootDir ?? getDefaultRootDir(),
		relativeFilePath,
	);
	const fileContent = await readFile(filePath, 'utf-8');
	const parsed = parse(fileContent);
	return {
		filePath,
		config: parsed as IWranglerConfig,
	};
};
