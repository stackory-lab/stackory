import type {
	IQueueProducer,
	IQueueSendOptions,
} from '@stackory/backend-platform';
import { timingChaosDelay } from '@stackory/backend-utils';

export class CloudflareQueueProducer<TMessage = unknown>
	implements IQueueProducer<TMessage>
{
	constructor(private queue: Queue<TMessage>) {}

	send = async (message: TMessage, options?: IQueueSendOptions) => {
		await timingChaosDelay('cf.queue.send', { maxMs: 3_000 });
		await this.queue.send(
			message,
			options ? { delaySeconds: options.delaySeconds } : undefined,
		);
	};

	sendBatch = async (
		messages: readonly TMessage[],
		options?: IQueueSendOptions,
	) => {
		await timingChaosDelay('cf.queue.send-batch', { maxMs: 3_000 });
		await this.queue.sendBatch(
			messages.map((message) => ({ body: message })),
			options ? { delaySeconds: options.delaySeconds } : undefined,
		);
	};
}
