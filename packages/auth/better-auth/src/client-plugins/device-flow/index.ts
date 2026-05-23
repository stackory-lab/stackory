import type { BetterAuthClientPlugin } from 'better-auth/client';
import type { deviceFlowPlugin } from '../../server-plugins';

export const deviceFlowClient = () => {
	return {
		id: 'device-flow-client-plugin',
		pathMethods: {
			'/device/code': 'POST',
			'/device/token': 'POST',
			'/device/info': 'GET',
			'/device/approve': 'POST',
			'/device/deny': 'POST',
			'/device': 'GET',
		},
		$InferServerPlugin: {} as ReturnType<typeof deviceFlowPlugin>,
	} satisfies BetterAuthClientPlugin;
};
