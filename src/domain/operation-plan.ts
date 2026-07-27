export type ParaCategory = 'projects' | 'areas' | 'resources' | 'archives';

export type MetadataRecord = Record<string, unknown>;

export type PropertyType =
	| 'checkbox'
	| 'date'
	| 'datetime'
	| 'list'
	| 'text';

export interface MetadataContext {
	created?: string;
	archived?: string;
	area?: string;
	archiveReason?: string;
}

export interface ParaMetadataConfig {
	projectsLink?: string;
	areasLink?: string;
}

export interface PropertyAddition {
	name: string;
	value: unknown;
	type: PropertyType;
}

export type CompensationStep =
	| { action: 'remove'; name: string }
	| {
			action: 'set';
			name: string;
			value: unknown;
			type: PropertyType;
	  };

export interface MetadataNormalization {
	metadata: MetadataRecord;
	additions: PropertyAddition[];
	missing: string[];
}

export interface ParaOperationPlan {
	preflight: {
		path: string;
		destination: string;
		missing: string[];
	};
	snapshot: MetadataRecord;
	apply: PropertyAddition[];
	move: { path: string; destination: string };
	compensate: CompensationStep[];
	metadata: MetadataRecord;
}

function clone<T>(value: T): T {
	return structuredClone(value);
}

function hasValue(value: unknown): boolean {
	return value !== null && value !== undefined &&
		(typeof value !== 'string' || value.trim().length > 0);
}

function tagList(value: unknown): unknown[] {
	if (Array.isArray(value)) return clone(value);
	if (typeof value === 'string' && value.trim().length > 0) return [value];
	if (value !== null && value !== undefined && value !== '') {
		throw new Error('The tags property must be a string or list');
	}
	return [];
}

function addRequiredTag(
	metadata: MetadataRecord,
	tag: string,
): unknown[] | null {
	const tags = tagList(metadata.tags);
	const present = tags.some(
		(existing) =>
			typeof existing === 'string' && existing.replace(/^#/, '') === tag,
	);
	if (present) return null;

	tags.push(tag);
	metadata.tags = tags;
	return tags;
}

function addMissing(
	metadata: MetadataRecord,
	additions: PropertyAddition[],
	name: string,
	value: unknown,
	type: PropertyType,
): void {
	if (hasValue(metadata[name]) || !hasValue(value)) return;
	metadata[name] = clone(value);
	additions.push({ name, value: clone(value), type });
}

export function normalizeParaMetadata(
	category: ParaCategory,
	existing: Readonly<MetadataRecord>,
	context: Readonly<MetadataContext>,
	config: Readonly<ParaMetadataConfig>,
): MetadataNormalization {
	const metadata = clone(existing);
	const additions: PropertyAddition[] = [];
	const missing: string[] = [];

	addMissing(metadata, additions, 'created', context.created, 'datetime');

	const requiredTag: Partial<Record<ParaCategory, string>> = {
		projects: 'projects',
		areas: 'area',
		resources: 'resources',
	};
	const tag = requiredTag[category];
	if (tag) {
		const tags = addRequiredTag(metadata, tag);
		if (tags) additions.push({ name: 'tags', value: clone(tags), type: 'list' });
	}

	switch (category) {
		case 'projects':
			addMissing(metadata, additions, 'links', config.projectsLink, 'text');
			addMissing(metadata, additions, 'status', 'Планируется', 'text');
			break;
		case 'areas':
			addMissing(metadata, additions, 'links', config.areasLink, 'text');
			addMissing(metadata, additions, 'listShow', true, 'checkbox');
			break;
		case 'archives':
			addMissing(metadata, additions, 'archived', context.archived, 'date');
			break;
		case 'resources':
			break;
	}

	if (
		(category === 'projects' || category === 'resources') &&
		!hasValue(metadata.area)
	) {
		if (hasValue(context.area)) {
			addMissing(metadata, additions, 'area', context.area, 'text');
		} else {
			missing.push('area');
		}
	}

	if (category === 'archives' && !hasValue(metadata.archive_reason)) {
		if (hasValue(context.archiveReason)) {
			addMissing(
				metadata,
				additions,
				'archive_reason',
				context.archiveReason,
				'text',
			);
		} else {
			missing.push('archive_reason');
		}
	}

	if (!hasValue(metadata.created)) missing.push('created');
	if (category === 'archives' && !hasValue(metadata.archived)) {
		missing.push('archived');
	}

	return { metadata, additions, missing };
}

export function buildParaOperationPlan(options: {
	path: string;
	destination: string;
	category: ParaCategory;
	existing: Readonly<MetadataRecord>;
	context: Readonly<MetadataContext>;
	config: Readonly<ParaMetadataConfig>;
}): ParaOperationPlan {
	const normalization = normalizeParaMetadata(
		options.category,
		options.existing,
		options.context,
		options.config,
	);
	const compensate: CompensationStep[] = normalization.additions
		.slice()
		.reverse()
		.map((step) => {
			const oldValue = options.existing[step.name];
			return Object.prototype.hasOwnProperty.call(options.existing, step.name)
				? {
					action: 'set' as const,
					name: step.name,
					value: clone(oldValue),
					type: step.type,
				}
				: { action: 'remove' as const, name: step.name };
		});

	return {
		preflight: {
			path: options.path,
			destination: options.destination,
			missing: [...normalization.missing],
		},
		snapshot: clone(options.existing),
		apply: clone(normalization.additions),
		move: { path: options.path, destination: options.destination },
		compensate,
		metadata: clone(normalization.metadata),
	};
}
