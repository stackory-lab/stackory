import { defineConfig } from '@stackory/sync-agent-context';

export default defineConfig({
	fragmentsDir: 'infra/agent-context/fragments',
	specificPath: 'infra/agent-context/fragments/specific.md',
	fragmentTitles: {
		rules: 'Rules & Guardrails',
		core: 'Core Project Context',
		arch: 'Architecture Notes',
		coding: 'Coding Style',
		output: 'Output & Collaboration Expectations',
		examples: 'Examples & Patterns',
	},
	documents: [
		{
			name: 'Canonical Context',
			output: 'infra/agent-context/CONTEXT.md',
			title: '# Canonical Context',
			introLines: [
				'⚠️ AUTO-GENERATED. DO NOT EDIT BY HAND.',
				'Edit files under `ai/fragments/*.md` and run `pnpm run nx sync:context @infra/toolkit` to update this document and the root-level adapters.',
			],
			fragments: ['rules', 'core', 'arch', 'coding', 'output', 'examples'],
		},
		{
			name: 'Claude',
			output: 'CLAUDE.md',
			title: '# Claude Project Context',
			introLines: [
				'⚠️ AUTO-GENERATED. DO NOT EDIT.',
				'Content assembled from ai/CONTEXT.md fragments for Claude Code.',
			],
			fragments: ['rules', 'core', 'arch', 'coding', 'output', 'examples'],
			specificKey: 'claude-specific-instructions',
		},
		{
			name: 'Agents',
			output: 'AGENTS.md',
			title: '# Global Agent Instructions',
			introLines: [
				'⚠️ AUTO-GENERATED. DO NOT EDIT.',
				'Used by ChatGPT / Codex-compatible agents. Source of truth: ai/CONTEXT.md fragments.',
			],
			fragments: ['rules', 'core', 'arch', 'coding', 'output', 'examples'],
			specificKey: 'agents-specific-instructions',
		},
		{
			name: 'Gemini',
			output: 'GEMINI.md',
			title: '# Gemini Project Context',
			introLines: [
				'⚠️ AUTO-GENERATED. DO NOT EDIT.',
				'Optimized for Gemini Code Assist (prefers compact contexts).',
			],
			fragments: ['rules', 'core', 'coding', 'output'],
			specificKey: 'gemini-specific-instructions',
		},
	],
});
