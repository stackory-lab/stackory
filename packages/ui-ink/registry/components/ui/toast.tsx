import { Box, Text } from 'ink';
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

type IToastLevel = 'error' | 'warn' | 'info';

interface IToast {
	id: string;
	level: IToastLevel;
	message: string;
}

interface IToastContext {
	toasts: IToast[];
	addToast: (message: string, level: IToastLevel) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<IToastContext | null>(null);

// ─── Config ───────────────────────────────────────────────────────────────────

const TOAST_TTL: Record<IToastLevel, number> = {
	error: 5000,
	warn: 4000,
	info: 3000,
};

const MAX_TOASTS = 3;

let nextId = 0;

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ToastProvider = ({ children }: { children: React.ReactNode }) => {
	const [toasts, setToasts] = useState<IToast[]>([]);
	const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
		new Map(),
	);

	const removeToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((t) => t.id !== id));
		timersRef.current.delete(id);
	}, []);

	const addToast = useCallback(
		(message: string, level: IToastLevel) => {
			const id = String(++nextId);
			setToasts((prev) => {
				const next = [...prev, { id, level, message }];
				return next.length > MAX_TOASTS
					? next.slice(next.length - MAX_TOASTS)
					: next;
			});
			const timer = setTimeout(() => removeToast(id), TOAST_TTL[level]);
			timersRef.current.set(id, timer);
		},
		[removeToast],
	);

	useEffect(
		() => () => {
			for (const timer of timersRef.current.values()) {
				clearTimeout(timer);
			}
		},
		[],
	);

	return <ToastContext value={{ toasts, addToast }}>{children}</ToastContext>;
};

// ─── Display ──────────────────────────────────────────────────────────────────

const LEVEL_COLOR: Record<IToastLevel, string> = {
	error: 'red',
	warn: 'yellow',
	info: 'cyan',
};

const LEVEL_PREFIX: Record<IToastLevel, string> = {
	error: '✖ ',
	warn: '⚠ ',
	info: '● ',
};

export const ToastDisplay = () => {
	const { toasts } = useToast();

	if (toasts.length === 0) {
		return null;
	}

	return (
		<Box flexDirection='column' marginTop={1}>
			{toasts.map((toast) => (
				<Box key={toast.id}>
					<Text color={LEVEL_COLOR[toast.level]}>
						{LEVEL_PREFIX[toast.level]}
						{toast.message}
					</Text>
				</Box>
			))}
		</Box>
	);
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

const useToast = () => {
	const ctx = useContext(ToastContext);
	if (!ctx) throw new Error('useToast must be used within ToastProvider');
	return ctx;
};

export const useToastActions = () => {
	const { addToast } = useToast();
	return useMemo(
		() => ({
			toast: {
				error: (message: string) => addToast(message, 'error'),
				warn: (message: string) => addToast(message, 'warn'),
				info: (message: string) => addToast(message, 'info'),
			},
		}),
		[addToast],
	);
};
