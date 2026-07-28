import { ItemView, type WorkspaceLeaf } from 'obsidian';
import { currentInboxItem, summarizeSession, type ReviewSession } from '../domain/review-session';
import type { ExpiredQueueItem } from '../domain/expired-queue';
import type ParaInboxReviewPlugin from '../main';

export const EXPIRED_REVIEW_VIEW_TYPE = 'para-expired-review';
export const EXPIRED_REVIEW_ICON = 'archive-restore';

export class ExpiredReviewView extends ItemView {
	private unsubscribe: (() => void) | null = null;

	constructor(leaf: WorkspaceLeaf, private readonly plugin: ParaInboxReviewPlugin) {
		super(leaf);
	}

	getViewType(): string { return EXPIRED_REVIEW_VIEW_TYPE; }
	getDisplayText(): string { return 'Expired-note review'; }
	getIcon(): string { return EXPIRED_REVIEW_ICON; }

	onOpen(): Promise<void> {
		this.unsubscribe = this.plugin.expiredReviewController.subscribe((session) => this.render(session));
		return Promise.resolve();
	}

	onClose(): Promise<void> {
		this.unsubscribe?.();
		this.unsubscribe = null;
		return Promise.resolve();
	}

	private render(session: ReviewSession | null): void {
		this.contentEl.empty();
		this.contentEl.createEl('h2', { text: 'Expired-note review' });
		if (!session) {
			this.contentEl.createEl('p', { text: 'Start a review from the command palette or ribbon.' });
			return;
		}
		const summary = summarizeSession(session);
		const current = currentInboxItem(session) as ExpiredQueueItem | null;
		this.contentEl.createEl('p', {
			text: `Status: ${session.status}${this.plugin.expiredReviewController.isPending() ? ' (pending)' : ''}`,
		});
		this.contentEl.createEl('p', {
			text: `Processed ${summary.processed}; skipped ${summary.skipped}; remaining ${summary.remainingInInbox}.`,
		});
		if (current) {
			this.contentEl.createEl('p', { text: current.path });
			this.contentEl.createEl('p', {
				text: `${current.expirationProperty}: ${new Date(current.expires).toLocaleDateString()}`,
			});
			const actions = this.contentEl.createDiv({ cls: 'para-inbox-review-actions' });
			const row = actions.createDiv({ cls: 'para-inbox-review-action-row para-inbox-review-category-actions' });
			for (const [label, action] of [
				['Change date', () => this.plugin.changeExpiredDate()],
				['Archive', () => this.plugin.archiveExpiredNote()],
				['Move to trash', () => this.plugin.trashExpiredNote()],
			] as const) {
				const button = row.createEl('button', { text: label });
				button.disabled = this.plugin.expiredReviewController.isPending();
				button.addEventListener('click', () => void action());
			}
			const sessionRow = actions.createDiv({ cls: 'para-inbox-review-action-row para-inbox-review-session-actions' });
			for (const [label, action] of [
				['Skip', () => this.plugin.skipExpiredReview()],
				['Pause', () => this.plugin.pauseExpiredReview()],
				['Close review', () => this.plugin.closeExpiredReview()],
			] as const) {
				const button = sessionRow.createEl('button', { text: label });
				button.disabled = this.plugin.expiredReviewController.isPending();
				button.addEventListener('click', () => void action());
			}
			actions.createEl('p', { cls: 'para-inbox-review-hotkey-hint', text: 'Assign shortcuts in hotkey settings.' });
			return;
		}
		if (session.status === 'halted') {
			this.contentEl.createEl('h3', { text: 'Manual recovery required' });
			this.contentEl.createEl('pre', { text: session.haltReason ?? 'Unknown recovery state' });
		} else if (session.status === 'finished') {
			this.contentEl.createEl('p', { text: 'Expired-note review is complete.' });
		}
	}
}
