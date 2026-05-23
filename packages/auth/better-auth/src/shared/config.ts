export interface ICreateAuthConfigParams {
	baseURL?: string;
	basePath?: string;
}

export const createAuthConfig = ({
	baseURL,
	basePath,
}: ICreateAuthConfigParams) => {
	const authServerURL = `${baseURL}${basePath}`;

	return {
		authorizeEndpoint: `${authServerURL}/oauth2/authorize`,
		sessionEndpoint: `${authServerURL}/get-session`,
		tokenEndpoint: `${authServerURL}/oauth2/token`,
		sessionCookieName: 'better-auth.session_token',
	};
};
