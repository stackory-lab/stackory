import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { IStorage } from '@stackory/contracts';

const read = (filePath: string): Record<string, unknown> => {
	try {
		return JSON.parse(readFileSync(filePath, 'utf8')) as Record<
			string,
			unknown
		>;
	} catch {
		return {};
	}
};

const write = (filePath: string, data: Record<string, unknown>) => {
	mkdirSync(dirname(filePath), { recursive: true });
	writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
};

export const createFileStorage = <T>(filePath: string): IStorage<T> => ({
	get: (key) => (read(filePath)[key] as T) ?? null,
	set: (key, value) => write(filePath, { ...read(filePath), [key]: value }),
	remove: (key) => {
		const { [key]: _, ...rest } = read(filePath);
		write(filePath, rest);
	},
	clear: () => write(filePath, {}),
	getAllKeys: () => Object.keys(read(filePath)),
});
