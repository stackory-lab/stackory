import type { IRequestInterceptor } from '@stackory/backend-platform';
import { signInternalRequest } from '../sign-internal-request';

export const createHmacSigningInterceptor = (
	getSecret: () => Promise<string>,
): IRequestInterceptor => ({
	intercept: async (_serviceName, request) => {
		const secret = await getSecret();
		return signInternalRequest(request, secret);
	},
});
