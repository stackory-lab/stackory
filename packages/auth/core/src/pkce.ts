// crypto.subtle + crypto.randomUUID are available in browsers, Node 18+,
// and Cloudflare Workers — no environment-specific polyfills needed.

const toBase64Url = (input: ArrayBuffer) =>
	btoa(String.fromCharCode(...new Uint8Array(input)))
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replaceAll('=', '');

export const createRandomString = () => crypto.randomUUID().replaceAll('-', '');

export const createCodeChallenge = async (
	codeVerifier: string,
): Promise<string> => {
	const digest = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(codeVerifier),
	);
	return toBase64Url(digest);
};
