import { Notice, Plugin, TFile } from 'obsidian';
import type { ParaCategory } from './domain/operation-plan';
import type { RecoveryDetails } from './domain/transaction-executor';
import {
	confirmTrash,
	createObsidianActionInput,
	prepareReviewClose,
} from './obsidian/action-input';
import { loadInboxQueue } from './obsidian/inbox-loader';
import { createObsidianMutationAdapter } from './obsidian/mutation-adapter';
import type { ObsidianMutationPort } from './obsidian/mutation-port';
import {
	ParaInboxReviewView,
	REVIEW_ICON,
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
import { executeTrashAction } from './trash-action-service';
import { currentInboxItem } from './domain/review-session';
import {
	REVIEW_COMMANDS,
	type ReviewCommandAction,
} from './review-commands';

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
		this.registerReviewCommands();
		this.addRibbonIcon(REVIEW_ICON, 'Open inbox review', () => {
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
			this.app.workspace.detachLeavesOfType(REVIEW_VIEW_TYPE);
		} catch (error) {
			new Notice(this.errorMessage(error));
		}
	}

	async closeReview(): Promise<void> {
		try {
			const session = this.reviewController.getSession();
			const item = session ? currentInboxItem(session) : null;
			if (item && !await prepareReviewClose(this.app, item.path)) return;
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
			const result = await this.reviewController.performCurrent(async (item) => {
				const action = await executeTrashAction({
					path: item.path,
					mutation: this.mutation,
					input: {
						saveSource: (path) => this.actionInput.saveSource(path),
						confirm: (path) => confirmTrash(this.app, path),
					},
				});
				return {
					transition: action.ok ? 'complete' : 'stay',
					result: action,
				} as const;
			});
			if (!result.ok && result.kind === 'source_changed') {
				new Notice(result.message);
			}
		} catch (error) {
			new Notice(this.errorMessage(error));
		}
	}

	private registerReviewCommands(): void {
		for (const command of REVIEW_COMMANDS) {
			if (command.action.kind === 'open') {
				this.addCommand({
					id: command.id,
					name: command.name,
					callback: () => this.runReviewCommand(command.action),
				});
				continue;
			}
			this.addCommand({
				id: command.id,
				name: command.name,
				checkCallback: (checking) => {
					if (!this.reviewController.canRunCurrentAction()) return false;
					if (!checking) this.runReviewCommand(command.action);
					return true;
				},
			});
		}
	}

	private runReviewCommand(action: ReviewCommandAction): void {
		switch (action.kind) {
			case 'open': void this.startReview(); break;
			case 'sort': void this.sortReview(action.category); break;
			case 'skip': void this.skipReview(); break;
			case 'pause': this.pauseReview(); break;
			case 'trash': void this.trashReview(); break;
			case 'close': void this.closeReview(); break;
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
