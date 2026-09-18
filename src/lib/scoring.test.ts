import { describe, expect, it } from 'vitest';
import {
	blockAverages,
	criterionAverages,
	isCountedRating,
	mean,
	overallScore,
	roundScore,
	scoreVisit,
	scoreVisits,
	terraceStatus,
	type Ratings
} from './scoring';

const empty: Ratings = {
	beaute: null,
	emplacement: null,
	terrasse: null,
	choixBieres: null,
	qualiteBiere: null,
	soiree: null
};

function r(partial: Partial<Ratings>): Ratings {
	return { ...empty, ...partial };
}

describe('mean / isCountedRating', () => {
	it('returns null for an empty list', () => {
		expect(mean([])).toBeNull();
	});
	it('averages values', () => {
		expect(mean([1, 2, 3, 4])).toBe(2.5);
	});
	it('only counts ratings between 1 and 5', () => {
		expect(isCountedRating(1)).toBe(true);
		expect(isCountedRating(5)).toBe(true);
		expect(isCountedRating(0)).toBe(false);
		expect(isCountedRating(6)).toBe(false);
		expect(isCountedRating(null)).toBe(false);
		expect(isCountedRating(Number.NaN)).toBe(false);
		expect(isCountedRating('4')).toBe(false);
	});
});

describe('scoreVisit (un passage seul)', () => {
	it('uses only the evening when nothing else is rated', () => {
		const s = scoreVisit(r({ soiree: 4 }));
		expect(s.blocks).toEqual({ lieu: null, biere: null, moment: 4 });
		expect(s.overall).toBe(4);
	});

	it('averages criteria within a block, then blocks with equal weight', () => {
		const s = scoreVisit(
			r({ beaute: 4, emplacement: 2, terrasse: 3, choixBieres: 5, qualiteBiere: 3, soiree: 1 })
		);
		expect(s.blocks.lieu).toBe(3);
		expect(s.blocks.biere).toBe(4);
		expect(s.blocks.moment).toBe(1);
		expect(s.overall).toBeCloseTo(8 / 3, 10);
	});

	it('gives each block the same weight regardless of its number of criteria', () => {
		// Lieu a 3 critères, Moment 1 : ils pèsent pareil.
		const s = scoreVisit(r({ beaute: 5, emplacement: 5, terrasse: 5, soiree: 1 }));
		expect(s.overall).toBe(3);
	});

	it('excludes "pas de terrasse" (0) from every average', () => {
		const s = scoreVisit(r({ beaute: 4, terrasse: 0, soiree: 4 }));
		expect(s.criteria.terrasse).toBeNull();
		expect(s.blocks.lieu).toBe(4);
		expect(s.overall).toBe(4);
	});

	it('returns null everywhere when nothing is rated', () => {
		const s = scoreVisit(empty);
		expect(s.overall).toBeNull();
		expect(s.blocks).toEqual({ lieu: null, biere: null, moment: null });
	});

	it('never counts the mood, even if passed along', () => {
		const withMood = { ...r({ soiree: 2 }), humeur: 5 } as unknown as Ratings;
		expect(scoreVisit(withMood).overall).toBe(2);
	});

	it('ignores out-of-range values defensively', () => {
		const s = scoreVisit(r({ beaute: 9, emplacement: -1, soiree: 3 }));
		expect(s.blocks.lieu).toBeNull();
		expect(s.overall).toBe(3);
	});
});

describe('scoreVisits (un bar)', () => {
	it('averages each criterion over visits before computing blocks', () => {
		// A : beauté 5, emplacement 5, soirée 5 ; B : emplacement 1, soirée 3.
		// Critères : beauté 5, emplacement 3 → Lieu 4 ; soirée 4 → Moment 4 ; note 4.
		// (La moyenne des notes de passage donnerait 3,5 : ce n'est pas la règle.)
		const s = scoreVisits([
			r({ beaute: 5, emplacement: 5, soiree: 5 }),
			r({ emplacement: 1, soiree: 3 })
		]);
		expect(s.criteria.beaute).toBe(5);
		expect(s.criteria.emplacement).toBe(3);
		expect(s.blocks.lieu).toBe(4);
		expect(s.blocks.moment).toBe(4);
		expect(s.overall).toBe(4);
	});

	it('skips blocks that nobody rated', () => {
		const s = scoreVisits([r({ soiree: 2, choixBieres: 4 }), r({ soiree: 4 })]);
		expect(s.blocks.lieu).toBeNull();
		expect(s.blocks.biere).toBe(4);
		expect(s.blocks.moment).toBe(3);
		expect(s.overall).toBe(3.5);
	});

	it('ignores "pas de terrasse" votes in the terrace average', () => {
		const s = scoreVisits([
			r({ terrasse: 0, soiree: 3 }),
			r({ terrasse: 4, soiree: 3 }),
			r({ terrasse: 2, soiree: 3 })
		]);
		expect(s.criteria.terrasse).toBe(3);
	});

	it('returns null for a bar without visits', () => {
		expect(scoreVisits([]).overall).toBeNull();
	});

	it('exposes composable helpers', () => {
		const criteria = criterionAverages([r({ qualiteBiere: 4, soiree: 2 })]);
		const blocks = blockAverages(criteria);
		expect(blocks).toEqual({ lieu: null, biere: 4, moment: 2 });
		expect(overallScore(blocks)).toBe(3);
	});
});

describe('terraceStatus', () => {
	it('is null when nobody said anything about the terrace', () => {
		expect(terraceStatus([null, null])).toBeNull();
		expect(terraceStatus([])).toBeNull();
	});
	it('follows the majority of visits that filled it in', () => {
		expect(terraceStatus([0, 0, 4, null, null])).toBe('non');
		expect(terraceStatus([3, 5, 0])).toBe('oui');
	});
	it('says yes on a tie', () => {
		expect(terraceStatus([0, 2])).toBe('oui');
	});
});

describe('roundScore', () => {
	it('rounds to one decimal', () => {
		expect(roundScore(4.25)).toBe(4.3);
		expect(roundScore(8 / 3)).toBe(2.7);
		expect(roundScore(null)).toBeNull();
	});
});
