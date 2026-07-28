import {
	FuzzySuggestModal,
	getAllTags,
	MarkdownView,
	Modal,
	Notice,
	normalizePath,
	TFolder,
	type App,
} from 'obsidian';
import type { ParaCategory } from '../domain/operation-plan';
import {
	applyEditorExitChoice,
	hasUnsavedEditorChanges,
	type EditorExitChoice,
} from '../editor-exit';
import type { ParaActionInputPort } from '../para-action-service';
import { ChoiceSettlement } from '../choice-settlement';

class ChoiceModal extends FuzzySuggestModal<string> {
	private readonly settlement: ChoiceSettlement<string>;

	constructor(
		app: App,
		private readonly choices: readonly string[],
		resolveChoice: (choice: string | null) => void,
		title: string,
	) {
		super(app);
		this.settlement = new ChoiceSettlement(resolveChoice);
		this.setTitle(title);
	}

	getItems(): string[] {
		return [...this.choices];
	}

	getItemText(item: string): string {
		return item;
	}

	onChooseItem(item: string): void {
		this.settlement.choose(item);
	}

	onClose(): void {
		this.settlement.close();
	}
}

class TextPromptModal extends Modal {
	private settled = false;
	private input!: HTMLInputElement;

	constructor(
		app: App,
		private readonly resolveValue: (value: string | null) => void,
		title: string,
		private readonly requiredMessage = 'A value is required',
		private readonly placeholder = 'Required',
	) {
		super(app);
		this.setTitle(title);
	}

	onOpen(): void {
		this.input = this.contentEl.createEl('input', {
			cls: 'para-inbox-review-modal-input',
			type: 'text',
			placeholder: this.placeholder,
		});
		this.input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') this.submit();
		});
		const actions = this.contentEl.createDiv({
			cls: 'para-inbox-review-modal-actions',
		});
		const submit = actions.createEl('button', { text: 'Continue' });
		submit.addEventListener('click', () => this.submit());
		this.input.focus();
	}

	onClose(): void {
		if (!this.settled) this.resolveValue(null);
		this.contentEl.empty();
	}

	private submit(): void {
		const value = this.input.value.trim();
		if (value.length === 0) {
			new Notice(this.requiredMessage);
			return;
		}
		this.settled = true;
		this.resolveValue(value);
		this.close();
	}
}

class ConfirmationModal extends Modal {
	private settled = false;

	constructor(
		app: App,
		private readonly message: string,
		private readonly resolveConfirmation: (confirmed: boolean) => void,
	) {
		super(app);
		this.setTitle('Move note to trash?');
	}

	onOpen(): void {
		this.contentEl.createEl('p', { text: this.message });
		const actions = this.contentEl.createDiv({
			cls: 'para-inbox-review-modal-actions',
		});
		const cancel = actions.createEl('button', { text: 'Cancel' });
		cancel.addEventListener('click', () => this.finish(false));
		const confirm = actions.createEl('button', { text: 'Move to trash' });
		confirm.addEventListener('click', () => this.finish(true));
	}

	onClose(): void {
		if (!this.settled) this.resolveConfirmation(false);
		this.contentEl.empty();
	}

	private finish(confirmed: boolean): void {
		this.settled = true;
		this.resolveConfirmation(confirmed);
		this.close();
	}
}

class EditorExitModal extends Modal {
	private settled = false;

	constructor(
		app: App,
		private readonly resolveChoice: (choice: EditorExitChoice) => void,
	) {
		super(app);
		this.setTitle('Close inbox review?');
	}

	onOpen(): void {
		this.contentEl.createEl('p', {
			text: 'The current note has unsaved changes.',
		});
		const actions = this.contentEl.createDiv({
			cls: 'para-inbox-review-modal-actions',
		});
		for (const [label, choice] of [
			['Cancel', 'cancel'],
			['Discard and close', 'discard'],
			['Save and close', 'save'],
		] as const) {
			const button = actions.createEl('button', { text: label });
			button.addEventListener('click', () => this.finish(choice));
		}
	}

	onClose(): void {
		if (!this.settled) this.resolveChoice('cancel');
		this.contentEl.empty();
	}

	private finish(choice: EditorExitChoice): void {
		this.settled = true;
		this.resolveChoice(choice);
		this.close();
	}
}

function choose(
	app: App,
	choices: readonly string[],
	title: string,
): Promise<string | null> {
	return new Promise((resolve) => new ChoiceModal(app, choices, resolve, title).open());
}

function sourceView(app: App, path: string): MarkdownView | null {
	for (const leaf of app.workspace.getLeavesOfType('markdown')) {
		if (leaf.view instanceof MarkdownView && leaf.view.file?.path === path) {
			return leaf.view;
		}
	}
	return null;
}

function folderChoices(app: App, configuredRoot: string): string[] {
	const rootPath = normalizePath(configuredRoot.trim());
	const root = app.vault.getAbstractFileByPath(rootPath);
	if (!(root instanceof TFolder)) {
		throw new Error(`PARA folder does not exist: ${rootPath}`);
	}
	const folders: string[] = [];
	const visit = (folder: TFolder): void => {
		folders.push(folder.path);
		for (const child of folder.children) {
			if (child instanceof TFolder) visit(child);
		}
	};
	visit(root);
	return folders.sort();
}

function areaChoices(app: App): string[] {
	return app.vault.getMarkdownFiles()
		.filter((file) => {
			const cache = app.metadataCache.getFileCache(file);
			return cache !== null &&
				(getAllTags(cache) ?? []).some((tag) => tag.replace(/^#/u, '') === 'area');
		})
		.map((file) => `[[${file.path.replace(/\.md$/iu, '')}]]`)
		.sort();
}

export function createObsidianActionInput(app: App): ParaActionInputPort {
	return {
		async saveSource(path) {
			await sourceView(app, path)?.save();
		},
		selectFolder(category: ParaCategory, root: string) {
			return choose(app, folderChoices(app, root), `Select ${category} folder`);
		},
		async selectArea() {
			const choices = areaChoices(app);
			if (choices.length === 0) throw new Error('No #area notes were found');
			return choose(app, choices, 'Select area note');
		},
		requestArchiveReason() {
			return new Promise((resolve) =>
				new TextPromptModal(app, resolve, 'Archive reason').open(),
			);
		},
	};
}

export function confirmTrash(app: App, path: string): Promise<boolean> {
	return new Promise((resolve) =>
		new ConfirmationModal(app, `Move ${path} to your configured Obsidian trash?`, resolve).open(),
	);
}

export function chooseProjectArchiveStatus(
	app: App,
	statuses: readonly string[],
): Promise<string | null> {
	return choose(app, statuses, 'Project status after archiving');
}

export function requestExpirationDate(
	app: App,
	property: 'deadline' | 'expired_at',
): Promise<string | null> {
	return new Promise((resolve) =>
		new TextPromptModal(
			app,
			resolve,
			`New ${property}`,
			'A valid date is required',
			'YYYY-MM-DD',
		).open(),
	);
}

export async function prepareReviewClose(app: App, path: string): Promise<boolean> {
	const view = sourceView(app, path);
	if (!view) return true;
	const port = {
		getCurrentData: () => view.getViewData(),
		getSavedData: () => view.data,
		save: () => view.save(),
		discard: () => {
			view.setViewData(view.data, true);
		},
	};
	if (!hasUnsavedEditorChanges(port)) return true;

	const choice = await new Promise<EditorExitChoice>((resolve) =>
		new EditorExitModal(app, resolve).open(),
	);
	return applyEditorExitChoice(port, choice);
}
