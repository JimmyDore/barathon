import { foldText } from './text';

/**
 * Regroupement des pseudos : « Élodie », « elodie » et «  ELODIE  » sont la même personne.
 * Clé = sans espaces autour (espaces internes ramenés à un seul), en minuscules, sans accents.
 */
export function pseudoKey(pseudo: string): string {
	return foldText(pseudo).trim().replace(/\s+/g, ' ');
}

/** Nettoie un pseudo pour l'affichage/stockage (espaces autour retirés, espaces internes simplifiés). */
export function cleanPseudo(pseudo: string): string {
	return pseudo.trim().replace(/\s+/g, ' ');
}

/**
 * Choisit l'orthographe affichée pour un groupe de pseudos :
 * la plus fréquente, et à égalité la plus récente (ordre du tableau = du plus ancien au plus récent).
 */
export function displayPseudo(spellings: readonly string[]): string {
	const counts = new Map<string, { count: number; last: number }>();
	spellings.forEach((s, i) => {
		const c = counts.get(s);
		if (c) {
			c.count++;
			c.last = i;
		} else counts.set(s, { count: 1, last: i });
	});
	let best = '';
	let bestCount = -1;
	let bestLast = -1;
	for (const [s, c] of counts) {
		if (c.count > bestCount || (c.count === bestCount && c.last > bestLast)) {
			best = s;
			bestCount = c.count;
			bestLast = c.last;
		}
	}
	return best;
}
