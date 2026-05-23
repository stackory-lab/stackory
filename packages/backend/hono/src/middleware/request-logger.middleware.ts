import type { Context, Env, MiddlewareHandler } from 'hono';

interface IRequestLogger {
	info(message: string, context?: Record<string, unknown>): void;
	warn(message: string, context?: Record<string, unknown>): void;
	error(message: string, context?: Record<string, unknown>): void;
	debug(message: string, context?: Record<string, unknown>): void;
	child(bindings: Record<string, unknown>): IRequestLogger;
}

export const createRequestLoggerMiddleware = <E extends Env>(options: {
	getLogger: (c: Context<E>) => IRequestLogger | undefined;
	setLogger: (c: Context<E>, logger: IRequestLogger) => void;
}): MiddlewareHandler<E> => {
	return async (c, next) => {
		const rootLogger = options.getLogger(c);
		if (!rootLogger) {
			await next();
			return;
		}

		const requestLogger = rootLogger.child({
			traceId: c.req.header('x-trace-id') ?? crypto.randomUUID(),
			method: c.req.method,
			path: c.req.path,
		});

		options.setLogger(c, requestLogger);

		const start = Date.now();
		requestLogger.info('request started');

		try {
			await next();
		} catch (error) {
			const duration = Date.now() - start;
			requestLogger.error('request failed', {
				duration,
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		}

		const duration = Date.now() - start;
		const status = c.res.status;
		const logFn =
			status >= 500
				? requestLogger.error
				: status >= 400
					? requestLogger.warn
					: requestLogger.info;
		logFn('request completed', { status, duration });
	};
};
