import {
	closeSession,
	createReviewSession,
	currentInboxItem,
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

	pause(): ReviewSession {
		return this.commit(pauseSession(this.requireSession()));
	}

	close(): ReviewSession {
		return this.commit(closeSession(this.requireSession()));
	}

	private async runExclusive(
		operation: () => Promise<ReviewSession>,
	): Promise<ReviewSession> {
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
}
