import { describe, expect, it } from 'vitest';
import { compareBarsByScore, rankPeople, summarizeVisits } from './stats';
import type { BarSummary } from './types';
import type { VisitInput } from './validation';

function visit(p: Partial<VisitInput>): VisitInput {
	return {
		pseudo: 'Jim',
		date: '2026-09-01',
		beaute: null,
		emplacement: null,
		terrasse: null,
		choixBieres: null,
		qualiteBiere: null,
		soiree: 3,
		ambiances: [],
		humeur: null,
		prixCents: null,
		commentaire: null,
		...p
	};
}

describe('summarizeVisits', () => {
	it('aggregates scores, terrace, ambiances, price and dates', () => {
		const s = summarizeVisits([
			visit({ soiree: 4, terrasse: 4, ambiances: ['chill', 'cosy'], prixCents: 600, date: '2026-09-02' }),
			visit({ soiree: 2, terrasse: 0, ambiances: ['cosy'], prixCents: 701, humeur: 5 }),
			visit({ soiree: 3, ambiances: ['festif'], date: '2026-09-10' })
		]);
		expect(s.overall).toBe(3.5); // Lieu 4 (terrasse), Moment 3
		expect(s.terrace).toBe('oui');
		expect(s.ambiances).toEqual([
			{ slug: 'cosy', count: 2 },
			{ slug: 'chill', count: 1 },
			{ slug: 'festif', count: 1 }
		]);
		expect(s.avgPriceCents).toBe(651);
		expect(s.visitCount).toBe(3);
		expect(s.lastVisitDate).toBe('2026-09-10');
	});

	it('handles a bar without visits', () => {
		const s = summarizeVisits([]);
		expect(s.overall).toBeNull();
		expect(s.terrace).toBeNull();
		expect(s.avgPriceCents).toBeNull();
		expect(s.lastVisitDate).toBeNull();
	});
});

describe('compareBarsByScore', () => {
	const bar = (name: string, overall: number | null, visitCount = 1) =>
		({ name, overall, visitCount }) as BarSummary;
	it('sorts by score, unrated last, then visits, then name', () => {
		const sorted = [bar('C', null), bar('B', 4), bar('A', 4, 3), bar('D', 4.5)].sort(compareBarsByScore);
		expect(sorted.map((b) => b.name)).toEqual(['D', 'A', 'B', 'C']);
	});
});

describe('rankPeople', () => {
	it('groups pseudos by key and ranks by distinct bars, then visits', () => {
		const people = rankPeople([
			{ pseudo: 'élodie', pseudoKey: 'elodie', barId: 1, date: '2026-09-01' },
			{ pseudo: 'Élodie', pseudoKey: 'elodie', barId: 1, date: '2026-09-02' },
			{ pseudo: 'Élodie', pseudoKey: 'elodie', barId: 1, date: '2026-09-03' },
			{ pseudo: 'Jim', pseudoKey: 'jim', barId: 1, date: '2026-09-01' },
			{ pseudo: 'Jim', pseudoKey: 'jim', barId: 2, date: '2026-09-01' },
			{ pseudo: 'Zoé', pseudoKey: 'zoe', barId: 3, date: '2026-09-05' }
		]);
		expect(people.map((p) => [p.name, p.barCount, p.visitCount])).toEqual([
			['Jim', 2, 2],
			['Élodie', 1, 3],
			['Zoé', 1, 1]
		]);
		expect(people[1].key).toBe('elodie');
		expect(people[1].lastVisitDate).toBe('2026-09-03');
	});
});
