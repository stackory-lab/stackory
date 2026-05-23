import type { IServiceTransport } from '@stackory/backend-platform';
import { timingChaosDelay } from '@stackory/backend-utils';

export const createCloudflareFetcherTransport = (
	bindings: Record<string, Fetcher>,
): IServiceTransport => ({
	fetch: async (serviceName, request) => {
		const service = bindings[serviceName];
		if (!service) {
			throw new Error(`Service binding not found: ${serviceName}`);
		}
		await timingChaosDelay(`cf.service.fetch:${serviceName}`, { maxMs: 3_000 });
		return service.fetch(request);
	},
});
