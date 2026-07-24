import {
	closeSession,
	completeCurrent,
	createReviewSession,
	currentInboxItem,
	haltSession,
	pauseSession,
	skipCurrent,
	type ReviewSession,
} from './domain/review-session';
import type { InboxQueueItem } from './domain/inbox-queue';

export interface ReviewControllerPort {
	loadQueue(): Promise<readonly InboxQueueItem[]>;
	openNote(path: string): Promise<void>;
}

export type ReviewSessionListener = (session: ReviewSession | null) => void;

export interface ReviewActionDecision<Result> {
	transition: 'stay' | 'complete' | 'halt';
	result: Result;
	reason?: string;
}

export class ReviewController {
	private session: ReviewSession | null = null;
	private pending = false;
	private readonly listeners = new Set<ReviewSessionListener>();

	constructor(private readonly port: ReviewControllerPort) {}

	getSession(): ReviewSession | null {
		return this.session;
	}

	isPending(): boolean {
		return this.pending;
	}

	subscribe(listener: ReviewSessionListener): () => void {
		this.listeners.add(listener);
		listener(this.session);
		return () => this.listeners.delete(listener);
	}

	async start(): Promise<ReviewSession> {
		return this.runExclusive(async () => {
			const candidate = createReviewSession(await this.port.loadQueue());
			await this.openCurrent(candidate);
			return this.commit(candidate);
		});
	}

	async skip(): Promise<ReviewSession> {
		return this.runExclusive(async () => {
			const current = this.requireSession();
			const candidate = skipCurrent(current);
			await this.openCurrent(candidate);
			return this.commit(candidate);
		});
	}

	async performCurrent<Result>(
		operation: (
			item: InboxQueueItem,
		) => Promise<ReviewActionDecision<Result>>,
	): Promise<Result> {
		return this.runExclusive(async () => {
			const current = this.requireSession();
			const item = currentInboxItem(current);
			if (!item) throw new Error('Review session has no active Inbox note');
			const decision = await operation(item);
			if (decision.transition === 'stay') return decision.result;
			if (decision.transition === 'halt') {
				this.commit(haltSession(current, decision.reason ?? 'Review action failed'));
				return decision.result;
			}

			const candidate = completeCurrent(current);
			this.commit(candidate);
			try {
				await this.openCurrent(candidate);
			} catch (error) {
				if (candidate.status === 'active') {
					this.commit(haltSession(candidate, this.errorMessage(error)));
				}
				throw error;
			}
			return decision.result;
		});
	}

	pause(): ReviewSession {
		return this.commit(pauseSession(this.requireSession()));
	}

	close(): ReviewSession {
		return this.commit(closeSession(this.requireSession()));
	}

	private async runExclusive<Result>(
		operation: () => Promise<Result>,
	): Promise<Result> {
		if (this.pending) throw new Error('A review action is already pending');
		this.pending = true;
		this.emit();
		try {
			return await operation();
		} finally {
			this.pending = false;
			this.emit();
		}
	}

	private requireSession(): ReviewSession {
		if (!this.session) throw new Error('Inbox review has not started');
		return this.session;
	}

	private async openCurrent(session: ReviewSession): Promise<void> {
		const item = currentInboxItem(session);
		if (item) await this.port.openNote(item.path);
	}

	private commit(session: ReviewSession): ReviewSession {
		this.session = session;
		this.emit();
		return session;
	}

	private emit(): void {
		for (const listener of this.listeners) listener(this.session);
	}

	private errorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}
}
