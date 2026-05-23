import {
	buildSignedInternalHeadersString,
	computeInternalSignature,
	SIGNATURE_SKIP_BODY_PAYLOAD,
} from '../call-internal';

/**
 * 为 Request 添加内部调用 HMAC 签名头（供直接调用 stub.fetch() 的发送方使用）
 *
 * 与 createHmacSigningInterceptor 使用相同的签名规则，但适用于不经过
 * IServiceCaller 的场景（如 Durable Object stub 直接调用）。
 */
export const signInternalRequest = async (
	request: Request,
	secret: string,
): Promise<Request> => {
	const url = new URL(request.url);
	const timestamp = Date.now().toString();
	const contentType = request.headers.get('Content-Type') || '';

	const shouldSkipBody =
		request.body instanceof ReadableStream &&
		(contentType.includes('multipart/form-data') ||
			contentType.includes('application/octet-stream'));

	const bodyStr = shouldSkipBody
		? SIGNATURE_SKIP_BODY_PAYLOAD
		: await request.clone().text();
	const headersStr = buildSignedInternalHeadersString(request.headers);

	const signature = await computeInternalSignature({
		secret,
		method: request.method,
		path: url.pathname + url.search,
		timestamp,
		bodyStr,
		headersStr,
	});

	const signed = new Request(request);
	signed.headers.set('X-Internal-Signature', signature);
	signed.headers.set('X-Internal-Timestamp', timestamp);
	if (shouldSkipBody) {
		signed.headers.set('X-Internal-Skip-Body', 'true');
	}
	return signed;
};
