import { Plugin } from 'obsidian';
import {
	DEFAULT_SETTINGS,
	ParaInboxReviewSettingTab,
	type ParaInboxReviewSettings,
} from './settings';

export default class ParaInboxReviewPlugin extends Plugin {
	settings: ParaInboxReviewSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new ParaInboxReviewSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		const stored = (await this.loadData()) as Partial<ParaInboxReviewSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...stored };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
