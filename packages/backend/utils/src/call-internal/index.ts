import { cryptoUtils } from '@stackory/utils';

export const SIGNATURE_SKIP_BODY_PAYLOAD = '__SKIP_BODY_SIGNATURE__';
export const INTERNAL_SIGNED_AUTH_HEADER_NAMES = [
	'x-auth-aud',
	'x-auth-client-id',
	'x-auth-scope',
	'x-auth-sub',
	'x-user-id',
] as const;

export const buildSignedInternalHeadersString = (headers: Headers) => {
	const entries: Array<[string, string]> = [];
	for (const key of INTERNAL_SIGNED_AUTH_HEADER_NAMES) {
		const value = headers.get(key);
		if (!value) {
			continue;
		}

		entries.push([key, value]);
	}

	return entries
		.sort(([left], [right]) => left.localeCompare(right))
		.map(([key, value]) => `${key}:${value}`)
		.join('\n');
};

/**
 * 计算内部调用签名
 */
export const computeInternalSignature = async (params: {
	secret: string;
	method: string;
	path: string;
	timestamp: string;
	bodyStr: string;
	headersStr: string;
}) => {
	// 签名规则必须与接收方 Middleware 严格一致：
	// [Method, Path, Timestamp, Body, SignedHeaders]
	return cryptoUtils.hmac(params.secret, [
		params.method.toUpperCase(),
		params.path, // 注意：如果你的 Path 带 Query Params，这里需要保持一致
		params.timestamp,
		params.bodyStr,
		params.headersStr,
	]);
};
