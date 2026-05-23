import { cryptoUtils } from '@stackory/utils';
import {
	buildSignedInternalHeadersString,
	computeInternalSignature,
	SIGNATURE_SKIP_BODY_PAYLOAD,
} from '../call-internal';

/**
 * 验证内部调用签名（供 Durable Object fetch 处理器直接调用）
 *
 * 与 createInternalAuthMiddleware 使用相同的签名规则，但适用于不经过 Hono 的 DO fetch 处理器。
 * 验证失败时抛出 Error，调用方应将其转为 401/403 响应。
 */
export const verifyInternalRequest = async (
	request: Request,
	secret: string,
	maxTimeDiffMs = 60_000,
): Promise<void> => {
	const signature = request.headers.get('X-Internal-Signature');
	const timestamp = request.headers.get('X-Internal-Timestamp');
	const skipBody = request.headers.get('X-Internal-Skip-Body');

	if (!signature || !timestamp) {
		throw new Error('missing_internal_auth_headers');
	}

	const reqTime = parseInt(timestamp, 10);
	if (Number.isNaN(reqTime) || Math.abs(Date.now() - reqTime) > maxTimeDiffMs) {
		throw new Error('internal_request_expired');
	}

	const url = new URL(request.url);
	let bodyStr = '';
	if (skipBody === 'true') {
		bodyStr = SIGNATURE_SKIP_BODY_PAYLOAD;
	} else if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
		bodyStr = await request.clone().text();
	}

	const expected = await computeInternalSignature({
		secret,
		method: request.method,
		path: url.pathname + url.search,
		timestamp,
		bodyStr,
		headersStr: buildSignedInternalHeadersString(request.headers),
	});

	if (!cryptoUtils.timingSafeEqual(expected, signature)) {
		throw new Error('internal_request_invalid_signature');
	}
};
