import type { BetterAuthOptions } from 'better-auth';
import { type MemoryDB, memoryAdapter } from 'better-auth/adapters/memory';

export interface IInterceptCall {
	model: string;
	where: Array<{ field: string; value: unknown }>;
	update: Record<string, unknown>;
}

export type IInterceptFn = (call: IInterceptCall) => number | undefined;

export const interceptingMemoryAdapter = (
	db: MemoryDB,
	intercept: IInterceptFn,
): ReturnType<typeof memoryAdapter> => {
	const base = memoryAdapter(db);

	return (options: BetterAuthOptions) => {
		const adapter = base(options);

		return {
			...adapter,
			updateMany: async (params) => {
				const override = intercept(params as unknown as IInterceptCall);
				if (override !== undefined) {
					return override;
				}
				return adapter.updateMany(params);
			},
		};
	};
};
