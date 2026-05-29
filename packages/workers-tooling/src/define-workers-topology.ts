import type { IWorkerTopology } from './types.js';

export const defineWorkersTopology = <TTopology extends IWorkerTopology>(
	topology: TTopology,
) => {
	return topology;
};
