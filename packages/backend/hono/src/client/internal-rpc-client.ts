import {
	createServiceCallerFetch,
	type IServiceCaller,
} from '@stackory/backend-platform';
import { hc } from 'hono/client';

const parseBody = async (response: Response): Promise<unknown> => {
	const contentType = response.headers.get('content-type') ?? '';
	if (contentType.includes('application/json')) {
		return response.json().catch(() => null);
	}

	return response.text();
};

const createRequestWithHeaders = async (
	request: Request,
	getHeaders: IInternalRpcHeadersFactory | undefined,
) => {
	if (!getHeaders) {
		return request;
	}

	const nextHeaders = await getHeaders();
	const headers = new Headers(request.headers);
	for (const [key, value] of new Headers(nextHeaders).entries()) {
		headers.set(key, value);
	}

	return new Request(request, { headers });
};

export class InternalRpcError extends Error {
	constructor(
		public readonly status: number,
		public readonly data: unknown,
	) {
		super(`Internal RPC error ${status}`);
		this.name = 'InternalRpcError';
	}
}

export type IUnwrapResponse<T> = T extends { json(): Promise<infer J> } ? J : T;

export type IUnwrapHonoRpcClient<T> = {
	[K in keyof T]: T[K] extends (...args: infer A) => Promise<infer R>
		? (...args: A) => Promise<IUnwrapResponse<R>>
		: T[K] extends (...args: infer A) => infer R
			? (...args: A) => R
			: T[K] extends object
				? IUnwrapHonoRpcClient<T[K]>
				: T[K];
};

export interface ICreateInternalRpcClientOptions {
	baseUrl: string;
	getHeaders?: IInternalRpcHeadersFactory;
	serviceCaller: IServiceCaller;
	serviceName: string;
}

type IInternalRpcHeadersFactory = () => HeadersInit | Promise<HeadersInit>;

export const createInternalRpcClient = <TRpcClient>(
	options: ICreateInternalRpcClientOptions,
) => {
	const serviceFetch = createServiceCallerFetch(
		options.serviceCaller,
		options.serviceName,
	);

	const jsonFetch = async <T>(
		input: Request | string | URL,
		init?: RequestInit,
	): Promise<T> => {
		const rawUrl = input instanceof Request ? input.url : String(input);
		const url = new URL(rawUrl, options.baseUrl);
		let request = new Request(url, input instanceof Request ? input : init);
		request = await createRequestWithHeaders(request, options.getHeaders);

		const response = await serviceFetch(request);
		if (!response.ok) {
			throw new InternalRpcError(response.status, await parseBody(response));
		}

		return parseBody(response) as Promise<T>;
	};

	return hc(options.baseUrl, {
		fetch: jsonFetch,
	}) as unknown as IUnwrapHonoRpcClient<TRpcClient>;
};
