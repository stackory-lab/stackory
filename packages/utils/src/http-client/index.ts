export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly data: unknown,
	) {
		super(`API error ${status}`);
		this.name = 'ApiError';
	}
}

type BeforeRequestHook = (req: Request) => Request | Promise<Request>;
type AfterResponseHook = (
	req: Request,
	res: Response,
) => Response | Promise<Response>;

export interface IApiClientOptions {
	baseUrl?: string;
	hooks?: {
		beforeRequest?: BeforeRequestHook[];
		afterResponse?: AfterResponseHook[];
	};
}

const parseBody = async (res: Response): Promise<unknown> => {
	const ct = res.headers.get('content-type') ?? '';
	if (ct.includes('application/json')) {
		return res.json().catch(() => null);
	}
	return res.text();
};

export const createApiClient = (options: IApiClientOptions = {}) => {
	const { baseUrl = '', hooks = {} } = options;

	return async <T>(
		input: Request | string | URL,
		init?: RequestInit,
	): Promise<T> => {
		const rawUrl = input instanceof Request ? input.url : String(input);
		const url = baseUrl ? new URL(rawUrl, baseUrl) : new URL(rawUrl);

		let request = new Request(
			input instanceof Request ? new Request(url, input) : url,
			init,
		);

		for (const hook of hooks.beforeRequest ?? []) {
			request = await hook(request);
		}

		let response = await fetch(request);

		for (const hook of hooks.afterResponse ?? []) {
			response = await hook(request, response);
		}

		if (!response.ok) {
			throw new ApiError(response.status, await parseBody(response));
		}

		return parseBody(response) as Promise<T>;
	};
};
