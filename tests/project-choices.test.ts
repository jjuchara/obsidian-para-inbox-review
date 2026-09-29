import assert from 'node:assert/strict';
import test from 'node:test';
import { projectChoices } from '../src/project-choices';

void test('offers only tagged main project notes under configured Projects root', () => {
	assert.deepEqual(projectChoices('1. Projects', [
		{ path: '1. Projects/Alpha.md', tags: ['#projects'] },
		{ path: '1. Projects/Beta/00. Beta.md', tags: ['#projects', '#support'] },
		{ path: '1. Projects/Beta/README.md', tags: ['#documentation'] },
		{ path: '1. Projects/Beta/Project documentation.md', tags: ['#projects'] },
		{ path: '1. Projects/Beta/docs/Deep.md', tags: ['#projects'] },
		{ path: 'Other/Outside.md', tags: ['#projects'] },
	]), [
		'[[1. Projects/Alpha]]',
		'[[1. Projects/Beta/00. Beta]]',
	]);
});
