#!/usr/bin/env node
import path from 'node:path';
import { loadConfig } from './config';
import { syncAiContext } from './core';
import type { ISyncMode } from './types';

const parseArgs = (argv: string[]) => {
	const args = [...argv];
	const command = args.shift() ?? 'sync';
	let configPath = 'ai-context.config.mjs';
	let rootDir = process.cwd();

	while (args.length > 0) {
		const arg = args.shift();
		if (arg === '--config' || arg === '-c') {
			const value = args.shift();
			if (!value) {
				throw new Error(`${arg} requires a file path.`);
			}
			configPath = value;
			continue;
		}
		if (arg === '--root-dir') {
			const value = args.shift();
			if (!value) {
				throw new Error('--root-dir requires a directory path.');
			}
			rootDir = value;
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}

	if (command !== 'sync' && command !== 'check') {
		throw new Error(`Unknown command: ${command}. Expected "sync" or "check".`);
	}

	return {
		configPath,
		mode: command === 'sync' ? 'write' : ('check' as ISyncMode),
		rootDir,
	};
};

const main = async () => {
	const args = parseArgs(process.argv.slice(2));
	const rootDir = path.resolve(args.rootDir);
	const configPath = path.isAbsolute(args.configPath)
		? args.configPath
		: path.resolve(rootDir, args.configPath);
	const config = await loadConfig(configPath);
	const result = await syncAiContext({
		config,
		mode: args.mode,
		rootDir,
	});
	const changedOutputs = result.outputs.filter((output) => output.changed);

	if (result.mode === 'check' && changedOutputs.length > 0) {
		console.error(
			`AI context is out of sync: ${changedOutputs
				.map((output) => path.relative(rootDir, output.output))
				.join(', ')}`,
		);
		process.exitCode = 1;
		return;
	}

	console.log(
		`AI context ${result.mode === 'write' ? 'synchronized' : 'checked'}: ${result.outputs
			.map((output) => path.relative(rootDir, output.output))
			.join(', ')}`,
	);
};

main().catch((error: unknown) => {
	console.error('Failed to sync AI context.');
	console.error(error);
	process.exitCode = 1;
});
