import { describe, expect, it, vi } from 'vitest';
import { CloudflareKVStore } from '../src/cloudflare-kv-store';

const createMockNamespace = (): KVNamespace => ({
	get: vi.fn(),
	put: vi.fn(),
	delete: vi.fn(),
	list: vi.fn(),
	getWithMetadata: vi.fn(),
});

describe('CloudflareKVStore', () => {
	it('should get a text value', async () => {
		const ns = createMockNamespace();
		vi.mocked(ns.get).mockResolvedValue('hello');

		const store = new CloudflareKVStore(ns);
		const result = await store.get('my-key');

		expect(result).toBe('hello');
		expect(ns.get).toHaveBeenCalledWith('my-key', 'text');
	});

	it('should return null for missing text key', async () => {
		const ns = createMockNamespace();
		vi.mocked(ns.get).mockResolvedValue(null);

		const store = new CloudflareKVStore(ns);
		const result = await store.get('missing');

		expect(result).toBeNull();
	});

	it('should get a json value', async () => {
		const ns = createMockNamespace();
		const data = { keys: [{ kty: 'RSA' }] };
		vi.mocked(ns.get).mockResolvedValue(data as never);

		const store = new CloudflareKVStore(ns);
		const result = await store.get<{ keys: { kty: string }[] }>(
			'jwks_cache',
			'json',
		);

		expect(result).toEqual(data);
		expect(ns.get).toHaveBeenCalledWith('jwks_cache', 'json');
	});

	it('should put a value without options', async () => {
		const ns = createMockNamespace();
		vi.mocked(ns.put).mockResolvedValue(undefined);

		const store = new CloudflareKVStore(ns);
		await store.put('key', 'value');

		expect(ns.put).toHaveBeenCalledWith('key', 'value', undefined);
	});

	it('should put a value with expirationTtl', async () => {
		const ns = createMockNamespace();
		vi.mocked(ns.put).mockResolvedValue(undefined);

		const store = new CloudflareKVStore(ns);
		await store.put('key', 'value', { expirationTtl: 3600 });

		expect(ns.put).toHaveBeenCalledWith('key', 'value', {
			expirationTtl: 3600,
		});
	});

	it('should delete a key', async () => {
		const ns = createMockNamespace();
		vi.mocked(ns.delete).mockResolvedValue(undefined);

		const store = new CloudflareKVStore(ns);
		await store.delete('key');

		expect(ns.delete).toHaveBeenCalledWith('key');
	});

	it('should list keys', async () => {
		const ns = createMockNamespace();
		vi.mocked(ns.list).mockResolvedValue({
			keys: [
				{ name: 'key1', expiration: 1000 },
				{ name: 'key2' },
			],
			list_complete: true,
			cursor: '',
			cacheStatus: null,
		} as never);

		const store = new CloudflareKVStore(ns);
		const result = await store.list({ prefix: 'key' });

		expect(result).toEqual({
			keys: [
				{ name: 'key1', expiration: 1000 },
				{ name: 'key2', expiration: undefined },
			],
			list_complete: true,
			cursor: undefined,
		});
		expect(ns.list).toHaveBeenCalledWith({ prefix: 'key' });
	});

	it('should list keys with cursor for pagination', async () => {
		const ns = createMockNamespace();
		vi.mocked(ns.list).mockResolvedValue({
			keys: [{ name: 'key3' }],
			list_complete: false,
			cursor: 'next-cursor',
			cacheStatus: null,
		} as never);

		const store = new CloudflareKVStore(ns);
		const result = await store.list({
			prefix: 'key',
			limit: 1,
			cursor: 'prev-cursor',
		});

		expect(result.list_complete).toBe(false);
		expect(result.cursor).toBe('next-cursor');
		expect(ns.list).toHaveBeenCalledWith({
			prefix: 'key',
			limit: 1,
			cursor: 'prev-cursor',
		});
	});
});
