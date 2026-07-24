import { Notice, Plugin, TFile } from 'obsidian';
import type { ParaCategory } from './domain/operation-plan';
import type { RecoveryDetails } from './domain/transaction-executor';
import {
	confirmTrash,
	createObsidianActionInput,
} from './obsidian/action-input';
import { loadInboxQueue } from './obsidian/inbox-loader';
import { createObsidianMutationAdapter } from './obsidian/mutation-adapter';
import type { ObsidianMutationPort } from './obsidian/mutation-port';
import {
	ParaInboxReviewView,
	REVIEW_VIEW_TYPE,
} from './obsidian/review-view';
import { ReviewController } from './review-controller';
import {
	ParaActionService,
	type ParaActionInputPort,
	type ParaActionResult,
} from './para-action-service';
import {
	DEFAULT_SETTINGS,
	ParaInboxReviewSettingTab,
	type ParaInboxReviewSettings,
} from './settings';

export default class ParaInboxReviewPlugin extends Plugin {
	settings: ParaInboxReviewSettings = DEFAULT_SETTINGS;
	reviewController!: ReviewController;
	private mutation!: ObsidianMutationPort;
	private actionInput!: ParaActionInputPort;
	private paraActions!: ParaActionService;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.mutation = createObsidianMutationAdapter(this.app);
		this.actionInput = createObsidianActionInput(this.app);
		this.paraActions = new ParaActionService(
			this.mutation,
			this.actionInput,
			() => this.settings,
		);
		this.reviewController = new ReviewController({
			loadQueue: () =>
				Promise.resolve(loadInboxQueue(this.app.vault, this.settings.inboxFolder)),
			openNote: async (path) => {
				const file = this.app.vault.getAbstractFileByPath(path);
				if (!(file instanceof TFile)) {
					throw new Error(`Inbox note no longer exists: ${path}`);
				}
				await this.app.workspace.getLeaf(false).openFile(file);
			},
		});
		this.registerView(
			REVIEW_VIEW_TYPE,
			(leaf) => new ParaInboxReviewView(leaf, this),
		);
		this.addCommand({
			id: 'open-inbox-review',
			name: 'Open inbox review',
			callback: () => void this.startReview(),
		});
		this.addRibbonIcon('inbox', 'Open inbox review', () => {
			void this.startReview();
		});
		this.addSettingTab(new ParaInboxReviewSettingTab(this.app, this));
	}

	async startReview(): Promise<void> {
		try {
			await this.reviewController.start();
			await this.activateReviewView();
		} catch (error) {
			new Notice(this.errorMessage(error));
		}
	}

	async skipReview(): Promise<void> {
		try {
			await this.reviewController.skip();
		} catch (error) {
			new Notice(this.errorMessage(error));
		}
	}

	pauseReview(): void {
		try {
			this.reviewController.pause();
		} catch (error) {
			new Notice(this.errorMessage(error));
		}
	}

	closeReview(): void {
		try {
			this.reviewController.close();
			this.app.workspace.detachLeavesOfType(REVIEW_VIEW_TYPE);
		} catch (error) {
			new Notice(this.errorMessage(error));
		}
	}

	async sortReview(category: ParaCategory): Promise<void> {
		try {
			const result = await this.reviewController.performCurrent(async (item) => {
				const action = await this.paraActions.execute(item, category);
				return {
					transition: action.ok
						? 'complete' as const
						: action.kind === 'rollback'
							? 'halt' as const
							: 'stay' as const,
					result: action,
					reason: action.ok || action.kind !== 'rollback'
						? undefined
						: this.recoveryMessage(action),
				};
			});
			this.reportAction(result);
		} catch (error) {
			new Notice(this.errorMessage(error));
		}
	}

	async trashReview(): Promise<void> {
		try {
			await this.reviewController.performCurrent(async (item) => {
				if (!await confirmTrash(this.app, item.path)) {
					return { transition: 'stay', result: false } as const;
				}
				await this.actionInput.saveSource(item.path);
				await this.mutation.trashFile(item.path);
				return { transition: 'complete', result: true } as const;
			});
		} catch (error) {
			new Notice(this.errorMessage(error));
		}
	}

	private async activateReviewView(): Promise<void> {
		let leaf = this.app.workspace.getLeavesOfType(REVIEW_VIEW_TYPE)[0];
		if (!leaf) {
			leaf = this.app.workspace.getRightLeaf(false) ??
				this.app.workspace.getLeaf('split', 'vertical');
			await leaf.setViewState({ type: REVIEW_VIEW_TYPE, active: true });
		}
		await this.app.workspace.revealLeaf(leaf);
	}

	private errorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}

	private reportAction(result: ParaActionResult): void {
		if (result.ok || result.kind === 'canceled') return;
		new Notice(result.kind === 'rollback' ? this.recoveryMessage(result) : result.message);
	}

	private recoveryMessage(result: { recovery: RecoveryDetails }): string {
		const failures = result.recovery.rollbackFailures
			.map((failure) => `${failure.action} ${failure.property}: ${failure.message}`)
			.join('; ');
		return `Manual recovery required for ${result.recovery.source}. ` +
			`Original failure: ${result.recovery.failure}. Rollback failures: ${failures}`;
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<ParaInboxReviewSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...stored };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
