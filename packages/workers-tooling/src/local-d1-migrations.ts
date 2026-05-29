import { execFileSync } from 'node:child_process';
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	rmSync,
	statSync,
} from 'node:fs';
import { join, resolve } from 'node:path';
import type { ILocalD1MigrationPreset } from './types.js';

const environment = 'staging';

export const applyLocalD1Migrations = (input: {
	preset: ILocalD1MigrationPreset;
	presetName: string;
	rootDir: string;
	workerDir?: string;
}) => {
	const workerDir = input.workerDir
		? resolve(input.rootDir, input.workerDir)
		: resolve(input.rootDir, input.preset.defaultWorkerDir);
	const workerConfigPath = resolve(workerDir, 'wrangler.jsonc');
	const workerLocalStateDir = resolve(workerDir, '../');
	const workerStateDir = resolve(workerLocalStateDir, '.cf-state');
	const workerLogsDir = resolve(workerLocalStateDir, '.cf-state/logs');
	const workerMigrationsDir = resolve(workerDir, 'migrations');
	const applyMode = input.preset.applyMode ?? 'materialize';
	const sourceMigrationsDir =
		applyMode === 'direct'
			? resolve(workerDir, input.preset.migrationsDir)
			: resolve(input.rootDir, input.preset.migrationsDir);

	if (!existsSync(workerConfigPath)) {
		throw new Error(
			`Expected a wrangler.jsonc in the target worker directory: ${workerDir}`,
		);
	}

	if (!existsSync(sourceMigrationsDir)) {
		throw new Error(
			`Migrations directory does not exist: ${sourceMigrationsDir}`,
		);
	}

	if (!statSync(sourceMigrationsDir).isDirectory()) {
		throw new Error(
			`Migrations directory is not a directory: ${sourceMigrationsDir}`,
		);
	}

	const sqlFiles = readdirSync(sourceMigrationsDir)
		.filter((entry) => entry.endsWith('.sql'))
		.sort((left, right) => left.localeCompare(right));

	if (sqlFiles.length === 0) {
		throw new Error(
			`No SQL migrations found in ${sourceMigrationsDir}. Run drizzle:generate first.`,
		);
	}

	mkdirSync(workerStateDir, { recursive: true });
	mkdirSync(workerLogsDir, { recursive: true });

	if (applyMode === 'materialize') {
		if (existsSync(workerMigrationsDir)) {
			throw new Error(
				`Refusing to overwrite an existing migrations directory: ${workerMigrationsDir}`,
			);
		}

		mkdirSync(workerMigrationsDir, { recursive: true });

		for (const sqlFile of sqlFiles) {
			copyFileSync(
				join(sourceMigrationsDir, sqlFile),
				join(workerMigrationsDir, sqlFile),
			);
		}
	}

	console.log(
		`Applying ${sqlFiles.length} ${input.presetName} migration(s) to local D1 for ${workerDir} (${environment})...`,
	);

	try {
		execFileSync(
			'pnpm',
			[
				'exec',
				'wrangler',
				'd1',
				'migrations',
				'apply',
				input.preset.databaseName,
				'--local',
				'--persist-to',
				workerStateDir,
				'--config',
				workerConfigPath,
				'--env',
				environment,
			],
			{
				cwd: workerDir,
				env: {
					...process.env,
					WRANGLER_LOG_PATH: workerLogsDir,
				},
				stdio: 'inherit',
			},
		);
	} finally {
		if (applyMode === 'materialize') {
			rmSync(workerMigrationsDir, { recursive: true, force: true });
		}
	}
};
