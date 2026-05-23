import { createAuthClient } from 'better-auth/client';
import { deviceFlowClient } from '../../client-plugins/device-flow';
import { unwrapBetterAuthResponse } from '../better-auth-client-error';

export interface IDeviceInfoResponse {
	client: {
		client_id: string;
		name: string;
		icon: string | null;
	};
	scopes: string[];
	resource: string[];
	created_ip: string | null;
	created_ua: string | null;
	expires_at: string;
}

export interface IDeviceDecisionResponse {
	status: string;
}

export interface ICreateDeviceActionsParams {
	baseURL?: string;
	basePath?: string;
}

/**
 * UI-facing RPC wrappers for the device flow verification page (e.g. agt-web's
 * `/auth/device` route). Not used by the device flow CLIENT itself — that path
 * uses {@link createDeviceFlowProvider} + {@link createDeviceLogin}.
 */
export const createDeviceActions = ({
	baseURL,
	basePath,
}: ICreateDeviceActionsParams) => {
	const client = createAuthClient({
		baseURL,
		basePath,
		plugins: [deviceFlowClient()],
	});

	return {
		getDeviceInfo: async (params: { userCode: string }) => {
			const result = await client.device.info({
				query: { user_code: params.userCode },
			});

			return unwrapBetterAuthResponse<IDeviceInfoResponse>(
				result,
				'Failed to load device authorization',
			);
		},
		approveDevice: async (params: { userCode: string }) => {
			const result = await client.device.approve({
				user_code: params.userCode,
			});

			return unwrapBetterAuthResponse<IDeviceDecisionResponse>(
				result,
				'Failed to approve device',
			);
		},
		denyDevice: async (params: { userCode: string }) => {
			const result = await client.device.deny({
				user_code: params.userCode,
			});

			return unwrapBetterAuthResponse<IDeviceDecisionResponse>(
				result,
				'Failed to deny device',
			);
		},
	};
};
