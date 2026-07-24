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
import type { ParaActionInputPort } from '../para-action-service';

class ChoiceModal extends FuzzySuggestModal<string> {
	private settled = false;

	constructor(
		app: App,
		private readonly choices: readonly string[],
		private readonly resolveChoice: (choice: string | null) => void,
		title: string,
	) {
		super(app);
		this.setTitle(title);
	}

	getItems(): string[] {
		return [...this.choices];
	}

	getItemText(item: string): string {
		return item;
	}

	onChooseItem(item: string): void {
		this.settled = true;
		this.resolveChoice(item);
	}

	onClose(): void {
		if (!this.settled) this.resolveChoice(null);
	}
}

class TextPromptModal extends Modal {
	private settled = false;
	private input!: HTMLInputElement;

	constructor(
		app: App,
		private readonly resolveValue: (value: string | null) => void,
		title: string,
	) {
		super(app);
		this.setTitle(title);
	}

	onOpen(): void {
		this.input = this.contentEl.createEl('input', {
			type: 'text',
			placeholder: 'Required',
		});
		this.input.addEventListener('keydown', (event) => {
			if (event.key === 'Enter') this.submit();
		});
		const submit = this.contentEl.createEl('button', { text: 'Continue' });
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
			new Notice('Archive reason is required');
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
		const actions = this.contentEl.createDiv();
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

function choose(
	app: App,
	choices: readonly string[],
	title: string,
): Promise<string | null> {
	return new Promise((resolve) => new ChoiceModal(app, choices, resolve, title).open());
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
			for (const leaf of app.workspace.getLeavesOfType('markdown')) {
				if (leaf.view instanceof MarkdownView && leaf.view.file?.path === path) {
					await leaf.view.save();
					return;
				}
			}
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
