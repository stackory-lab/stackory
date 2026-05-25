import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { getConfigPath, loadConfig } from '../config/load-config.js';
import type {
	DependencySection,
	DependencySectionName,
	MonosyncError,
	PackageChange,
	PackageJson,
	SyncPackageJsonResult,
	UnusedDep,
	VersionSpec,
} from '../types.js';
import { readPackages } from '../workspace/read-packages.js';
import {
	formatVersion,
	getWritableVersion,
	isLockedAtVersion,
} from './format-version.js';

function readPackageJson(filePath: string): PackageJson {
	return JSON.parse(readFileSync(filePath, 'utf8')) as PackageJson;
}

function versionSpecKey(value: VersionSpec): string {
	return JSON.stringify(formatVersion(value));
}

function checkDuplicateConfigEntries(
	configPath: string,
	dependencies: DependencySection,
	devDependencies: DependencySection,
): MonosyncError[] {
	return Object.entries(devDependencies).flatMap(([name, devValue]) => {
		const depValue = dependencies[name];
		if (!depValue || versionSpecKey(depValue) === versionSpecKey(devValue)) {
			return [];
		}

		return [
			{
				name,
				path: configPath,
				type: `config dependencies.${name} differs from devDependencies.${name}`,
			},
		];
	});
}

function syncSection({
	section,
	packageJson,
	newPackageJson,
	packageJsonPath,
	configSection,
	errors,
	changes,
}: {
	section: DependencySectionName;
	packageJson: PackageJson;
	newPackageJson: PackageJson;
	packageJsonPath: string;
	configSection: DependencySection;
	errors: MonosyncError[];
	changes: PackageChange[];
}): void {
	const currentSection = packageJson[section];
	if (!currentSection) {
		return;
	}

	const nextSection = { ...currentSection };
	newPackageJson[section] = nextSection;

	for (const [name, currentVersion] of Object.entries(currentSection)) {
		const configValue = configSection[name];
		if (!configValue) {
			errors.push({
				name,
				path: packageJsonPath,
				type: section,
			});
			continue;
		}

		if (isLockedAtVersion(configValue, currentVersion)) {
			continue;
		}

		const nextVersion = getWritableVersion(configValue);
		if (nextVersion && nextVersion !== currentVersion) {
			changes.push({
				file: packageJsonPath,
				name,
				from: currentVersion,
				to: nextVersion,
				section,
			});
			nextSection[name] = nextVersion;
		}
	}
}

export function syncPackageJson({
	write,
	rootPath,
	configPath,
}: {
	write: boolean;
	rootPath: string;
	configPath?: string;
}): SyncPackageJsonResult {
	const filePath = getConfigPath(rootPath, configPath);
	const config = loadConfig(rootPath, configPath);
	const dependencies = config.dependencies ?? {};
	const devDependencies = config.devDependencies ?? {};
	const peerDependencies = config.peerDependencies ?? {};
	const packages = readPackages(rootPath);
	const packageJsons: Array<{ path: string; packageJson: PackageJson }> = [];
	const errors = checkDuplicateConfigEntries(
		filePath,
		dependencies,
		devDependencies,
	);
	const changes: PackageChange[] = [];
	const usedDeps = new Set<string>();
	const usedDevDeps = new Set<string>();
	const usedPeerDeps = new Set<string>();

	for (const workspacePackage of Object.values(packages)) {
		const packageJsonPath = path.join(workspacePackage.path, 'package.json');
		const packageJson = readPackageJson(packageJsonPath);
		const newPackageJson = { ...packageJson };

		for (const name of Object.keys(packageJson.devDependencies ?? {})) {
			usedDevDeps.add(name);
		}
		for (const name of Object.keys(packageJson.peerDependencies ?? {})) {
			usedPeerDeps.add(name);
		}
		for (const name of Object.keys(packageJson.dependencies ?? {})) {
			usedDeps.add(name);
		}

		syncSection({
			section: 'devDependencies',
			packageJson,
			newPackageJson,
			packageJsonPath,
			configSection: devDependencies,
			errors,
			changes,
		});

		syncSection({
			section: 'peerDependencies',
			packageJson,
			newPackageJson,
			packageJsonPath,
			configSection: peerDependencies,
			errors,
			changes,
		});

		syncSection({
			section: 'dependencies',
			packageJson,
			newPackageJson,
			packageJsonPath,
			configSection: dependencies,
			errors,
			changes,
		});

		packageJsons.push({
			path: workspacePackage.path,
			packageJson: newPackageJson,
		});
	}

	const unusedDeps: UnusedDep[] = [
		...Object.keys(dependencies)
			.filter((name) => !usedDeps.has(name))
			.map((name) => ({ name, section: 'dependencies' as const })),
		...Object.keys(devDependencies)
			.filter((name) => !usedDevDeps.has(name))
			.map((name) => ({ name, section: 'devDependencies' as const })),
		...Object.keys(peerDependencies)
			.filter((name) => !usedPeerDeps.has(name))
			.map((name) => ({ name, section: 'peerDependencies' as const })),
	];

	if (write && errors.length === 0) {
		for (const item of packageJsons) {
			writeFileSync(
				path.join(item.path, 'package.json'),
				`${JSON.stringify(item.packageJson, null, 2)}\n`,
			);
		}
	}

	return { changes, errors, unusedDeps };
}
