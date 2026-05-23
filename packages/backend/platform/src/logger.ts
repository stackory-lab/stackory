export type ILogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVEL_ORDER: Record<ILogLevel, number> = {
	debug: 0,
	info: 1,
	warn: 2,
	error: 3,
};

export interface IConsoleLoggerConfig {
	level?: ILogLevel;
}

export interface ILogger {
	info(message: string, context?: Record<string, unknown>): void;
	warn(message: string, context?: Record<string, unknown>): void;
	error(message: string, context?: Record<string, unknown>): void;
	debug(message: string, context?: Record<string, unknown>): void;
	child(bindings: Record<string, unknown>): ILogger;
}

export class ConsoleLogger implements ILogger {
	private readonly level: ILogLevel;

	constructor(
		private bindings: Record<string, unknown> = {},
		config?: IConsoleLoggerConfig,
	) {
		this.level = config?.level ?? 'debug';
	}

	private isEnabled = (level: ILogLevel) =>
		LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[this.level];

	info = (message: string, context?: Record<string, unknown>) => {
		if (!this.isEnabled('info')) {
			return;
		}
		console.log(
			JSON.stringify({
				level: 'info',
				msg: message,
				...this.bindings,
				...context,
			}),
		);
	};

	warn = (message: string, context?: Record<string, unknown>) => {
		if (!this.isEnabled('warn')) {
			return;
		}
		console.warn(
			JSON.stringify({
				level: 'warn',
				msg: message,
				...this.bindings,
				...context,
			}),
		);
	};

	error = (message: string, context?: Record<string, unknown>) => {
		if (!this.isEnabled('error')) {
			return;
		}
		console.error(
			JSON.stringify({
				level: 'error',
				msg: message,
				...this.bindings,
				...context,
			}),
		);
	};

	debug = (message: string, context?: Record<string, unknown>) => {
		if (!this.isEnabled('debug')) {
			return;
		}
		console.debug(
			JSON.stringify({
				level: 'debug',
				msg: message,
				...this.bindings,
				...context,
			}),
		);
	};

	child = (bindings: Record<string, unknown>): ILogger => {
		return new ConsoleLogger(
			{ ...this.bindings, ...bindings },
			{ level: this.level },
		);
	};
}
