export interface IServiceTransport {
	fetch(serviceName: string, request: Request): Promise<Response>;
}
