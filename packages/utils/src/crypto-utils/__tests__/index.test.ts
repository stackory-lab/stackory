import { beforeAll, describe, expect, it } from 'vitest';
import cryptoUtils from '../index';

beforeAll(() => {
	if (!(globalThis as any).crypto) {
		// import { webcrypto } from 'node:crypto';
		// globalThis.crypto = webcrypto as any;
		console.warn('Current environment does not support global crypto!');
	}
});

describe('Crypto Utils', () => {
	const { hex, hmac, hmacRaw, timingSafeEqual } = cryptoUtils;
	const SECRET = 'test-secret-key';

	describe('hex()', () => {
		it('should convert Uint8Array to hex string correctly', () => {
			const input = new Uint8Array([0, 255, 16, 10]); // 00, ff, 10, 0a
			expect(hex(input)).toBe('00ff100a');
		});

		it('should handle ArrayBuffer input', () => {
			const input = new Uint8Array([1, 2, 3]).buffer;
			expect(hex(input)).toBe('010203');
		});
	});

	describe('hmac()', () => {
		it('should generate a valid SHA-256 hex string (64 chars)', async () => {
			const signature = await hmac(SECRET, ['GET', '/api/test']);
			expect(signature).toMatch(/^[a-f0-9]{64}$/);
		});

		it('should be deterministic (same input -> same output)', async () => {
			const sig1 = await hmac(SECRET, ['data']);
			const sig2 = await hmac(SECRET, ['data']);
			expect(sig1).toBe(sig2);
		});

		it('should produce different signatures for different secrets', async () => {
			const sig1 = await hmac('secret-A', ['data']);
			const sig2 = await hmac('secret-B', ['data']);
			expect(sig1).not.toBe(sig2);
		});
	});

	describe('Security: Separator Logic', () => {
		it('should prevent canonicalization collisions using default separator', async () => {
			// 场景：如果没有分隔符，['abc', 'd'] 和 ['ab', 'cd'] 拼起来都是 'abcd'
			// 但 hmac 默认使用 '|'，所以内部是 'abc|d' vs 'ab|cd'
			const sig1 = await hmac(SECRET, ['abc', 'd']);
			const sig2 = await hmac(SECRET, ['ab', 'cd']);
			expect(sig1).not.toBe(sig2);
		});

		it('should allow custom separator', async () => {
			// 显式指定分隔符为空字符串，模拟碰撞
			const sig1 = await hmac(SECRET, ['abc', 'd'], '');
			const sig2 = await hmac(SECRET, ['ab', 'cd'], '');
			// 这次应该相等，因为拼出来都是 "abcd"
			expect(sig1).toBe(sig2);
		});
	});

	describe('hmacRaw() vs hmac()', () => {
		it('should return Uint8Array of length 32 (SHA-256)', async () => {
			const raw = await hmacRaw(SECRET, ['test']);
			expect(raw).toBeInstanceOf(Uint8Array);
			expect(raw.byteLength).toBe(32);
		});

		it('should match the hex output when converted', async () => {
			const raw = await hmacRaw(SECRET, ['consistency-check']);
			const hexStr = await hmac(SECRET, ['consistency-check']);

			expect(hex(raw)).toBe(hexStr);
		});
	});

	describe('Chain Signature (AWS Style Key Derivation)', () => {
		it('should support using Uint8Array as secret key for next step', async () => {
			const date = '20231001';
			const region = 'us-east-1';
			const service = 's3';

			// 1. 模拟链式派生：kDate -> kRegion -> kService
			// 注意：标准 AWS 流程中 key derivation 通常不使用分隔符
			const kDate = await hmacRaw('AWS4' + SECRET, [date], '');
			const kRegion = await hmacRaw(kDate, [region], '');
			const kService = await hmacRaw(kRegion, [service], '');

			expect(kDate).toBeInstanceOf(Uint8Array);
			expect(kRegion).toBeInstanceOf(Uint8Array);

			// 2. 验证最终步可以用 hmac 输出 Hex
			const signingKey = await hmac(kService, ['aws4_request'], '');
			expect(signingKey).toMatch(/^[a-f0-9]{64}$/);
		});

		it('should fail if intermediate hex string is used instead of raw bytes', async () => {
			const date = '20231001';

			// 正确：使用 Raw Bytes
			const step1Raw = await hmacRaw(SECRET, [date], '');
			const step2Correct = await hmac(step1Raw, ['region'], '');

			// 错误：使用 Hex String 当做 Key
			const step1Hex = await hmac(SECRET, [date], '');
			const step2Wrong = await hmac(step1Hex, ['region'], '');

			expect(step2Correct).not.toBe(step2Wrong);
		});
	});

	describe('signHmacToken() / verifyHmacToken()', () => {
		const { signHmacToken, verifyHmacToken } = cryptoUtils;
		const SECRET = 'token-secret';
		const TTL = 60;

		it('should produce a token with two parts separated by a dot', async () => {
			const token = await signHmacToken(
				{ roomId: 'r1', userId: 'u1' },
				SECRET,
				TTL,
			);
			expect(token.split('.').length).toBe(2);
		});

		it('should verify a valid token and return the original payload', async () => {
			const token = await signHmacToken(
				{ roomId: 'r1', userId: 'u1' },
				SECRET,
				TTL,
			);
			const payload = await verifyHmacToken<{ roomId: string; userId: string }>(
				token,
				SECRET,
			);
			expect(payload.roomId).toBe('r1');
			expect(payload.userId).toBe('u1');
			expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
		});

		it('should reject a token signed with a different secret', async () => {
			const token = await signHmacToken({ roomId: 'r1' }, SECRET, TTL);
			await expect(verifyHmacToken(token, 'wrong-secret')).rejects.toThrow(
				'invalid token signature',
			);
		});

		it('should reject a tampered payload', async () => {
			const token = await signHmacToken({ roomId: 'r1' }, SECRET, TTL);
			const [, sig] = token.split('.');
			const tamperedPayload = btoa(
				JSON.stringify({ roomId: 'r2', exp: 9999999999 }),
			);
			await expect(
				verifyHmacToken(`${tamperedPayload}.${sig}`, SECRET),
			).rejects.toThrow('invalid token signature');
		});

		it('should reject an expired token', async () => {
			const token = await signHmacToken({ userId: 'u1' }, SECRET, -1);
			await expect(verifyHmacToken(token, SECRET)).rejects.toThrow(
				'token expired',
			);
		});

		it('should verify a token without exp field (non-expiring)', async () => {
			const encoded = btoa(JSON.stringify({ userId: 'u1' }));
			const sig = await hmac(SECRET, [encoded]);
			const token = `${encoded}.${sig}`;
			const payload = await verifyHmacToken<{ userId: string }>(token, SECRET);
			expect(payload.userId).toBe('u1');
			expect(payload.exp).toBeUndefined();
		});

		it('should reject a malformed token without a dot', async () => {
			await expect(verifyHmacToken('notavalidtoken', SECRET)).rejects.toThrow(
				'invalid token format',
			);
		});
	});

	describe('timingSafeEqual()', () => {
		it('should return true for identical strings', () => {
			expect(timingSafeEqual('abcdef', 'abcdef')).toBe(true);
		});

		it('should return false for different strings', () => {
			expect(timingSafeEqual('abcdef', 'abcdeG')).toBe(false);
		});

		it('should return false for different lengths', () => {
			expect(timingSafeEqual('abc', 'abcd')).toBe(false);
		});
	});
});
