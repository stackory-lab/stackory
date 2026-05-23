export interface IServiceCallerOptions {
	path: string;
	method?: string;
	body?: unknown;
	headers?: Record<string, string>;
}

export interface IServiceCaller {
	call(serviceName: string, request: Request): Promise<Response>;
	call(serviceName: string, options: IServiceCallerOptions): Promise<Response>;
}
