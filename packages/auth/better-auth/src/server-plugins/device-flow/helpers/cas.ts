import type { DBAdapter, Where } from 'better-auth';
import { DEVICE_AUTHORIZATION_MODEL } from '../schema';
import type {
	IDeviceAuthorizationRow,
	IDeviceAuthorizationStatus,
} from '../types';

export interface ICasDeviceAuthorizationParams {
	adapter: Pick<DBAdapter, 'updateMany'>;
	id: string;
	from: IDeviceAuthorizationStatus;
	update: Partial<IDeviceAuthorizationRow>;
}

export const casUpdateDeviceAuthorization = async ({
	adapter,
	id,
	from,
	update,
}: ICasDeviceAuthorizationParams) => {
	const where: Where[] = [
		{ field: 'id', value: id },
		{ field: 'status', value: from },
	];

	const affectedRows: unknown = await adapter.updateMany({
		model: DEVICE_AUTHORIZATION_MODEL,
		where,
		update,
	});

	if (typeof affectedRows === 'number') {
		return affectedRows;
	}
	if (Array.isArray(affectedRows)) {
		return affectedRows.length;
	}
	return affectedRows ? 1 : 0;
};
