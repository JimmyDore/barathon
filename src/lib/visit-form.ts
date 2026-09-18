/**
 * État du formulaire de passage dans le navigateur (création sur /noter, modification sur
 * /passages/[id]/modifier) et aller-retour avec les valeurs brutes du formulaire.
 *
 * - `visitValuesFromForm(formData)` : côté serveur, pour renvoyer ce qui a été saisi quand la
 *   validation échoue (sans JS, la page se ré-affiche avec les valeurs de l'utilisateur).
 * - `visitStateFromValues(values)` : valeurs brutes (échec ci-dessus, ou `visitToFormValues(visit)`
 *   pour une modification) → état typé que les composants de note savent lier.
 */
import { AMBIANCE_SLUGS, TERRASSE_NONE, TERRASSE_NONE_FORM_VALUE } from './constants';
import { VISIT_FIELDS, getField, getFieldAll, type FormSource, type VisitField } from './validation';

/** Ce que lient les champs du formulaire de passage. */
export interface VisitFormState {
	pseudo: string;
	/** YYYY-MM-DD */
	date: string;
	beaute: number | null;
	emplacement: number | null;
	/** 1–5, 0 = « pas de terrasse », null = pas testé. */
	terrasse: number | null;
	choixBieres: number | null;
	qualiteBiere: number | null;
	/** Obligatoire à l'envoi, mais vide tant que rien n'est choisi. */
	soiree: number | null;
	ambiances: string[];
	humeur: number | null;
	/** Tel que saisi (« 6,50 »). */
	prix: string;
	commentaire: string;
}

/** Valeurs brutes des champs, par nom HTML (`choix_bieres`, `ambiances`…). */
export type VisitFormValues = Partial<Record<VisitField, string | string[]>>;

/** Longueur max renvoyée par champ texte (on ne renvoie pas un roman à qui colle n'importe quoi). */
const ECHO_MAX = 1000;

function first(v: string | string[] | undefined): string | undefined {
	return Array.isArray(v) ? v[0] : v;
}

function rating(v: string | string[] | undefined): number | null {
	const s = (first(v) ?? '').trim();
	return /^[1-5]$/.test(s) ? Number(s) : null;
}

function terrace(v: string | string[] | undefined): number | null {
	const s = (first(v) ?? '').trim();
	if (s === TERRASSE_NONE_FORM_VALUE || s === String(TERRASSE_NONE)) return TERRASSE_NONE;
	return rating(s);
}

function ambiances(v: string | string[] | undefined): string[] {
	const list = Array.isArray(v) ? v : v === undefined ? [] : [v];
	const known = AMBIANCE_SLUGS as readonly string[];
	return [...new Set(list.map((s) => s.trim()).filter((s) => known.includes(s)))];
}

/** Formulaire vierge : date du jour, pseudo mémorisé s'il y en a un. */
export function emptyVisitState(today: string, pseudo = ''): VisitFormState {
	return visitStateFromValues({}, { today, pseudo });
}

/**
 * Valeurs brutes → état du formulaire. Une note invalide redevient « pas testé ».
 * `fallback.pseudo` et `fallback.today` ne servent que si le champ est absent
 * (un pseudo vidé par l'utilisateur reste vide, pour que l'erreur ait du sens).
 */
export function visitStateFromValues(
	values: VisitFormValues,
	fallback: { today: string; pseudo?: string }
): VisitFormState {
	const F = VISIT_FIELDS;
	const text = (name: VisitField, def = '') => first(values[name]) ?? def;
	return {
		pseudo: text(F.pseudo, fallback.pseudo ?? ''),
		date: text(F.date, fallback.today) || fallback.today,
		beaute: rating(values[F.beaute]),
		emplacement: rating(values[F.emplacement]),
		terrasse: terrace(values[F.terrasse]),
		choixBieres: rating(values[F.choixBieres]),
		qualiteBiere: rating(values[F.qualiteBiere]),
		soiree: rating(values[F.soiree]),
		ambiances: ambiances(values[F.ambiances]),
		humeur: rating(values[F.humeur]),
		prix: text(F.prix),
		commentaire: text(F.commentaire)
	};
}

/**
 * Champs du passage tels que soumis (seulement ceux du passage : ni jeton, ni champ piège,
 * ni champs du bar), pour les renvoyer avec `fail(…)`.
 */
export function visitValuesFromForm(src: FormSource): VisitFormValues {
	const out: VisitFormValues = {};
	for (const name of Object.values(VISIT_FIELDS)) {
		if (name === VISIT_FIELDS.ambiances) {
			out[name] = getFieldAll(src, name).map((s) => s.slice(0, 40));
			continue;
		}
		const v = getField(src, name);
		if (v !== null) out[name] = v.slice(0, ECHO_MAX);
	}
	return out;
}
