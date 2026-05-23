import type { IRequestInterceptor } from './request-interceptor';
import type { IServiceCaller, IServiceCallerOptions } from './service-caller';
import type { IServiceTransport } from './service-transport';

export const createServiceCaller = (
	transport: IServiceTransport,
	interceptors: IRequestInterceptor[] = [],
): IServiceCaller => {
	const applyInterceptors = async (serviceName: string, request: Request) => {
		let req = request;
		for (const interceptor of interceptors) {
			req = await interceptor.intercept(serviceName, req);
		}
		return transport.fetch(serviceName, req);
	};

	const call = async (
		serviceName: string,
		requestOrOptions: Request | IServiceCallerOptions,
	) => {
		if (requestOrOptions instanceof Request) {
			return applyInterceptors(serviceName, requestOrOptions);
		}
		const { path, method = 'GET', body, headers } = requestOrOptions;
		let bodyStr: string | undefined;
		if (body && method !== 'GET') {
			bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
		}
		const request = new Request(`http://internal${path}`, {
			method,
			headers,
			body: bodyStr,
		});
		return applyInterceptors(serviceName, request);
	};

	return { call } as IServiceCaller;
};
