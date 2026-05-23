import type { IStorage } from '@common/core-port';

export interface IWebStorageOptions {
	prefix?: string;
}

const readJson = <T>(store: Storage, key: string): T | null => {
	const raw = store.getItem(key);
	if (!raw) return null;
	try {
		return JSON.parse(raw) as T;
	} catch {
		store.removeItem(key);
		return null;
	}
};

const fromWebStorage = <T>(
	store: Storage,
	options: IWebStorageOptions = {},
): IStorage<T> => {
	const prefix = options.prefix ?? '';
	const withPrefix = (key: string) => `${prefix}${key}`;
	const isPrefixedKey = (key: string) => key.startsWith(prefix);
	const stripPrefix = (key: string) => key.slice(prefix.length);

	return {
		get: (key) => readJson<T>(store, withPrefix(key)),
		set: (key, value) => store.setItem(withPrefix(key), JSON.stringify(value)),
		remove: (key) => store.removeItem(withPrefix(key)),
		clear: () => {
			if (!prefix) {
				store.clear();
				return;
			}

			for (const key of Object.keys(store)) {
				if (isPrefixedKey(key)) {
					store.removeItem(key);
				}
			}
		},
		getAllKeys: () =>
			Object.keys(store)
				.filter((key) => isPrefixedKey(key))
				.map((key) => stripPrefix(key)),
	};
};

export const createSessionStorage = <T>(
	options?: IWebStorageOptions,
): IStorage<T> => fromWebStorage<T>(globalThis.sessionStorage, options);

export const createLocalStorage = <T>(
	options?: IWebStorageOptions,
): IStorage<T> => fromWebStorage<T>(globalThis.localStorage, options);
