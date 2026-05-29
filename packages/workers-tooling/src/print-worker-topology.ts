import { fileURLToPath } from 'node:url';
import {
	extractToolingConfigArgs,
	loadWorkersToolingConfig,
} from './tooling-config.js';
import type { IWorkerTopology } from './types.js';

export const printWorkerTopology = (topology: IWorkerTopology) => {
	console.log(JSON.stringify(topology, null, 2));
};

const isDirectExecution = process.argv[1] === fileURLToPath(import.meta.url);

export const runPrintWorkerTopologyCli = async (
	argv = process.argv.slice(2),
) => {
	const configArgs = extractToolingConfigArgs(argv);
	const context = await loadWorkersToolingConfig(configArgs);
	printWorkerTopology(context.topology);
};

if (isDirectExecution) {
	runPrintWorkerTopologyCli().catch((error: unknown) => {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`[worker-topology] ${message}`);
		process.exit(1);
	});
}
