export interface IKVListResult {
	keys: { name: string; expiration?: number }[];
	list_complete: boolean;
	cursor?: string;
}

export interface IKVStore {
	get(key: string): Promise<string | null>;
	get<T>(key: string, type: 'json'): Promise<T | null>;

	put(
		key: string,
		value: string,
		options?: {
			expirationTtl?: number;
		},
	): Promise<void>;

	delete(key: string): Promise<void>;

	list(options?: {
		prefix?: string;
		limit?: number;
		cursor?: string;
	}): Promise<IKVListResult>;
}
