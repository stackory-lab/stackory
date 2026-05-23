export interface IQueueSendOptions {
	delaySeconds?: number;
}

export interface IQueueRetryOptions {
	delaySeconds?: number;
}

export interface IQueueMessage<TMessage = unknown> {
	readonly id: string;
	readonly timestamp: Date;
	readonly body: TMessage;
	readonly attempts: number;
	ack(): void;
	retry(options?: IQueueRetryOptions): void;
}

export interface IQueueBatch<TMessage = unknown> {
	readonly queue: string;
	readonly messages: readonly IQueueMessage<TMessage>[];
	ackAll(): void;
	retryAll(options?: IQueueRetryOptions): void;
}

export interface IQueueProducer<TMessage = unknown> {
	send(message: TMessage, options?: IQueueSendOptions): Promise<void>;
	sendBatch(
		messages: readonly TMessage[],
		options?: IQueueSendOptions,
	): Promise<void>;
}
