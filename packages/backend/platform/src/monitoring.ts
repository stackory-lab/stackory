export interface IMonitoringConfig {
	dsn: string;
	sendDefaultPii?: boolean;
	environment?: string;
	enabled?: boolean;
}

export interface IMonitoring {
	captureException(error: Error, context?: Record<string, unknown>): void;

	captureMessage(message: string, level?: 'info' | 'warning' | 'error'): void;

	wrapApp<T extends object>(app: T, config: IMonitoringConfig): T;
}
