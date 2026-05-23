import * as Sentry from '@sentry/cloudflare';
import type {
	IMonitoring,
	IMonitoringConfig,
} from '@stackory/backend-platform';
import { error } from '@stackory/constants';

const { StandardError } = error;

export const shouldReportByErrorCode = (code?: number) => {
	if (typeof code !== 'number') {
		return true;
	}

	const category = Math.floor(code / 100000);
	return category === 2 || category === 3;
};

export const shouldCaptureSentryException = (err: unknown) => {
	if (err instanceof StandardError) {
		return shouldReportByErrorCode(err.code);
	}

	return true;
};

export const shouldHandleSentryHonoError = (err: unknown) => {
	if (!shouldCaptureSentryException(err)) {
		return false;
	}

	const status =
		typeof err === 'object' &&
		err !== null &&
		'status' in err &&
		typeof (err as { status?: unknown }).status === 'number'
			? (err as { status: number }).status
			: undefined;

	if (status !== undefined) {
		return status >= 500 || status <= 299;
	}

	return true;
};

export class SentryCloudflareMonitoring implements IMonitoring {
	captureException = (error: Error, context?: Record<string, unknown>) => {
		Sentry.captureException(error, { extra: context });
	};

	captureMessage = (message: string, level?: 'info' | 'warning' | 'error') => {
		Sentry.captureMessage(message, level);
	};

	wrapApp = <T extends object>(app: T, config: IMonitoringConfig): T => {
		if (config.enabled === false) {
			return app;
		}

		// Sentry.withSentry expects ExportedHandler; assertion bridges the
		// platform-agnostic IMonitoring interface with Cloudflare's API.
		return Sentry.withSentry(
			() => ({
				dsn: config.dsn,
				sendDefaultPii: config.sendDefaultPii,
				environment: config.environment,
				integrations: (integrations) => {
					return [
						...integrations.filter(
							(integration) => integration.name !== 'Hono',
						),
						Sentry.honoIntegration({
							shouldHandleError: shouldHandleSentryHonoError,
						}),
					];
				},
			}),
			app,
		) as T;
	};
}
