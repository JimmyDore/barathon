/**
 * Agrégations pures : résumé d'un bar, classement des barathoniens.
 */
import { AMBIANCES, type AmbianceSlug } from './constants';
import { displayPseudo } from './pseudo';
import { mean, scoreVisits, terraceStatus, type Ratings } from './scoring';
import type { AmbianceCount, BarStats, BarSummary, Person } from './types';
import type { VisitInput } from './validation';

/** Extrait les notes comptables d'un passage (l'humeur n'y est pas). */
export function ratingsOf(v: Pick<VisitInput, keyof Ratings>): Ratings {
	return {
		beaute: v.beaute,
		emplacement: v.emplacement,
		terrasse: v.terrasse,
		choixBieres: v.choixBieres,
		qualiteBiere: v.qualiteBiere,
		soiree: v.soiree
	};
}

/** Agrégats d'un bar à partir de ses passages. */
export function summarizeVisits(visits: readonly VisitInput[]): BarStats {
	const score = scoreVisits(visits.map(ratingsOf));

	const counts = new Map<AmbianceSlug, number>();
	for (const v of visits) for (const a of v.ambiances) counts.set(a, (counts.get(a) ?? 0) + 1);
	const order = AMBIANCES.map((a) => a.slug as AmbianceSlug);
	const ambiances: AmbianceCount[] = [...counts.entries()]
		.map(([slug, count]) => ({ slug, count }))
		.sort((a, b) => b.count - a.count || order.indexOf(a.slug) - order.indexOf(b.slug));

	const prices = visits.map((v) => v.prixCents).filter((p): p is number => p !== null);
	const avg = mean(prices);

	let lastVisitDate: string | null = null;
	for (const v of visits) if (lastVisitDate === null || v.date > lastVisitDate) lastVisitDate = v.date;

	return {
		score,
		overall: score.overall,
		terrace: terraceStatus(visits.map((v) => v.terrasse)),
		ambiances,
		avgPriceCents: avg === null ? null : Math.round(avg),
		visitCount: visits.length,
		lastVisitDate
	};
}

/** Tri du classement des bars : note décroissante (non notés à la fin), puis nb de passages, puis nom. */
export function compareBarsByScore(a: BarSummary, b: BarSummary): number {
	if (a.overall === null && b.overall !== null) return 1;
	if (b.overall === null && a.overall !== null) return -1;
	return (
		(b.overall ?? 0) - (a.overall ?? 0) ||
		b.visitCount - a.visitCount ||
		a.name.localeCompare(b.name, 'fr')
	);
}

export interface PersonVisitLike {
	pseudo: string;
	pseudoKey: string;
	barId: number;
	date: string;
	/** Sert à départager deux passages le même jour. */
	createdAt?: string;
}

/**
 * Classement des barathoniens : nombre de bars distincts, puis nombre de passages
 * (puis passage le plus récent, puis nom).
 */
export function rankPeople(visits: readonly PersonVisitLike[]): Person[] {
	const chrono = [...visits].sort(
		(a, b) => a.date.localeCompare(b.date) || (a.createdAt ?? '').localeCompare(b.createdAt ?? '')
	);
	const groups = new Map<string, { spellings: string[]; bars: Set<number>; count: number; last: string }>();
	for (const v of chrono) {
		let g = groups.get(v.pseudoKey);
		if (!g) {
			g = { spellings: [], bars: new Set(), count: 0, last: v.date };
			groups.set(v.pseudoKey, g);
		}
		g.spellings.push(v.pseudo);
		g.bars.add(v.barId);
		g.count++;
		if (v.date > g.last) g.last = v.date;
	}
	return [...groups.entries()]
		.map(([key, g]) => ({
			key,
			name: displayPseudo(g.spellings),
			barCount: g.bars.size,
			visitCount: g.count,
			lastVisitDate: g.last
		}))
		.sort(
			(a, b) =>
				b.barCount - a.barCount ||
				b.visitCount - a.visitCount ||
				(b.lastVisitDate ?? '').localeCompare(a.lastVisitDate ?? '') ||
				a.name.localeCompare(b.name, 'fr')
		);
}
