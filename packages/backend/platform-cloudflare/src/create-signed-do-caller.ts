import { signInternalRequest, timingChaosDelay } from '@stackory/backend-utils';

export type SecretProvider = string | (() => string) | (() => Promise<string>);

const resolveSecret = (secret: SecretProvider): Promise<string> =>
	typeof secret === 'string'
		? Promise.resolve(secret)
		: Promise.resolve(secret());

export interface ISignedDOCaller {
	call(name: string, path: string, init?: RequestInit): Promise<Response>;
}

/**
 * 创建带 HMAC 签名的 Durable Object 调用器。
 *
 * 封装 idFromName → get stub → signInternalRequest → fetch 全流程，
 * 调用方只需提供 DO 名称、路径和可选 init，无需手动管理签名逻辑。
 *
 * @example
 * const audienceShard = createSignedDOCaller(env.AUDIENCE_SHARD, env.INTERNAL_HMAC_KEY);
 * await audienceShard.call(shardName, '/internal/fanout', {
 *   method: 'POST',
 *   headers: { 'content-type': 'application/json' },
 *   body: JSON.stringify({ events }),
 * });
 */
export const createSignedDOCaller = <
	T extends Rpc.DurableObjectBranded | undefined,
>(
	namespace: DurableObjectNamespace<T>,
	secret: SecretProvider,
): ISignedDOCaller => ({
	call: async (name, path, init) => {
		const stub = namespace.get(namespace.idFromName(name));
		const request = await signInternalRequest(
			new Request(`https://do.internal${path}`, init),
			await resolveSecret(secret),
		);
		await timingChaosDelay(`cf.do.fetch:${path}`, { maxMs: 3_000 });
		return stub.fetch(request);
	},
});
