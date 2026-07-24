import { Notice, Plugin, TFile } from 'obsidian';
import { loadInboxQueue } from './obsidian/inbox-loader';
import {
	ParaInboxReviewView,
	REVIEW_VIEW_TYPE,
} from './obsidian/review-view';
import { ReviewController } from './review-controller';
import {
	DEFAULT_SETTINGS,
	ParaInboxReviewSettingTab,
	type ParaInboxReviewSettings,
} from './settings';

export default class ParaInboxReviewPlugin extends Plugin {
	settings: ParaInboxReviewSettings = DEFAULT_SETTINGS;
	reviewController!: ReviewController;

	async onload(): Promise<void> {
		await this.loadSettings();
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

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<ParaInboxReviewSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...stored };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
