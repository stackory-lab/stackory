export type ISyncMode = 'write' | 'check';

export interface IExtraSection {
	heading: string;
	body: string;
}

export interface IDocumentProfile {
	name: string;
	output: string;
	title: string;
	introLines?: string[];
	fragments: string[];
	extraSections?: IExtraSection[];
	specificKey?: string;
}

export interface ISyncAiContextConfig {
	fragmentsDir: string;
	fragmentTitles?: Record<string, string>;
	specificPath?: string;
	separator?: string;
	documents: IDocumentProfile[];
}

export interface ISyncAiContextOptions {
	config: ISyncAiContextConfig;
	mode?: ISyncMode;
	rootDir?: string;
}

export interface IBuildDocumentOptions {
	title: string;
	introLines?: string[];
	fragments: string[];
	fragmentsDir: string;
	fragmentTitles?: Record<string, string>;
	extraSections?: IExtraSection[];
	separator?: string;
}

export interface ISyncAiContextResultItem {
	name: string;
	output: string;
	changed: boolean;
}

export interface ISyncAiContextResult {
	mode: ISyncMode;
	outputs: ISyncAiContextResultItem[];
}
