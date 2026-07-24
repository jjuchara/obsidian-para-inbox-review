export class ChoiceSettlement<Value> {
	private settled = false;
	private choice: Value | null = null;

	constructor(
		private readonly resolve: (value: Value | null) => void,
		private readonly schedule: (callback: () => void) => void = (callback) =>
			window.setTimeout(callback, 0),
	) {}

	choose(value: Value): void {
		if (this.settled) return;
		this.choice = value;
	}

	close(): void {
		this.schedule(() => {
			if (this.settled) return;
			this.settled = true;
			this.resolve(this.choice);
		});
	}
}
