import { fileURLToPath } from 'node:url';
import { applyLocalD1Migrations } from './local-d1-migrations.js';
import {
	extractToolingConfigArgs,
	loadWorkersToolingConfig,
} from './tooling-config.js';

export const runApplyLocalD1MigrationsCli = async (
	argv = process.argv.slice(2),
) => {
	const configArgs = extractToolingConfigArgs(argv);
	const context = await loadWorkersToolingConfig(configArgs);
	const presets = context.topology.d1MigrationPresets ?? {};
	const cliArgs = configArgs.remainingArgs.filter((arg) => arg !== '--');
	const [rawPresetName, workerDirArg] = cliArgs;

	if (!rawPresetName || !(rawPresetName in presets)) {
		const supportedPresets = Object.keys(presets).join(', ') || '(none)';
		console.error(
			`Usage: pnpm --filter @infra/workers-tooling run apply-local-d1-migrations -- <preset> [workerDir]\n` +
				`Supported presets: ${supportedPresets}\n` +
				`Example: workers-tooling d1 apply-local app-db workers/api`,
		);
		process.exit(1);
	}

	const presetName = rawPresetName;
	const preset = presets[presetName];
	applyLocalD1Migrations({
		preset,
		presetName,
		rootDir: context.rootDir,
		workerDir: workerDirArg,
	});
};

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectExecution) {
	runApplyLocalD1MigrationsCli().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
}
