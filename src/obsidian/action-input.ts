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
import {
	calendarValueFromManual,
	createExpirationDateDraft,
	formatLocalDateInput,
} from '../expiration-date-prompt';

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

class ExpirationDateModal extends Modal {
	private settled = false;
	private mode: 'calendar' | 'manual' = 'calendar';
	private input!: HTMLInputElement;
	private modeButton!: HTMLButtonElement;
	private readonly today: string;
	private readonly draft;

	constructor(
		app: App,
		private readonly resolveValue: (value: string | null) => void,
		private readonly property: 'deadline' | 'expired_at',
		now = new Date(),
	) {
		super(app);
		this.today = formatLocalDateInput(now);
		this.draft = createExpirationDateDraft(now);
		this.setTitle('New expiration date');
	}

	onOpen(): void {
		const field = this.contentEl.createEl('label', {
			cls: 'para-inbox-review-date-field',
		});
		field.createSpan({
			cls: 'para-inbox-review-date-label',
			text: `Property: ${this.property}`,
		});
		this.input = field.createEl('input', {
			cls: 'para-inbox-review-modal-input',
		});
		this.input.addEventListener('input', () => this.rememberCurrentValue());
		this.input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') this.submit();
		});
		this.contentEl.createEl('p', {
			cls: 'para-inbox-review-date-hint',
			text: 'Choose today or later. The property is saved in the canonical format.',
		});

		const actions = this.contentEl.createDiv({
			cls: 'para-inbox-review-modal-actions',
		});
		this.modeButton = actions.createEl('button', {
			cls: 'para-inbox-review-date-mode',
		});
		this.modeButton.addEventListener('click', () => this.toggleMode());
		const submit = actions.createEl('button', {
			cls: 'mod-cta',
			text: 'Continue',
		});
		submit.addEventListener('click', () => this.submit());

		this.renderMode();
	}

	onClose(): void {
		if (!this.settled) this.resolveValue(null);
		this.contentEl.empty();
	}

	private rememberCurrentValue(): void {
		if (this.mode === 'calendar') this.draft.calendarValue = this.input.value;
		else this.draft.manualValue = this.input.value;
	}

	private toggleMode(): void {
		this.rememberCurrentValue();
		if (this.mode === 'calendar') {
			this.mode = 'manual';
			this.renderMode();
			return;
		}

		const normalized = calendarValueFromManual(this.draft.manualValue);
		if (normalized === null) {
			new Notice('Enter a valid YYYY-MM-DD or DD.MM.YYYY date before using the calendar.');
			return;
		}
		this.draft.calendarValue = normalized;
		this.mode = 'calendar';
		this.renderMode();
	}

	private renderMode(): void {
		if (this.mode === 'calendar') {
			this.input.type = 'date';
			this.input.min = this.today;
			this.input.placeholder = '';
			this.input.value = this.draft.calendarValue;
			this.modeButton.setText('Enter manually');
		} else {
			this.input.type = 'text';
			this.input.removeAttribute('min');
			this.input.placeholder = 'YYYY-MM-DD or DD.MM.YYYY';
			this.input.value = this.draft.manualValue;
			this.modeButton.setText('Use calendar');
		}
		this.input.focus();
	}

	private submit(): void {
		this.rememberCurrentValue();
		const value = this.mode === 'calendar'
			? this.draft.calendarValue
			: this.draft.manualValue.trim();
		if (value.length === 0) {
			new Notice('A valid date is required');
			return;
		}
		if (this.mode === 'calendar' && !this.input.checkValidity()) {
			new Notice('Choose today or a later date.');
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
		new ExpirationDateModal(app, resolve, property).open(),
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
