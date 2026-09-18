import { describe, expect, it } from 'vitest';
import { competitionRanks, isTied, ordinal, rankOf, tallyGroups } from './ranking';

const p = (key: string, barCount: number, visitCount: number) => ({ key, barCount, visitCount });

describe('competitionRanks', () => {
	it('gives the same rank to people with the same bars and visits, then skips', () => {
		const people = [p('a', 5, 9), p('b', 4, 6), p('c', 4, 6), p('d', 4, 5), p('e', 1, 1)];
		expect(competitionRanks(people)).toEqual([1, 2, 2, 4, 5]);
	});

	it('does not tie people with the same bars but different visits', () => {
		expect(competitionRanks([p('a', 3, 5), p('b', 3, 4)])).toEqual([1, 2]);
	});

	it('handles an empty list and a leading tie', () => {
		expect(competitionRanks([])).toEqual([]);
		expect(competitionRanks([p('a', 2, 2), p('b', 2, 2), p('c', 2, 2)])).toEqual([1, 1, 1]);
	});
});

describe('rankOf / isTied', () => {
	const people = [p('a', 5, 9), p('b', 4, 6), p('c', 4, 6), p('d', 1, 1)];

	it('finds the rank of a key', () => {
		expect(rankOf(people, 'a')).toBe(1);
		expect(rankOf(people, 'c')).toBe(2);
		expect(rankOf(people, 'd')).toBe(4);
		expect(rankOf(people, 'zzz')).toBeNull();
	});

	it('tells whether a position is shared', () => {
		const ranks = competitionRanks(people);
		expect([0, 1, 2, 3].map((i) => isTied(ranks, i))).toEqual([false, true, true, false]);
	});
});

describe('ordinal', () => {
	it('writes French ordinals', () => {
		expect(ordinal(1)).toBe('1er');
		expect(ordinal(2)).toBe('2e');
		expect(ordinal(11)).toBe('11e');
	});
});

describe('tallyGroups', () => {
	it('packs marks by five', () => {
		expect(tallyGroups(0)).toEqual({ groups: [], overflow: 0 });
		expect(tallyGroups(3)).toEqual({ groups: [3], overflow: 0 });
		expect(tallyGroups(5)).toEqual({ groups: [5], overflow: 0 });
		expect(tallyGroups(7)).toEqual({ groups: [5, 2], overflow: 0 });
	});

	it('stops at max and reports the rest', () => {
		expect(tallyGroups(23, 20)).toEqual({ groups: [5, 5, 5, 5], overflow: 3 });
		expect(tallyGroups(12, 10)).toEqual({ groups: [5, 5], overflow: 2 });
	});

	it('ignores junk input', () => {
		expect(tallyGroups(-4)).toEqual({ groups: [], overflow: 0 });
		expect(tallyGroups(Number.NaN)).toEqual({ groups: [], overflow: 0 });
		expect(tallyGroups(2.9)).toEqual({ groups: [2], overflow: 0 });
	});
});
