import { pathToFileURL } from 'node:url';
import type { ISyncAiContextConfig } from './types';

export const defineConfig = (
	config: ISyncAiContextConfig,
): ISyncAiContextConfig => config;

export const loadConfig = async (
	configPath: string,
): Promise<ISyncAiContextConfig> => {
	const configModule = (await import(
		`${pathToFileURL(configPath).href}?t=${Date.now()}`
	)) as {
		default?: ISyncAiContextConfig;
		config?: ISyncAiContextConfig;
	};

	const config = configModule.default ?? configModule.config;
	if (!config) {
		throw new Error(`Config file must export a default config: ${configPath}`);
	}

	validateConfig(config);
	return config;
};

export const validateConfig = (config: ISyncAiContextConfig) => {
	if (!config.fragmentsDir) {
		throw new Error('Config must define fragmentsDir.');
	}
	if (!Array.isArray(config.documents) || config.documents.length === 0) {
		throw new Error('Config must define at least one document profile.');
	}

	for (const document of config.documents) {
		if (!document.name) {
			throw new Error('Each document profile must define name.');
		}
		if (!document.output) {
			throw new Error(
				`Document profile "${document.name}" must define output.`,
			);
		}
		if (!document.title) {
			throw new Error(`Document profile "${document.name}" must define title.`);
		}
		if (!Array.isArray(document.fragments) || document.fragments.length === 0) {
			throw new Error(
				`Document profile "${document.name}" must define at least one fragment.`,
			);
		}
	}
};
