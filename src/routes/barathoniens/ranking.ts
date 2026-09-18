/**
 * Petits calculs d'affichage du classement des barathoniens (module pur).
 */
import type { Person } from '$lib/types';

type Counts = Pick<Person, 'barCount' | 'visitCount'>;

/**
 * Rangs « façon compétition » pour une liste déjà triée (cf. `rankPeople`) :
 * mêmes bars ET mêmes passages = ex æquo, puis on saute (1, 2, 2, 4).
 */
export function competitionRanks(people: readonly Counts[]): number[] {
	const ranks: number[] = [];
	people.forEach((p, i) => {
		const prev = people[i - 1];
		const tied = prev && prev.barCount === p.barCount && prev.visitCount === p.visitCount;
		ranks.push(tied ? ranks[i - 1] : i + 1);
	});
	return ranks;
}

/** Rang d'une personne dans le classement (null si absente). */
export function rankOf(people: readonly (Counts & Pick<Person, 'key'>)[], key: string): number | null {
	const i = people.findIndex((p) => p.key === key);
	return i < 0 ? null : competitionRanks(people)[i];
}

/** Ex æquo avec quelqu'un d'autre ? */
export function isTied(ranks: readonly number[], i: number): boolean {
	return ranks[i - 1] === ranks[i] || ranks[i + 1] === ranks[i];
}

/** « 1er », « 2e », « 3e »… */
export function ordinal(rank: number): string {
	return rank === 1 ? '1er' : `${rank}e`;
}

/**
 * Bâtons à la craie : paquets de 5 (4 traits + 1 barre en travers).
 * On dessine au plus `max` bâtons ; le reste est renvoyé dans `overflow`.
 */
export function tallyGroups(count: number, max = 20): { groups: number[]; overflow: number } {
	const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
	const shown = Math.min(n, Math.max(0, max));
	const groups: number[] = [];
	for (let left = shown; left > 0; left -= 5) groups.push(Math.min(5, left));
	return { groups, overflow: n - shown };
}
