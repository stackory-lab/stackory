// RFC 8628 §3.1 grant_type value for the device access token request.
export const DEVICE_CODE_GRANT_TYPE =
	'urn:ietf:params:oauth:grant-type:device_code';

/**
 * RFC 8628 §3.5 + RFC 6749 §5.2 error codes that a device flow client may
 * surface to UI / telemetry. Centralized here so server-plugins and client
 * adapters reference the same strings.
 */
export const DEVICE_FLOW_ERROR_CODES = {
	authorizationPending: 'authorization_pending',
	slowDown: 'slow_down',
	accessDenied: 'access_denied',
	expiredToken: 'expired_token',
	invalidGrant: 'invalid_grant',
	invalidClient: 'invalid_client',
	invalidRequest: 'invalid_request',
	unauthorizedClient: 'unauthorized_client',
	invalidScope: 'invalid_scope',
	invalidTarget: 'invalid_target',
} as const;

export type IDeviceFlowErrorCode =
	(typeof DEVICE_FLOW_ERROR_CODES)[keyof typeof DEVICE_FLOW_ERROR_CODES];
