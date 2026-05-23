import type {
	IQueueBatch,
	IQueueMessage,
	IQueueRetryOptions,
} from '@stackory/backend-platform';

class CloudflareQueueMessage<TMessage = unknown>
	implements IQueueMessage<TMessage>
{
	constructor(private message: Message<TMessage>) {}

	get id() {
		return this.message.id;
	}

	get timestamp() {
		return this.message.timestamp;
	}

	get body() {
		return this.message.body;
	}

	get attempts() {
		return this.message.attempts;
	}

	ack = () => {
		this.message.ack();
	};

	retry = (options?: IQueueRetryOptions) => {
		this.message.retry(
			options ? { delaySeconds: options.delaySeconds } : undefined,
		);
	};
}

export class CloudflareQueueBatch<TMessage = unknown>
	implements IQueueBatch<TMessage>
{
	constructor(private batch: MessageBatch<TMessage>) {}

	get queue() {
		return this.batch.queue;
	}

	get messages() {
		return this.batch.messages.map(
			(message) => new CloudflareQueueMessage(message),
		);
	}

	ackAll = () => {
		this.batch.ackAll();
	};

	retryAll = (options?: IQueueRetryOptions) => {
		this.batch.retryAll(
			options ? { delaySeconds: options.delaySeconds } : undefined,
		);
	};
}
