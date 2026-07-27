import { ItemView, type WorkspaceLeaf } from 'obsidian';
import {
	currentInboxItem,
	summarizeSession,
	type ReviewSession,
} from '../domain/review-session';
import type ParaInboxReviewPlugin from '../main';

export const REVIEW_VIEW_TYPE = 'para-inbox-review';
export const REVIEW_ICON = 'list-checks';

export class ParaInboxReviewView extends ItemView {
	private unsubscribe: (() => void) | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: ParaInboxReviewPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return REVIEW_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Inbox review';
	}

	getIcon(): string {
		return REVIEW_ICON;
	}

	onOpen(): Promise<void> {
		this.unsubscribe = this.plugin.reviewController.subscribe((session) => {
			this.renderSession(session);
		});
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = null;
		return Promise.resolve();
	}

	private renderSession(session: ReviewSession | null): void {
		this.contentEl.empty();
		this.contentEl.createEl('h2', { text: 'Inbox review' });

		if (!session) {
			this.contentEl.createEl('p', { text: 'Start a review from the command palette or ribbon.' });
			return;
		}

		const summary = summarizeSession(session);
		const current = currentInboxItem(session);
		this.contentEl.createEl('p', {
			text: `Status: ${session.status}${this.plugin.reviewController.isPending() ? ' (pending)' : ''}`,
		});
		this.contentEl.createEl('p', {
			text: `Processed ${summary.processed}; skipped ${summary.skipped}; remaining ${summary.remainingInInbox}.`,
		});

		if (current) {
			this.contentEl.createEl('p', { text: current.path });
			const actions = this.contentEl.createDiv({
				cls: 'para-inbox-review-actions',
			});
			const categoryActions = actions.createDiv({
				cls: 'para-inbox-review-action-row para-inbox-review-category-actions',
			});
			for (const [label, category] of [
				['Projects', 'projects'],
				['Areas', 'areas'],
				['Resources', 'resources'],
				['Archives', 'archives'],
			] as const) {
				const button = categoryActions.createEl('button', { text: label });
				button.disabled = this.plugin.reviewController.isPending();
				button.addEventListener('click', () => void this.plugin.sortReview(category));
			}

			const reviewActions = actions.createDiv({
				cls: 'para-inbox-review-action-row para-inbox-review-session-actions',
			});
			const skip = reviewActions.createEl('button', { text: 'Skip' });
			skip.disabled = this.plugin.reviewController.isPending();
			skip.addEventListener('click', () => void this.plugin.skipReview());
			const pause = reviewActions.createEl('button', { text: 'Pause' });
			pause.disabled = this.plugin.reviewController.isPending();
			pause.addEventListener('click', () => this.plugin.pauseReview());
			const trash = reviewActions.createEl('button', { text: 'Move to trash' });
			trash.disabled = this.plugin.reviewController.isPending();
			trash.addEventListener('click', () => void this.plugin.trashReview());
			const close = reviewActions.createEl('button', { text: 'Close review' });
			close.disabled = this.plugin.reviewController.isPending();
			close.addEventListener('click', () => void this.plugin.closeReview());
			actions.createEl('p', {
				cls: 'para-inbox-review-hotkey-hint',
				text: 'Assign shortcuts in hotkey settings.',
			});
			return;
		}

		if (session.status === 'halted') {
			this.contentEl.createEl('h3', { text: 'Manual recovery required' });
			this.contentEl.createEl('pre', { text: session.haltReason ?? 'Unknown recovery state' });
			return;
		}

		if (summary.inboxEmpty) {
			this.contentEl.createEl('p', { text: 'Inbox is empty.' });
		} else if (session.status === 'finished') {
			this.contentEl.createEl('p', { text: 'Pass complete; skipped notes remain in inbox.' });
		}
	}
}
