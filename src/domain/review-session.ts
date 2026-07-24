import type { InboxQueueItem } from './inbox-queue';

export type ReviewSessionStatus =
	| 'active'
	| 'finished'
	| 'paused'
	| 'closed'
	| 'halted';

export interface ReviewSession {
	status: ReviewSessionStatus;
	pending: readonly InboxQueueItem[];
	processed: number;
	skipped: readonly InboxQueueItem[];
	haltReason?: string;
}

export interface ReviewSessionSummary {
	processed: number;
	skipped: number;
	remainingInInbox: number;
	inboxEmpty: boolean;
}

function requireActive(session: ReviewSession): InboxQueueItem {
	if (session.status !== 'active' || session.pending.length === 0) {
		throw new Error('Review session has no active Inbox note');
	}

	const current = session.pending[0];
	if (!current) {
		throw new Error('Review session has no active Inbox note');
	}

	return current;
}

function finishOrContinue(
	session: ReviewSession,
	changes: Pick<ReviewSession, 'processed' | 'skipped'>,
): ReviewSession {
	const pending = session.pending.slice(1);
	return {
		status: pending.length === 0 ? 'finished' : 'active',
		pending,
		processed: changes.processed,
		skipped: changes.skipped,
	};
}

export function createReviewSession(
	queue: readonly InboxQueueItem[],
): ReviewSession {
	return {
		status: queue.length === 0 ? 'finished' : 'active',
		pending: [...queue],
		processed: 0,
		skipped: [],
	};
}

export function currentInboxItem(
	session: ReviewSession,
): InboxQueueItem | null {
	return session.status === 'active' ? (session.pending[0] ?? null) : null;
}

export function completeCurrent(session: ReviewSession): ReviewSession {
	requireActive(session);
	return finishOrContinue(session, {
		processed: session.processed + 1,
		skipped: session.skipped,
	});
}

export function skipCurrent(session: ReviewSession): ReviewSession {
	const current = requireActive(session);
	return finishOrContinue(session, {
		processed: session.processed,
		skipped: [...session.skipped, current],
	});
}

export function pauseSession(session: ReviewSession): ReviewSession {
	requireActive(session);
	return { ...session, status: 'paused' };
}

export function closeSession(session: ReviewSession): ReviewSession {
	requireActive(session);
	return { ...session, status: 'closed' };
}

export function haltSession(
	session: ReviewSession,
	reason: string,
): ReviewSession {
	requireActive(session);
	const haltReason = reason.trim();
	if (haltReason.length === 0) {
		throw new Error('A halted review session requires a recovery reason');
	}

	return { ...session, status: 'halted', haltReason };
}

export function summarizeSession(
	session: ReviewSession,
): ReviewSessionSummary {
	const remainingInInbox = session.pending.length + session.skipped.length;
	return {
		processed: session.processed,
		skipped: session.skipped.length,
		remainingInInbox,
		inboxEmpty: session.status === 'finished' && remainingInInbox === 0,
	};
}
