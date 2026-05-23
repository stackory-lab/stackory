import type { IKVListResult, IKVStore } from '@stackory/backend-platform';

export class CloudflareKVStore implements IKVStore {
	constructor(private namespace: KVNamespace) {}

	get(key: string): Promise<string | null>;
	get<T>(key: string, type: 'json'): Promise<T | null>;
	get(key: string, type?: 'json') {
		if (type === 'json') {
			return this.namespace.get(key, 'json');
		}
		return this.namespace.get(key, 'text');
	}

	put = async (
		key: string,
		value: string,
		options?: { expirationTtl?: number },
	) => {
		await this.namespace.put(
			key,
			value,
			options ? { expirationTtl: options.expirationTtl } : undefined,
		);
	};

	delete = async (key: string) => {
		await this.namespace.delete(key);
	};

	list = async (options?: {
		prefix?: string;
		limit?: number;
		cursor?: string;
	}): Promise<IKVListResult> => {
		const result = await this.namespace.list(options);
		return {
			keys: result.keys.map((k) => ({
				name: k.name,
				expiration: k.expiration,
			})),
			list_complete: result.list_complete,
			cursor: result.list_complete ? undefined : result.cursor,
		};
	};
}
