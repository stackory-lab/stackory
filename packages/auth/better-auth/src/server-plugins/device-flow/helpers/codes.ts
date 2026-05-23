const USER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const bytesToBase64Url = (bytes: Uint8Array) => {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}

	return btoa(binary)
		.replaceAll('+', '-')
		.replaceAll('/', '_')
		.replaceAll('=', '');
};

export const generateDeviceCode = () => {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	return bytesToBase64Url(bytes);
};

export const generateUserCode = () => {
	const bytes = new Uint8Array(8);
	crypto.getRandomValues(bytes);
	const chars = Array.from(bytes, (byte) => {
		return USER_CODE_ALPHABET[byte % USER_CODE_ALPHABET.length];
	});

	return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
};

export const normalizeUserCode = (value: string) => {
	return value.replaceAll('-', '').trim().toUpperCase();
};

export const hashDeviceCode = async (deviceCode: string) => {
	const digest = await crypto.subtle.digest(
		'SHA-256',
		new TextEncoder().encode(deviceCode),
	);
	return bytesToBase64Url(new Uint8Array(digest));
};
