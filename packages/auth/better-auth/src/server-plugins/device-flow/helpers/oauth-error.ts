import { APIError } from 'better-auth/api';

export const oauthError = (error: string, description?: string) => {
	return new APIError('BAD_REQUEST', {
		error,
		error_description: description ?? error,
	});
};
