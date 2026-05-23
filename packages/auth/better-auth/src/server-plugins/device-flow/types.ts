export const DEVICE_AUTHORIZATION_STATUSES = [
	'pending',
	'approving',
	'approved',
	'consuming',
	'consumed',
	'denied',
	'expired',
	'failed',
] as const;

export type IDeviceAuthorizationStatus =
	(typeof DEVICE_AUTHORIZATION_STATUSES)[number];

export interface IDeviceFlowOptions {
	verificationUri: string;
	codeTtlSec?: number;
	defaultIntervalSec?: number;
	allowedClientIds?: string[];
	defaultResources?: string[];
	validResources?: string[];
	issueAuthorizationCode?: IIssueAuthorizationCode;
	issueAccessToken?: IIssueAccessToken;
}

export interface INormalizedDeviceFlowOptions {
	codeTtlSec: number;
	defaultIntervalSec: number;
	allowedClientIds: string[];
	verificationUri: string;
	defaultResources: string[];
	validResources: string[];
	issueAuthorizationCode?: IIssueAuthorizationCode;
	issueAccessToken?: IIssueAccessToken;
}

export interface IDeviceAuthorizationRow {
	id: string;
	deviceCodeHash: string;
	userCode: string;
	clientId: string;
	scopes: string[];
	resource: string[];
	codeChallenge: string;
	codeChallengeMethod: 'S256';
	status: IDeviceAuthorizationStatus;
	userId?: string | null;
	authorizationCode?: string | null;
	pollInterval: number;
	lastPolledAt?: Date | null;
	createdIp?: string | null;
	createdUa?: string | null;
	failureReason?: string | null;
	approvingStartedAt?: Date | null;
	consumingStartedAt?: Date | null;
	expiresAt: Date;
	createdAt: Date;
	decidedAt?: Date | null;
	consumedAt?: Date | null;
	failedAt?: Date | null;
}

export interface IOAuthClientRow {
	clientId: string;
	clientSecret?: string | null;
	disabled?: boolean | null;
	grantTypes?: string[] | null;
	icon?: string | null;
	name?: string | null;
	public?: boolean | null;
	scopes?: string[] | null;
}

export interface IIssueAuthorizationCodeParams {
	clientId: string;
	userId: string;
	scopes: string[];
	resource: string[];
	codeChallenge: string;
	codeChallengeMethod: 'S256';
	headers?: Headers;
}

export type IIssueAuthorizationCode = (
	params: IIssueAuthorizationCodeParams,
) => Promise<string>;

export interface IIssueAccessTokenParams {
	clientId: string;
	authorizationCode: string;
	codeVerifier: string;
	resource: string[];
	headers?: Headers;
}

export interface IAccessTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
	refresh_token?: string;
	scope?: string;
	id_token?: string;
}

export type IIssueAccessToken = (
	params: IIssueAccessTokenParams,
) => Promise<IAccessTokenResponse>;
