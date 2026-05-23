export const DEVICE_AUTHORIZATION_MODEL = 'deviceAuthorization';

export const deviceAuthorizationSchema = {
	[DEVICE_AUTHORIZATION_MODEL]: {
		disableMigration: true,
		fields: {
			deviceCodeHash: {
				type: 'string',
				required: true,
				unique: true,
			},
			userCode: {
				type: 'string',
				required: true,
				unique: true,
			},
			clientId: {
				type: 'string',
				required: true,
				references: {
					model: 'oauthClient',
					field: 'clientId',
					onDelete: 'cascade',
				},
			},
			scopes: {
				type: 'string[]',
				required: true,
			},
			resource: {
				type: 'string[]',
				required: true,
			},
			codeChallenge: {
				type: 'string',
				required: true,
			},
			codeChallengeMethod: {
				type: 'string',
				required: true,
			},
			status: {
				type: 'string',
				required: true,
			},
			userId: {
				type: 'string',
				required: false,
				references: {
					model: 'user',
					field: 'id',
					onDelete: 'cascade',
				},
			},
			authorizationCode: {
				type: 'string',
				required: false,
			},
			pollInterval: {
				type: 'number',
				required: true,
				defaultValue: 5,
			},
			lastPolledAt: {
				type: 'date',
				required: false,
			},
			createdIp: {
				type: 'string',
				required: false,
			},
			createdUa: {
				type: 'string',
				required: false,
			},
			failureReason: {
				type: 'string',
				required: false,
			},
			approvingStartedAt: {
				type: 'date',
				required: false,
			},
			consumingStartedAt: {
				type: 'date',
				required: false,
			},
			expiresAt: {
				type: 'date',
				required: true,
			},
			createdAt: {
				type: 'date',
				required: true,
			},
			decidedAt: {
				type: 'date',
				required: false,
			},
			consumedAt: {
				type: 'date',
				required: false,
			},
			failedAt: {
				type: 'date',
				required: false,
			},
		},
	},
} as const;
