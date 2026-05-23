export interface IRequestInterceptor {
	intercept(serviceName: string, request: Request): Promise<Request>;
}
