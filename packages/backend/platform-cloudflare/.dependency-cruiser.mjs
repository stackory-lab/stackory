import getConfig from '@infra/dep-presets';

const config = getConfig();

const sentryCloudflarePath = 'node_modules/.pnpm/@sentry[+]cloudflare';
for (const ruleName of [
	'not-to-dev-dep',
	'no-duplicate-dep-types',
	'peer-deps-used',
]) {
	const rule = config.forbidden.find((r) => r.name === ruleName);
	if (rule?.to) {
		rule.to.pathNot = [...(rule.to.pathNot ?? []), sentryCloudflarePath];
	}
}

export default config;
