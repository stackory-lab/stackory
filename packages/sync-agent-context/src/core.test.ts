import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildDocument, loadSpecificInstructions, syncAiContext } from './core';

const tempDirs: string[] = [];

const makeTempDir = async () => {
	const dir = await mkdtemp(path.join(os.tmpdir(), 'sync-ai-context-'));
	tempDirs.push(dir);
	return dir;
};

afterEach(async () => {
	await Promise.all(
		tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
	);
});

describe('buildDocument', () => {
	it('assembles fragments with normalized headings', async () => {
		const rootDir = await makeTempDir();
		const fragmentsDir = path.join(rootDir, 'fragments');
		await mkdir(fragmentsDir, { recursive: true });
		await writeFile(
			path.join(fragmentsDir, 'rules.md'),
			'# Rules\n\n- keep sync\n',
		);
		await writeFile(
			path.join(fragmentsDir, 'core.md'),
			'# Core\n\n- use config\n',
		);

		const document = await buildDocument({
			title: '# Context',
			introLines: ['Generated.'],
			fragments: ['rules', 'core'],
			fragmentsDir,
			fragmentTitles: {
				rules: 'Rules & Guardrails',
				core: 'Core Project Context',
			},
		});

		expect(document).toMatchInlineSnapshot(`
      "# Context

      Generated.

      ## Rules & Guardrails

      - keep sync

      ---

      ## Core Project Context

      - use config
      "
    `);
	});
});

describe('loadSpecificInstructions', () => {
	it('indexes second-level headings by slug', async () => {
		const rootDir = await makeTempDir();
		const filePath = path.join(rootDir, 'specific.md');
		await writeFile(
			filePath,
			'# Specific\n\n## Agents-Specific Instructions\n- concise\n',
		);

		await expect(loadSpecificInstructions(filePath)).resolves.toEqual({
			'agents-specific-instructions': {
				heading: 'Agents-Specific Instructions',
				body: '- concise',
			},
		});
	});
});

describe('syncAiContext', () => {
	it('writes documents and reports check drift', async () => {
		const rootDir = await makeTempDir();
		const fragmentsDir = path.join(rootDir, 'fragments');
		await mkdir(fragmentsDir, { recursive: true });
		await writeFile(
			path.join(fragmentsDir, 'rules.md'),
			'# Rules\n\n- first\n',
		);
		await writeFile(
			path.join(fragmentsDir, 'specific.md'),
			'## Agents-Specific Instructions\n- extra\n',
		);

		const config = {
			fragmentsDir: 'fragments',
			specificPath: 'fragments/specific.md',
			fragmentTitles: {
				rules: 'Rules & Guardrails',
			},
			documents: [
				{
					name: 'Agents',
					output: 'AGENTS.md',
					title: '# Agents',
					fragments: ['rules'],
					specificKey: 'agents-specific-instructions',
				},
			],
		};

		const writeResult = await syncAiContext({ config, rootDir });
		expect(writeResult.outputs[0]?.changed).toBe(true);

		const generated = await readFile(path.join(rootDir, 'AGENTS.md'), 'utf8');
		expect(generated).toContain('## Agents-Specific Instructions');

		const checkResult = await syncAiContext({ config, rootDir, mode: 'check' });
		expect(checkResult.outputs[0]?.changed).toBe(false);

		await writeFile(path.join(rootDir, 'AGENTS.md'), 'stale');
		const driftResult = await syncAiContext({ config, rootDir, mode: 'check' });
		expect(driftResult.outputs[0]?.changed).toBe(true);
	});
});
