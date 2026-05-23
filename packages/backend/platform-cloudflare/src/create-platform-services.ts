import type {
	ILogger,
	IMonitoring,
	IPlatformServices,
	IServiceCaller,
} from '@stackory/backend-platform';
import { CloudflareKVStore } from './cloudflare-kv-store';
import { CloudflareQueueProducer } from './cloudflare-queue-producer';
import { CloudflareR2Storage } from './cloudflare-r2-storage';

export const createCloudflarePlatformServices = (options?: {
	kv?: Record<string, KVNamespace>;
	logger?: ILogger;
	monitoring?: IMonitoring;
	queue?: Record<string, Queue<unknown>>;
	serviceCaller?: IServiceCaller;
	storage?: Record<string, R2Bucket>;
}): IPlatformServices => ({
	kv: options?.kv
		? Object.fromEntries(
				Object.entries(options.kv).map(([key, ns]) => [
					key,
					new CloudflareKVStore(ns),
				]),
			)
		: undefined,
	logger: options?.logger,
	monitoring: options?.monitoring,
	queue: options?.queue
		? Object.fromEntries(
				Object.entries(options.queue).map(([key, queue]) => [
					key,
					new CloudflareQueueProducer(queue),
				]),
			)
		: undefined,
	serviceCaller: options?.serviceCaller,
	storage: options?.storage
		? Object.fromEntries(
				Object.entries(options.storage).map(([key, bucket]) => [
					key,
					new CloudflareR2Storage(bucket),
				]),
			)
		: undefined,
});
