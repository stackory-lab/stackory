import getConfig from '@infra/dep-presets';

export default getConfig({
	forbidden: [
		{
			name: 'shared-not-to-runtime-sides',
			severity: 'error',
			comment: 'Shared auth code must stay independent from client and server runtime code.',
			from: {
				path: '^src/shared/',
			},
			to: {
				path: '^src/(client|client-plugins|server|server-plugins)/',
			},
		},
	],
});
