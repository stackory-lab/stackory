import type { BetterAuthPlugin } from 'better-auth';
import { DEVICE_CODE_GRANT_TYPE } from '../../shared/constants';
import { createDeviceApproveEndpoint } from './endpoints/device-approve';
import { createDeviceCodeEndpoint } from './endpoints/device-code';
import { deviceDeny } from './endpoints/device-deny';
import { deviceInfo } from './endpoints/device-info';
import { createDeviceRedirectEndpoint } from './endpoints/device-redirect';
import { createDeviceTokenEndpoint } from './endpoints/device-token';
import { deviceAuthorizationSchema } from './schema';
import type { IDeviceFlowOptions } from './types';

const DEFAULT_CODE_TTL_SEC = 600;
const DEFAULT_INTERVAL_SEC = 5;

const assertAbsoluteVerificationUri = (verificationUri: string) => {
	try {
		const parsed = new URL(verificationUri);
		if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
			throw new Error('protocol');
		}
	} catch {
		throw new Error(
			`deviceFlowPlugin: verificationUri must be an absolute http(s) URL, got "${verificationUri}"`,
		);
	}
};

export const deviceFlowPlugin = (options: IDeviceFlowOptions) => {
	assertAbsoluteVerificationUri(options.verificationUri);

	const normalizedOptions = {
		codeTtlSec: options.codeTtlSec ?? DEFAULT_CODE_TTL_SEC,
		defaultIntervalSec: options.defaultIntervalSec ?? DEFAULT_INTERVAL_SEC,
		allowedClientIds: options.allowedClientIds ?? [],
		verificationUri: options.verificationUri,
		defaultResources: options.defaultResources ?? [],
		validResources: options.validResources ?? options.defaultResources ?? [],
		issueAuthorizationCode: options.issueAuthorizationCode,
		issueAccessToken: options.issueAccessToken,
	};

	return {
		id: 'device-flow-plugin',
		options: normalizedOptions,
		schema: deviceAuthorizationSchema,
		endpoints: {
			deviceCode: createDeviceCodeEndpoint(normalizedOptions),
			deviceToken: createDeviceTokenEndpoint(normalizedOptions),
			deviceInfo,
			deviceApprove: createDeviceApproveEndpoint(normalizedOptions),
			deviceDeny,
			deviceRedirect: createDeviceRedirectEndpoint(normalizedOptions),
		},
		$Infer: {
			deviceCodeGrantType: DEVICE_CODE_GRANT_TYPE,
		},
	} satisfies BetterAuthPlugin;
};
