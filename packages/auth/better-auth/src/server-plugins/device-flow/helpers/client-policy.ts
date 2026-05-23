import { DEVICE_CODE_GRANT_TYPE } from '../../../shared/constants';
import type { IOAuthClientRow } from '../types';
import { oauthError } from './oauth-error';

export const splitScope = (scope: string) => {
	return scope
		.split(' ')
		.map((value) => value.trim())
		.filter(Boolean);
};

export const parseResource = (
	resource: string[] | string | undefined,
	defaultResources: string[],
) => {
	if (Array.isArray(resource)) {
		return resource.filter(Boolean);
	}
	if (resource) {
		return [resource];
	}
	return defaultResources;
};

export const assertAllowedClient = (
	client: IOAuthClientRow | null,
	allowedClientIds: string[],
): IOAuthClientRow => {
	if (!client || !allowedClientIds.includes(client.clientId)) {
		throw oauthError(
			'unauthorized_client',
			'Device flow is not allowed for this client',
		);
	}
	if (client.disabled || client.public !== true) {
		throw oauthError(
			'unauthorized_client',
			'Client is not eligible for device flow',
		);
	}
	if (!client.grantTypes?.includes(DEVICE_CODE_GRANT_TYPE)) {
		throw oauthError(
			'unauthorized_client',
			'Client is missing device_code grant',
		);
	}

	return client;
};

export const resolveScopes = (
	requestedScopes: string[],
	clientScopes: string[],
) => {
	const allowed = new Set(clientScopes);
	const granted = requestedScopes.filter((scope) => allowed.has(scope));
	if (granted.length === 0) {
		throw oauthError(
			'invalid_scope',
			'No requested scopes are allowed for this client',
		);
	}

	return granted;
};

export const assertValidResources = (
	resources: string[],
	validResources: string[],
) => {
	const allowed = new Set(validResources);
	if (
		resources.length === 0 ||
		resources.some((resource) => !allowed.has(resource))
	) {
		throw oauthError('invalid_target', 'Requested resource is not allowed');
	}

	return resources;
};
