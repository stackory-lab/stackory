export type TEnvName = 'local' | 'staging' | 'production';

export type TWorkerId = string;

export interface IEnvValue<T> {
	local?: T;
	staging: T;
	production: T;
}

export interface IPlatformProfile {
	compatibilityDate: string;
	compatibilityFlags: string[];
	accountIdByEnv: Partial<Record<TEnvName, string>>;
}

export interface IWorkerMeta {
	id: TWorkerId;
	dir: `workers/${string}`;
	entry: `src/${string}.ts`;
	devPort: number;
	deploy?: IWorkerDeployConfig;
	workersDevByEnv: Partial<Record<TEnvName, boolean>>;
	localVarsFiles: string[];
	requiredSecrets: string[];
}

export interface IWorkerDeployConfig {
	command?: string;
	args?: string[];
	cwd?: string;
	packageName?: string;
	requirePackageScript?: boolean;
}

export interface IDurableObjectClass {
	bindingName: string;
	className: string;
	ownerWorker: TWorkerId;
	migrationTags: string[];
}

export interface IExternalDurableObjectBinding {
	consumerWorker: TWorkerId;
	ownerWorker: TWorkerId;
	bindingName: string;
	className: string;
}

export interface IServiceBinding {
	fromWorker: TWorkerId;
	toWorker: TWorkerId;
	bindingName: string;
}

export interface IQueueResource {
	id: string;
	queueName: IEnvValue<string>;
	consumerWorker: TWorkerId;
}

export interface IQueueProducerBinding {
	producerWorker: TWorkerId;
	bindingName: string;
	queueId: string;
}

export interface ID1Resource {
	id: string;
	bindingName: string;
	databaseName: IEnvValue<string>;
	databaseId: IEnvValue<string>;
	ownerWorker: TWorkerId;
	consumerWorkers: TWorkerId[];
}

export interface ILocalD1MigrationPreset {
	applyMode?: 'direct' | 'materialize';
	databaseName: string;
	defaultWorkerDir: string;
	migrationsDir: string;
}

export interface IR2Resource {
	id: string;
	bindingName: string;
	bucketName: IEnvValue<string>;
	ownerWorker: TWorkerId;
	consumerWorkers: TWorkerId[];
}

export interface IKvResource {
	id: string;
	bindingName: string;
	namespaceId: IEnvValue<string>;
	consumerWorkers: TWorkerId[];
}

export interface IGlobalVarBinding {
	name: string;
	values: IEnvValue<string>;
}

export interface IWorkerVarBinding {
	worker: TWorkerId;
	name: string;
	values: IEnvValue<string>;
}

export interface IWorkerTopology {
	platform: IPlatformProfile;
	workers: IWorkerMeta[];
	durableObjects: IDurableObjectClass[];
	externalDurableObjectBindings: IExternalDurableObjectBinding[];
	serviceBindings: IServiceBinding[];
	queues: IQueueResource[];
	queueProducerBindings: IQueueProducerBinding[];
	d1: ID1Resource[];
	d1MigrationPresets?: Record<string, ILocalD1MigrationPreset>;
	r2: IR2Resource[];
	kv: IKvResource[];
	globalVars: IGlobalVarBinding[];
	workerVars: IWorkerVarBinding[];
}
