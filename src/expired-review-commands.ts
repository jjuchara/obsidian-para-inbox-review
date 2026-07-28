export type ExpiredReviewCommandAction =
	| 'open'
	| 'reschedule'
	| 'archive'
	| 'trash'
	| 'skip'
	| 'pause'
	| 'close';

export interface ExpiredReviewCommandSpec {
	id: string;
	name: string;
	action: ExpiredReviewCommandAction;
}

export const EXPIRED_REVIEW_COMMANDS: readonly ExpiredReviewCommandSpec[] = [
	{ id: 'open-expired-note-review', name: 'Open expired-note review', action: 'open' },
	{
		id: 'change-expired-note-date',
		name: 'Change current expiration date',
		action: 'reschedule',
	},
	{ id: 'archive-expired-note', name: 'Archive current expired note', action: 'archive' },
	{ id: 'trash-expired-note', name: 'Move current expired note to trash', action: 'trash' },
	{ id: 'skip-expired-note', name: 'Skip current expired note', action: 'skip' },
	{ id: 'pause-expired-note-review', name: 'Pause expired-note review', action: 'pause' },
	{ id: 'close-expired-note-review', name: 'Close expired-note review', action: 'close' },
];
