import { existsSync, globSync, readFileSync } from 'node:fs';
import path from 'node:path';

import type { PackageJson, WorkspacePackage } from '../types.js';
import { resolveWorkspaceGlobs } from './resolve-workspace-globs.js';

function readPackageJson(filePath: string): PackageJson {
	return JSON.parse(readFileSync(filePath, 'utf8')) as PackageJson;
}

function shouldExcludePackage(packageDir: string, excludes: string[]): boolean {
	const normalizedDir = packageDir.split(path.sep).join(path.posix.sep);
	const packageJsonPath =
		normalizedDir === '.'
			? 'package.json'
			: path.posix.join(normalizedDir, 'package.json');

	return excludes.some(
		(pattern) =>
			path.matchesGlob(normalizedDir, pattern) ||
			path.matchesGlob(packageJsonPath, pattern),
	);
}

export function readPackages(
	rootPath: string,
	excludes: string[] = [],
): Record<string, WorkspacePackage> {
	const packages: Record<string, WorkspacePackage> = {};
	const rootPkgPath = path.join(rootPath, 'package.json');

	if (existsSync(rootPkgPath) && !shouldExcludePackage('.', excludes)) {
		const rootPkg = readPackageJson(rootPkgPath);
		if (rootPkg.name) {
			packages[rootPkg.name] = { name: rootPkg.name, path: rootPath };
		}
	}

	for (const pattern of resolveWorkspaceGlobs(rootPath)) {
		const matches = globSync(pattern, { cwd: rootPath });
		for (const pkgDir of matches) {
			if (shouldExcludePackage(pkgDir, excludes)) {
				continue;
			}

			const packagePath = path.join(rootPath, pkgDir, 'package.json');
			if (!existsSync(packagePath)) {
				continue;
			}

			const pkg = readPackageJson(packagePath);
			if (pkg.name) {
				packages[pkg.name] = {
					name: pkg.name,
					path: path.join(rootPath, pkgDir),
				};
			}
		}
	}

	return packages;
}
