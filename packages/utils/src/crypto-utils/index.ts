const hex = (data: ArrayBuffer | Uint8Array): string => {
	const u8 = data instanceof Uint8Array ? data : new Uint8Array(data);
	return Array.from(u8)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
};

const sha256Hex = async (data: string | Uint8Array | ArrayBuffer) => {
	const msgData =
		typeof data === 'string' ? new TextEncoder().encode(data) : data;
	const hashBuffer = await crypto.subtle.digest('SHA-256', msgData as any);
	return hex(hashBuffer);
};

const signCore = async (
	secret: string | Uint8Array,
	parts: (string | number | undefined | null)[],
	separator: string,
): Promise<ArrayBuffer> => {
	const encoder = new TextEncoder();

	// 1. 处理密钥：支持 String 和 Uint8Array
	// 如果是链式调用，传入的 secret 已经是 Uint8Array 了，直接用，不要 encode
	const keyData = typeof secret === 'string' ? encoder.encode(secret) : secret;

	const cryptoKey = await crypto.subtle.importKey(
		'raw',
		keyData as any,
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);

	const payloadStr = parts
		.filter((p) => p !== undefined && p !== null)
		.map((p) => String(p))
		.join(separator);

	return await crypto.subtle.sign(
		'HMAC',
		cryptoKey,
		encoder.encode(payloadStr),
	);
};

const hmacRaw = async (
	secret: string | Uint8Array,
	parts: (string | number | undefined | null)[],
	separator: string = '', // 注意：链式签名通常不需要分隔符，默认设为空更安全
): Promise<Uint8Array> => {
	const buffer = await signCore(secret, parts, separator);
	return new Uint8Array(buffer);
};

const hmac = async (
	secret: string | Uint8Array,
	parts: (string | number | undefined | null)[],
	separator: string = '|',
): Promise<string> => {
	const buffer = await signCore(secret, parts, separator);
	return hex(buffer);
};

const timingSafeEqual = (a: string, b: string) => {
	if (a.length !== b.length) return false; // 长度必须先一致
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) {
		mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
	}
	return mismatch === 0;
};

const signHmacToken = async (
	payload: object,
	secret: string,
	ttlSeconds: number,
): Promise<string> => {
	const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
	const encoded = btoa(JSON.stringify({ ...payload, exp }));
	const sig = await hmac(secret, [encoded]);
	return `${encoded}.${sig}`;
};

const verifyHmacToken = async <T extends object>(
	token: string,
	secret: string,
): Promise<T & { exp?: number }> => {
	const dotIndex = token.lastIndexOf('.');
	if (dotIndex === -1) {
		throw new Error('invalid token format');
	}
	const encoded = token.slice(0, dotIndex);
	const sigHex = token.slice(dotIndex + 1);
	const expected = await hmac(secret, [encoded]);
	if (!timingSafeEqual(expected, sigHex)) {
		throw new Error('invalid token signature');
	}
	const payload = JSON.parse(atob(encoded)) as T & { exp?: number };
	if (
		payload.exp !== undefined &&
		payload.exp < Math.floor(Date.now() / 1000)
	) {
		throw new Error('token expired');
	}
	return payload;
};

export default {
	hex,
	sha256Hex,
	hmac,
	hmacRaw,
	signCore,
	timingSafeEqual,
	signHmacToken,
	verifyHmacToken,
};
