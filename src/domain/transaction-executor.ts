import type {
	CompensationStep,
	MetadataRecord,
	ParaOperationPlan,
	PropertyAddition,
} from './operation-plan';

export interface FileMutationSnapshot {
	mtime: number;
	size: number;
}

export interface SourceInspection {
	file: FileMutationSnapshot;
	metadata: MetadataRecord;
}

export interface ParaMutationPort {
	inspectSource(path: string): Promise<SourceInspection>;
	destinationExists(path: string): Promise<boolean>;
	setProperty(path: string, step: PropertyAddition): Promise<void>;
	removeProperty(path: string, name: string): Promise<void>;
	moveFile(path: string, destination: string): Promise<void>;
}

export type PreflightFailureReason =
	| 'destination_conflict'
	| 'inspection_failed'
	| 'missing_metadata'
	| 'source_changed';

export interface RecoveryDetails {
	source: string;
	destination: string;
	failure: string;
	changedProperties: string[];
	rollbackFailures: Array<{
		property: string;
		action: CompensationStep['action'];
		message: string;
	}>;
}

export type ParaExecutionResult =
	| { ok: true; kind: 'success'; destination: string }
	| {
		ok: false;
		kind: 'preflight';
		reason: PreflightFailureReason;
		message: string;
		missing?: string[];
	  }
	| {
		ok: false;
		kind: 'rolled_back' | 'rollback';
		message: string;
		recovery: RecoveryDetails;
	  };

function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

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

function fileSnapshotsEqual(
	left: FileMutationSnapshot,
	right: FileMutationSnapshot,
): boolean {
	return left.mtime === right.mtime && left.size === right.size;
}

async function runCompensation(
	port: ParaMutationPort,
	path: string,
	step: CompensationStep,
): Promise<void> {
	if (step.action === 'remove') {
		await port.removeProperty(path, step.name);
		return;
	}
	await port.setProperty(path, {
		name: step.name,
		value: step.value,
		type: step.type,
	});
}

export async function executeParaOperation(options: {
	plan: ParaOperationPlan;
	expectedFile: FileMutationSnapshot;
	port: ParaMutationPort;
}): Promise<ParaExecutionResult> {
	const { plan, expectedFile, port } = options;
	if (plan.preflight.missing.length > 0) {
		return {
			ok: false,
			kind: 'preflight',
			reason: 'missing_metadata',
			message: `Missing required metadata: ${plan.preflight.missing.join(', ')}`,
			missing: [...plan.preflight.missing],
		};
	}

	let inspection: SourceInspection;
	try {
		inspection = await port.inspectSource(plan.move.path);
	} catch (error) {
		return {
			ok: false,
			kind: 'preflight',
			reason: 'inspection_failed',
			message: errorMessage(error),
		};
	}

	if (
		!fileSnapshotsEqual(inspection.file, expectedFile) ||
		!valuesEqual(inspection.metadata, plan.snapshot)
	) {
		return {
			ok: false,
			kind: 'preflight',
			reason: 'source_changed',
			message: `Inbox note changed after review started: ${plan.move.path}`,
		};
	}

	try {
		if (await port.destinationExists(plan.move.destination)) {
			return {
				ok: false,
				kind: 'preflight',
				reason: 'destination_conflict',
				message: `Destination already exists: ${plan.move.destination}`,
			};
		}
	} catch (error) {
		return {
			ok: false,
			kind: 'preflight',
			reason: 'inspection_failed',
			message: errorMessage(error),
		};
	}

	const appliedIndexes: number[] = [];
	let failure: unknown;
	for (const [index, step] of plan.apply.entries()) {
		try {
			await port.setProperty(plan.move.path, step);
			appliedIndexes.push(index);
		} catch (error) {
			failure = error;
			break;
		}
	}

	if (failure === undefined) {
		try {
			await port.moveFile(plan.move.path, plan.move.destination);
			return {
				ok: true,
				kind: 'success',
				destination: plan.move.destination,
			};
		} catch (error) {
			failure = error;
		}
	}

	const rollbackFailures: RecoveryDetails['rollbackFailures'] = [];
	for (const applyIndex of appliedIndexes.slice().reverse()) {
		const compensationIndex = plan.apply.length - applyIndex - 1;
		const compensation = plan.compensate[compensationIndex];
		if (!compensation) {
			rollbackFailures.push({
				property: plan.apply[applyIndex]?.name ?? 'unknown',
				action: 'remove',
				message: 'Compensation step is missing',
			});
			continue;
		}
		try {
			await runCompensation(port, plan.move.path, compensation);
		} catch (error) {
			rollbackFailures.push({
				property: compensation.name,
				action: compensation.action,
				message: errorMessage(error),
			});
		}
	}

	const message = errorMessage(failure);
	return {
		ok: false,
		kind: rollbackFailures.length === 0 ? 'rolled_back' : 'rollback',
		message,
		recovery: {
			source: plan.move.path,
			destination: plan.move.destination,
			failure: message,
			changedProperties: appliedIndexes.map(
				(index) => plan.apply[index]?.name ?? 'unknown',
			),
			rollbackFailures,
		},
	};
}
