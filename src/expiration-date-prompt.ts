import { normalizeLocalDate } from './domain/expired-queue';

export interface ExpirationDateDraft {
	calendarValue: string;
	manualValue: string;
}

export function formatLocalDateInput(date: Date): string {
	const year = String(date.getFullYear()).padStart(4, '0');
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function createExpirationDateDraft(now: Date): ExpirationDateDraft {
	const today = formatLocalDateInput(now);
	return { calendarValue: today, manualValue: today };
}

export function calendarValueFromManual(value: string): string | null {
	return normalizeLocalDate(value);
}
