import { useCallback, useState } from 'react';

export const useListNavigation = (count: number) => {
	const [selectedIndex, setSelectedIndex] = useState(0);
	const clampedIndex = Math.min(selectedIndex, Math.max(0, count - 1));
	const moveUp = useCallback(
		() => setSelectedIndex((prev) => (prev > 0 ? prev - 1 : count - 1)),
		[count],
	);
	const moveDown = useCallback(
		() => setSelectedIndex((prev) => (prev < count - 1 ? prev + 1 : 0)),
		[count],
	);
	const reset = useCallback(() => setSelectedIndex(0), []);

	return {
		clampedIndex,
		moveUp,
		moveDown,
		reset,
	};
};
