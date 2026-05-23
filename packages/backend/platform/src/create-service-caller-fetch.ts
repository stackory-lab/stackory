import type { IServiceCaller } from './service-caller';

export const createServiceCallerFetch = (
	serviceCaller: IServiceCaller,
	serviceName: string,
): typeof fetch => {
	return (input, init) =>
		serviceCaller.call(serviceName, new Request(input, init));
};
