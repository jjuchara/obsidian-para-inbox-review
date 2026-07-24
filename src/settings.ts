import { App, PluginSettingTab, Setting } from 'obsidian';
import type ParaInboxReviewPlugin from './main';

export interface ParaInboxReviewSettings {
	inboxFolder: string;
	projectsFolder: string;
	areasFolder: string;
	resourcesFolder: string;
	archivesFolder: string;
}

export const DEFAULT_SETTINGS: ParaInboxReviewSettings = {
	inboxFolder: '6. Inbox',
	projectsFolder: '1. Projects',
	areasFolder: '2. Areas',
	resourcesFolder: '3. Resources',
	archivesFolder: '4. Archives',
};

type FolderSettingKey = keyof ParaInboxReviewSettings;

const FOLDER_SETTINGS: ReadonlyArray<{
	key: FolderSettingKey;
	name: string;
	description: string;
}> = [
	{ key: 'inboxFolder', name: 'Inbox folder', description: 'Vault-relative folder reviewed as a FIFO queue.' },
	{ key: 'projectsFolder', name: 'Projects folder', description: 'Vault-relative root for project notes.' },
	{ key: 'areasFolder', name: 'Areas folder', description: 'Vault-relative root for area notes.' },
	{ key: 'resourcesFolder', name: 'Resources folder', description: 'Vault-relative root for resource notes.' },
	{ key: 'archivesFolder', name: 'Archives folder', description: 'Vault-relative root for archived notes.' },
];

export class ParaInboxReviewSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly plugin: ParaInboxReviewPlugin) {
		super(app, plugin);
	}

	display(): void {
		this.containerEl.empty();

		for (const definition of FOLDER_SETTINGS) {
			new Setting(this.containerEl)
				.setName(definition.name)
				.setDesc(definition.description)
				.addText((text) =>
					text
						.setPlaceholder('Folder/path')
						.setValue(this.plugin.settings[definition.key])
						.onChange(async (value) => {
							this.plugin.settings[definition.key] = value.trim();
							await this.plugin.saveSettings();
						}),
				);
		}
	}
}
