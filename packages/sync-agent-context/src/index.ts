export { defineConfig, loadConfig, validateConfig } from './config';
export {
	buildDocument,
	loadFragment,
	loadSpecificInstructions,
	slugify,
	syncAiContext,
} from './core';
export type {
	IBuildDocumentOptions,
	IDocumentProfile,
	IExtraSection,
	ISyncAiContextConfig,
	ISyncAiContextOptions,
	ISyncAiContextResult,
	ISyncAiContextResultItem,
	ISyncMode,
} from './types';
