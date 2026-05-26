import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { validateConfig } from './config';
import type {
	IBuildDocumentOptions,
	IExtraSection,
	ISyncAiContextOptions,
	ISyncAiContextResult,
} from './types';

const DEFAULT_SEPARATOR = '\n---\n\n';

const resolveFromRoot = (rootDir: string, targetPath: string) => {
	if (path.isAbsolute(targetPath)) {
		return targetPath;
	}
	return path.resolve(rootDir, targetPath);
};

export const slugify = (input: string): string =>
	input
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

export const loadFragment = async (
	fragmentsDir: string,
	id: string,
): Promise<string> => {
	const filePath = path.join(fragmentsDir, `${id}.md`);
	const raw = await readFile(filePath, 'utf8');
	return raw
		.replace(/^\uFEFF?/, '')
		.replace(/^# [^\n]+\n+/, '')
		.trim();
};

export const buildDocument = async ({
	title,
	introLines = [],
	fragments,
	fragmentsDir,
	fragmentTitles = {},
	extraSections = [],
	separator = DEFAULT_SEPARATOR,
}: IBuildDocumentOptions): Promise<string> => {
	const sections: string[] = [];

	for (const fragmentId of fragments) {
		const content = await loadFragment(fragmentsDir, fragmentId);
		const heading = fragmentTitles[fragmentId] ?? fragmentId;
		sections.push(`## ${heading}\n\n${content}\n`);
	}

	for (const extra of extraSections) {
		sections.push(`## ${extra.heading}\n\n${extra.body.trim()}\n`);
	}

	const intro = [title, '', ...introLines, introLines.length ? '' : '']
		.join('\n')
		.trim();

	return `${`${intro}\n\n${sections.join(separator)}`.trim()}\n`;
};

export const loadSpecificInstructions = async (
	specificPath: string,
): Promise<Record<string, IExtraSection>> => {
	try {
		const raw = await readFile(specificPath, 'utf8');
		const lines = raw.replace(/^\uFEFF?/, '').split(/\r?\n/);
		const sections: Record<string, IExtraSection> = {};
		let currentKey = '';
		let currentHeading = '';
		let buffer: string[] = [];

		for (const line of lines) {
			if (line.startsWith('# ')) {
				continue;
			}
			if (line.startsWith('## ')) {
				if (currentKey) {
					sections[currentKey] = {
						heading: currentHeading,
						body: buffer.join('\n').trim(),
					};
				}
				currentHeading = line.slice(3).trim();
				currentKey = slugify(currentHeading);
				buffer = [];
				continue;
			}
			buffer.push(line);
		}

		if (currentKey) {
			sections[currentKey] = {
				heading: currentHeading,
				body: buffer.join('\n').trim(),
			};
		}

		return sections;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
			return {};
		}
		throw error;
	}
};

export const syncAiContext = async ({
	config,
	mode = 'write',
	rootDir = process.cwd(),
}: ISyncAiContextOptions): Promise<ISyncAiContextResult> => {
	validateConfig(config);

	const fragmentsDir = resolveFromRoot(rootDir, config.fragmentsDir);
	const specificSections = config.specificPath
		? await loadSpecificInstructions(
				resolveFromRoot(rootDir, config.specificPath),
			)
		: {};
	const outputs: ISyncAiContextResult['outputs'] = [];

	for (const document of config.documents) {
		const extraSections = [...(document.extraSections ?? [])];
		if (document.specificKey) {
			const specific = specificSections[document.specificKey];
			if (specific) {
				extraSections.push(specific);
			}
		}

		const output = resolveFromRoot(rootDir, document.output);
		const doc = await buildDocument({
			title: document.title,
			introLines: document.introLines,
			fragments: document.fragments,
			fragmentsDir,
			fragmentTitles: config.fragmentTitles,
			extraSections,
			separator: config.separator,
		});

		let current = '';
		try {
			current = await readFile(output, 'utf8');
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
				throw error;
			}
		}

		const changed = current !== doc;
		if (mode === 'write' && changed) {
			await mkdir(path.dirname(output), { recursive: true });
			await writeFile(output, doc);
		}

		outputs.push({
			name: document.name,
			output,
			changed,
		});
	}

	return {
		mode,
		outputs,
	};
};
