import type { IKVStore } from './kv-store';
import type { ILogger } from './logger';
import type { IMonitoring } from './monitoring';
import type { IObjectStorage } from './object-storage';
import type { IQueueProducer } from './queue';
import type { IServiceCaller } from './service-caller';

export interface IPlatformServices {
	kv?: Record<string, IKVStore>;
	logger?: ILogger;
	monitoring?: IMonitoring;
	queue?: Record<string, IQueueProducer<unknown>>;
	serviceCaller?: IServiceCaller;
	storage?: Record<string, IObjectStorage>;
}
