import type { SourceInspection } from './domain/transaction-executor';

function valuesEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true;
	if (Array.isArray(left) || Array.isArray(right)) {
		return Array.isArray(left) && Array.isArray(right) &&
			left.length === right.length &&
			left.every((value, index) => valuesEqual(value, right[index]));
	}
	if (
		left === null || right === null ||
		typeof left !== 'object' || typeof right !== 'object'
	) {
		return false;
	}

	const leftRecord = left as Record<string, unknown>;
	const rightRecord = right as Record<string, unknown>;
	const leftKeys = Object.keys(leftRecord).sort();
	const rightKeys = Object.keys(rightRecord).sort();
	return leftKeys.length === rightKeys.length &&
		leftKeys.every(
			(key, index) =>
				key === rightKeys[index] &&
				valuesEqual(leftRecord[key], rightRecord[key]),
		);
}

export function sourceInspectionsEqual(
	left: SourceInspection,
	right: SourceInspection,
): boolean {
	return left.file.mtime === right.file.mtime &&
		left.file.size === right.file.size &&
		valuesEqual(left.metadata, right.metadata);
}
