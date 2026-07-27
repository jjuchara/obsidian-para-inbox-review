export type EditorExitChoice = 'cancel' | 'discard' | 'save';

export interface EditorExitPort {
	getCurrentData(): string;
	getSavedData(): string;
	save(): Promise<void>;
	discard(): void;
}

export function hasUnsavedEditorChanges(port: EditorExitPort): boolean {
	return port.getCurrentData() !== port.getSavedData();
}

export async function applyEditorExitChoice(
	port: EditorExitPort,
	choice: EditorExitChoice,
): Promise<boolean> {
	if (choice === 'cancel') return false;
	if (choice === 'save') await port.save();
	else port.discard();
	return true;
}
