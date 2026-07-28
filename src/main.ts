import { Notice, Plugin, TFile } from 'obsidian';
import type { ParaCategory } from './domain/operation-plan';
import type { RecoveryDetails } from './domain/transaction-executor';
import {
	confirmTrash,
	chooseProjectArchiveStatus,
	createObsidianActionInput,
	prepareReviewClose,
	requestExpirationDate,
} from './obsidian/action-input';
import { loadInboxQueue } from './obsidian/inbox-loader';
import { createObsidianMutationAdapter } from './obsidian/mutation-adapter';
import { loadExpiredQueue } from './obsidian/expired-loader';
import {
	EXPIRED_REVIEW_ICON,
	EXPIRED_REVIEW_VIEW_TYPE,
	ExpiredReviewView,
} from './obsidian/expired-review-view';
import type { ObsidianMutationPort } from './obsidian/mutation-port';
import {
	ParaInboxReviewView,
	REVIEW_ICON,
	REVIEW_VIEW_TYPE,
} from './obsidian/review-view';
import { ReviewController, type ReviewActionDecision } from './review-controller';
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
import type { ExpiredQueueItem } from './domain/expired-queue';
import { localDayStart, normalizeLocalDate, parseLocalDate } from './domain/expired-queue';
import { sourceInspectionsEqual } from './source-snapshot';
import {
	EXPIRED_REVIEW_COMMANDS,
	type ExpiredReviewCommandAction,
} from './expired-review-commands';

export default class ParaInboxReviewPlugin extends Plugin {
	settings: ParaInboxReviewSettings = DEFAULT_SETTINGS;
	reviewController!: ReviewController;
	expiredReviewController!: ReviewController;
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
		this.expiredReviewController = new ReviewController({
			loadQueue: async () => {
				const result = await loadExpiredQueue(this.app.vault, this.mutation, this.settings);
				if (result.invalid.length > 0) {
					new Notice(`Skipped invalid expiration metadata:\n${result.invalid.join('\n')}`);
				}
				return result.items;
			},
			openNote: (path) => this.openNote(path, 'Expired note'),
		});
		this.registerView(
			REVIEW_VIEW_TYPE,
			(leaf) => new ParaInboxReviewView(leaf, this),
		);
		this.registerView(
			EXPIRED_REVIEW_VIEW_TYPE,
			(leaf) => new ExpiredReviewView(leaf, this),
		);
		this.registerReviewCommands();
		this.registerExpiredReviewCommands();
		this.addRibbonIcon(REVIEW_ICON, 'Open inbox review', () => {
			void this.startReview();
		});
		this.addRibbonIcon(EXPIRED_REVIEW_ICON, 'Open expired-note review', () => {
			void this.startExpiredReview();
		});
		this.addSettingTab(new ParaInboxReviewSettingTab(this.app, this));
	}

	async startExpiredReview(): Promise<void> {
		try {
			await this.expiredReviewController.start();
			await this.activateView(EXPIRED_REVIEW_VIEW_TYPE);
		} catch (error) { new Notice(this.errorMessage(error)); }
	}

	async skipExpiredReview(): Promise<void> {
		try { await this.expiredReviewController.skip(); }
		catch (error) { new Notice(this.errorMessage(error)); }
	}

	pauseExpiredReview(): void {
		try {
			this.expiredReviewController.pause();
			this.app.workspace.detachLeavesOfType(EXPIRED_REVIEW_VIEW_TYPE);
		} catch (error) { new Notice(this.errorMessage(error)); }
	}

	async closeExpiredReview(): Promise<void> {
		try {
			const item = this.currentExpiredItem();
			if (item && !await prepareReviewClose(this.app, item.path)) return;
			this.expiredReviewController.close();
			this.app.workspace.detachLeavesOfType(EXPIRED_REVIEW_VIEW_TYPE);
		} catch (error) { new Notice(this.errorMessage(error)); }
	}

	async changeExpiredDate(): Promise<void> {
		try {
			const result = await this.expiredReviewController.performCurrent(async (baseItem): Promise<ReviewActionDecision<boolean>> => {
				const item = baseItem as ExpiredQueueItem;
				await this.actionInput.saveSource(item.path);
				const before = await this.mutation.inspectSource(item.path);
				const value = await requestExpirationDate(this.app, item.expirationProperty);
				if (value === null) return { transition: 'stay' as const, result: false };
				const normalized = normalizeLocalDate(value);
				const timestamp = parseLocalDate(normalized);
				if (timestamp === null || timestamp < localDayStart(new Date())) {
					new Notice('Expiration date must use YYYY-MM-DD or DD.MM.YYYY and be today or later.');
					return { transition: 'stay' as const, result: false };
				}
				const after = await this.mutation.inspectSource(item.path);
				if (!sourceInspectionsEqual(before, after)) {
					new Notice('The note changed while the new expiration date was being selected.');
					return { transition: 'stay' as const, result: false };
				}
				await this.mutation.setProperty(item.path, {
					name: item.expirationProperty,
					value: normalized,
					type: 'date',
				});
				return { transition: 'complete' as const, result: true };
			});
			if (result) new Notice('Expiration date updated.');
		} catch (error) { new Notice(this.errorMessage(error)); }
	}

	async archiveExpiredNote(): Promise<void> {
		try {
			const result = await this.expiredReviewController.performCurrent(async (baseItem): Promise<ReviewActionDecision<ParaActionResult>> => {
				const item = baseItem as ExpiredQueueItem;
				let status: string | null = null;
				if (item.project) {
					status = await chooseProjectArchiveStatus(this.app, this.settings.projectArchiveStatuses);
					if (status === null) return { transition: 'stay', result: { ok: false, kind: 'canceled' } };
				}
				const action = await this.paraActions.execute(
					item,
					'archives',
					status === null ? undefined : { status: { value: status, type: 'text' } },
				);
				return {
					transition: action.ok ? 'complete' as const : action.kind === 'rollback' ? 'halt' as const : 'stay' as const,
					result: action,
					reason: action.ok || action.kind !== 'rollback' ? undefined : this.recoveryMessage(action),
				};
			});
			this.reportAction(result);
		} catch (error) { new Notice(this.errorMessage(error)); }
	}

	async trashExpiredNote(): Promise<void> {
		try {
			await this.expiredReviewController.performCurrent(async (item) => {
				const action = await executeTrashAction({
					path: item.path,
					mutation: this.mutation,
					input: { saveSource: (path) => this.actionInput.saveSource(path), confirm: (path) => confirmTrash(this.app, path) },
				});
				return { transition: action.ok ? 'complete' as const : 'stay' as const, result: action };
			});
		} catch (error) { new Notice(this.errorMessage(error)); }
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

	private registerExpiredReviewCommands(): void {
		for (const command of EXPIRED_REVIEW_COMMANDS) {
			if (command.action === 'open') {
				this.addCommand({
					id: command.id,
					name: command.name,
					callback: () => this.runExpiredReviewCommand(command.action),
				});
				continue;
			}
			this.addCommand({
				id: command.id,
				name: command.name,
				checkCallback: (checking) => {
					if (!this.expiredReviewController.canRunCurrentAction()) return false;
					if (!checking) this.runExpiredReviewCommand(command.action);
					return true;
				},
			});
		}
	}

	private runExpiredReviewCommand(action: ExpiredReviewCommandAction): void {
		switch (action) {
			case 'open': void this.startExpiredReview(); break;
			case 'reschedule': void this.changeExpiredDate(); break;
			case 'archive': void this.archiveExpiredNote(); break;
			case 'trash': void this.trashExpiredNote(); break;
			case 'skip': void this.skipExpiredReview(); break;
			case 'pause': this.pauseExpiredReview(); break;
			case 'close': void this.closeExpiredReview(); break;
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
		await this.activateView(REVIEW_VIEW_TYPE);
	}

	private async activateView(viewType: string): Promise<void> {
		let leaf = this.app.workspace.getLeavesOfType(viewType)[0];
		if (!leaf) {
			leaf = this.app.workspace.getRightLeaf(false) ??
				this.app.workspace.getLeaf('split', 'vertical');
			await leaf.setViewState({ type: viewType, active: true });
		}
		await this.app.workspace.revealLeaf(leaf);
	}

	private async openNote(path: string, label: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(path);
		if (!(file instanceof TFile)) throw new Error(`${label} no longer exists: ${path}`);
		await this.app.workspace.getLeaf(false).openFile(file);
	}

	private currentExpiredItem(): ExpiredQueueItem | null {
		const session = this.expiredReviewController.getSession();
		return session ? currentInboxItem(session) as ExpiredQueueItem | null : null;
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
