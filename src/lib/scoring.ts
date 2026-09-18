/**
 * Calcul des notes (module pur, sans dépendance).
 *
 * Règles (SPEC.md, « Calcul des notes ») :
 * - critère = moyenne de ses valeurs renseignées (1–5) sur tous les passages ;
 * - bloc = moyenne des critères renseignés du bloc ;
 * - note = moyenne des blocs non vides (Lieu, Bière, Moment pèsent pareil) ;
 * - terrasse « pas de terrasse » (0) n'entre dans aucune moyenne ;
 * - un passage seul : même formule sur ce seul passage ;
 * - l'humeur n'entre dans aucun calcul (elle n'est même pas dans `Ratings`).
 */
import { BLOCKS, TERRASSE_NONE, type BlockKey, type CriterionKey } from './constants';

/** Notes d'un passage. `null` = pas testé. `terrasse` peut valoir 0 = pas de terrasse. */
export type Ratings = Record<CriterionKey, number | null>;

export type CriterionScores = Record<CriterionKey, number | null>;
export type BlockScores = Record<BlockKey, number | null>;

export interface Score {
	criteria: CriterionScores;
	blocks: BlockScores;
	/** Note globale sur 5, `null` si rien n'est renseigné. */
	overall: number | null;
}

export type TerraceStatus = 'oui' | 'non' | null;

const CRITERION_KEYS: CriterionKey[] = [
	'beaute',
	'emplacement',
	'terrasse',
	'choixBieres',
	'qualiteBiere',
	'soiree'
];

/** Une valeur compte dans les moyennes seulement si c'est une note 1–5. */
export function isCountedRating(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 1 && value <= 5;
}

export function mean(values: readonly number[]): number | null {
	if (values.length === 0) return null;
	let sum = 0;
	for (const v of values) sum += v;
	return sum / values.length;
}

/** Moyenne de chaque critère sur une liste de passages. */
export function criterionAverages(visits: readonly Ratings[]): CriterionScores {
	const out = {} as CriterionScores;
	for (const key of CRITERION_KEYS) {
		const values: number[] = [];
		for (const v of visits) {
			const value = v[key];
			if (isCountedRating(value)) values.push(value);
		}
		out[key] = mean(values);
	}
	return out;
}

/** Moyenne des critères renseignés de chaque bloc. */
export function blockAverages(criteria: CriterionScores): BlockScores {
	const out = {} as BlockScores;
	for (const block of BLOCKS) {
		const values = block.criteria
			.map((c) => criteria[c])
			.filter((v): v is number => v !== null);
		out[block.key] = mean(values);
	}
	return out;
}

/** Note globale = moyenne des blocs non vides. */
export function overallScore(blocks: BlockScores): number | null {
	return mean(Object.values(blocks).filter((v): v is number => v !== null));
}

/** Note d'un bar à partir de tous ses passages. */
export function scoreVisits(visits: readonly Ratings[]): Score {
	const criteria = criterionAverages(visits);
	const blocks = blockAverages(criteria);
	return { criteria, blocks, overall: overallScore(blocks) };
}

/** Note d'un passage seul (même formule). */
export function scoreVisit(visit: Ratings): Score {
	return scoreVisits([visit]);
}

/**
 * Le bar a-t-il une terrasse ? Majorité des passages qui ont renseigné la terrasse
 * (note 1–5 = oui, 0 = non). Égalité → « oui » (quelqu'un l'a notée, elle existe).
 * Personne ne l'a renseignée → `null`.
 */
export function terraceStatus(values: readonly (number | null | undefined)[]): TerraceStatus {
	let yes = 0;
	let no = 0;
	for (const v of values) {
		if (v === TERRASSE_NONE) no++;
		else if (isCountedRating(v)) yes++;
	}
	if (yes === 0 && no === 0) return null;
	return yes >= no ? 'oui' : 'non';
}

/** Arrondi d'affichage à une décimale (4.25 → 4.3). */
export function roundScore(score: number | null): number | null {
	return score === null ? null : Math.round(score * 10) / 10;
}
