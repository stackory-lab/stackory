type IProcessEnv = Record<string, string | undefined>;

declare const process:
	| {
			env?: IProcessEnv;
	  }
	| undefined;

export interface ITimingChaosOptions {
	maxMs?: number;
	seed?: string;
}

const ENABLED_VALUES = new Set(['1', 'true', 'yes', 'on']);
const DEFAULT_MAX_MS = 2_000;
const TIMING_CHAOS_FLAG = 'AGT_TIMING_CHAOS';
const TIMING_CHAOS_MAX_MS = 'AGT_TIMING_CHAOS_MAX_MS';
const TIMING_CHAOS_SEED = 'AGT_TIMING_CHAOS_SEED';

let callCounter = 0;

const getEnvValue = (key: string): string | undefined => {
	if (typeof process === 'undefined') {
		return undefined;
	}
	const value = process.env?.[key];
	if (value === null || value === undefined) {
		return undefined;
	}
	return String(value);
};

const parseEnabled = (value: string | undefined) => {
	return value ? ENABLED_VALUES.has(value.toLowerCase()) : false;
};

const parseMaxMs = (value: string | undefined, fallback: number) => {
	if (!value) {
		return fallback;
	}
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 0) {
		return fallback;
	}
	return Math.floor(parsed);
};

const hashString = (value: string) => {
	let hash = 2_166_136_261;
	for (let i = 0; i < value.length; i += 1) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 16_777_619);
	}
	return hash >>> 0;
};

export const isTimingChaosEnabled = (): boolean => {
	return parseEnabled(getEnvValue(TIMING_CHAOS_FLAG));
};

export const getTimingChaosDelayMs = (
	label: string,
	options: ITimingChaosOptions = {},
): number | null => {
	if (!isTimingChaosEnabled()) {
		return null;
	}

	const maxMs = parseMaxMs(
		getEnvValue(TIMING_CHAOS_MAX_MS),
		options.maxMs ?? DEFAULT_MAX_MS,
	);
	if (maxMs <= 0) {
		return 0;
	}

	const seed = options.seed ?? getEnvValue(TIMING_CHAOS_SEED);
	if (!seed) {
		return Math.floor(Math.random() * (maxMs + 1));
	}

	const counter = callCounter;
	callCounter += 1;
	return hashString(`${seed}:${label}:${counter}`) % (maxMs + 1);
};

export const timingChaosDelay = async (
	label: string,
	options: ITimingChaosOptions = {},
): Promise<void> => {
	const ms = getTimingChaosDelayMs(label, options);
	if (ms === null) {
		return;
	}
	console.info('[timing-chaos]', { label, ms });
	await new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
};
