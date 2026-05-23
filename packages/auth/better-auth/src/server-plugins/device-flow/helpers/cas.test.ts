import type { DBAdapter } from 'better-auth';
import { describe, expect, it } from 'vitest';
import { DEVICE_AUTHORIZATION_MODEL } from '../schema';
import { casUpdateDeviceAuthorization } from './cas';

const createAdapter = (affectedRows: number) => {
	const calls: Parameters<DBAdapter['updateMany']>[0][] = [];
	const adapter: Pick<DBAdapter, 'updateMany'> = {
		updateMany: async (params) => {
			calls.push(params);
			return affectedRows;
		},
	};

	return { adapter, calls };
};

describe('casUpdateDeviceAuthorization', () => {
	it('updates by id and expected status only', async () => {
		const { adapter, calls } = createAdapter(1);
		const now = new Date('2026-05-20T00:00:00.000Z');

		const affectedRows = await casUpdateDeviceAuthorization({
			adapter,
			id: 'device-auth-id',
			from: 'approved',
			update: {
				status: 'consuming',
				consumingStartedAt: now,
			},
		});

		expect(affectedRows).toBe(1);
		expect(calls).toEqual([
			{
				model: DEVICE_AUTHORIZATION_MODEL,
				where: [
					{ field: 'id', value: 'device-auth-id' },
					{ field: 'status', value: 'approved' },
				],
				update: {
					status: 'consuming',
					consumingStartedAt: now,
				},
			},
		]);
	});

	it('surfaces CAS misses without applying fallback behavior', async () => {
		const { adapter } = createAdapter(0);

		const affectedRows = await casUpdateDeviceAuthorization({
			adapter,
			id: 'device-auth-id',
			from: 'pending',
			update: {
				status: 'approving',
				approvingStartedAt: new Date('2026-05-20T00:00:00.000Z'),
			},
		});

		expect(affectedRows).toBe(0);
	});
});
