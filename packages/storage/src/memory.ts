import type { IStorage } from '@common/core-port';

export const createMemoryStorage = <T>(): IStorage<T> => {
	const store = new Map<string, T>();

	return {
		get: (key) => store.get(key) ?? null,
		set: (key, value) => {
			store.set(key, value);
		},
		remove: (key) => {
			store.delete(key);
		},
		clear: () => {
			store.clear();
		},
		getAllKeys: () => Array.from(store.keys()),
	};
};
