/**
 * Validation du formulaire de passage et du choix du bar (module pur).
 *
 * Accepte un `FormData` (form actions), un `URLSearchParams` ou un objet simple
 * (`{ soiree: 4, ambiances: ['chill'] }`). Messages d'erreur en français, tutoiement.
 */
import {
	AMBIANCE_SLUGS,
	LIMITS,
	PLACE_CATEGORIES,
	TERRASSE_NONE,
	TERRASSE_NONE_FORM_VALUE,
	type AmbianceSlug,
	type PlaceCategory
} from './constants';
import { isIsoDate } from './dates';
import { cleanPseudo } from './pseudo';

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

/** Passage validé, prêt à être stocké. */
export interface VisitInput {
	pseudo: string;
	/** YYYY-MM-DD (fuseau Europe/Paris). */
	date: string;
	beaute: number | null;
	emplacement: number | null;
	/** 1–5, 0 = « pas de terrasse », null = pas testé. */
	terrasse: number | null;
	choixBieres: number | null;
	qualiteBiere: number | null;
	soiree: number;
	ambiances: AmbianceSlug[];
	humeur: number | null;
	prixCents: number | null;
	commentaire: string | null;
}

/** Noms des champs HTML du formulaire de passage. */
export const VISIT_FIELDS = {
	pseudo: 'pseudo',
	date: 'date',
	beaute: 'beaute',
	emplacement: 'emplacement',
	terrasse: 'terrasse',
	choixBieres: 'choix_bieres',
	qualiteBiere: 'qualite_biere',
	soiree: 'soiree',
	ambiances: 'ambiances',
	humeur: 'humeur',
	prix: 'prix',
	commentaire: 'commentaire'
} as const;

export type VisitField = (typeof VISIT_FIELDS)[keyof typeof VISIT_FIELDS];
export type FieldErrors = Partial<Record<VisitField | 'form', string>>;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

/** Champ piège : invisible pour les humains. S'il est rempli, on fait semblant d'accepter. */
export const HONEYPOT_FIELD = 'site_web';

export type FormSource = FormData | URLSearchParams | Record<string, unknown>;

/* ------------------------------------------------------------------ */
/* Lecture générique                                                  */
/* ------------------------------------------------------------------ */

function isFormLike(src: FormSource): src is FormData | URLSearchParams {
	return typeof (src as FormData).getAll === 'function';
}

function toStr(v: unknown): string | null {
	if (v === null || v === undefined) return null;
	if (typeof v === 'string') return v;
	if (typeof v === 'number' || typeof v === 'boolean') return String(v);
	return null; // File, objets : ignorés
}

/** Première valeur d'un champ, en texte (null si absent). */
export function getField(src: FormSource, name: string): string | null {
	if (isFormLike(src)) return toStr(src.get(name));
	const v = src[name];
	if (Array.isArray(v)) return toStr(v[0]);
	return toStr(v);
}

/** Toutes les valeurs d'un champ multiple, en texte. */
export function getFieldAll(src: FormSource, name: string): string[] {
	if (isFormLike(src)) return src.getAll(name).map(toStr).filter((v): v is string => v !== null);
	const v = src[name];
	if (v === null || v === undefined) return [];
	if (Array.isArray(v)) return v.map(toStr).filter((x): x is string => x !== null);
	const s = toStr(v);
	return s === null ? [] : [s];
}

/* ------------------------------------------------------------------ */
/* Champs unitaires                                                   */
/* ------------------------------------------------------------------ */

const INVALID = Symbol('invalid');
type Invalid = typeof INVALID;

/** '' / absent → null ; '1'..'5' → nombre ; sinon invalide. */
export function parseRating(raw: string | null): number | null | Invalid {
	if (raw === null) return null;
	const s = raw.trim();
	if (s === '') return null;
	if (!/^[1-5]$/.test(s)) return INVALID;
	return Number(s);
}

/** « 6,50 », « 6.5 », « 6 € » → centimes. '' → null. */
export function parsePriceCents(raw: string | null): number | null | Invalid {
	if (raw === null) return null;
	const s = raw.replace(/€/g, '').replace(/\s/g, '').replace(',', '.');
	if (s === '') return null;
	if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return INVALID;
	return Math.round(Number(s) * 100);
}

export function isHoneypotFilled(src: FormSource): boolean {
	return (getField(src, HONEYPOT_FIELD) ?? '').trim() !== '';
}

/* ------------------------------------------------------------------ */
/* Formulaire de passage                                              */
/* ------------------------------------------------------------------ */

export interface ParseVisitOptions {
	/** Date du jour à Paris (YYYY-MM-DD), cf. `todayInParis()`. Sert de défaut et de borne max. */
	today: string;
}

export function parseVisitForm(src: FormSource, { today }: ParseVisitOptions): ParseResult<VisitInput> {
	const errors: FieldErrors = {};
	const F = VISIT_FIELDS;

	// Pseudo
	const pseudo = cleanPseudo(getField(src, F.pseudo) ?? '');
	if (pseudo === '') errors.pseudo = 'Dis-nous qui tu es : prénom ou pseudo.';
	else if (pseudo.length > LIMITS.pseudoMax)
		errors.pseudo = `${LIMITS.pseudoMax} caractères max pour le pseudo.`;

	// Date (défaut : aujourd'hui)
	const rawDate = (getField(src, F.date) ?? '').trim();
	const date = rawDate === '' ? today : rawDate;
	if (!isIsoDate(date)) errors.date = "Cette date n'existe pas.";
	else if (date > today) errors.date = 'Pas de passage dans le futur !';
	else if (date < '2000-01-01') errors.date = 'Date trop ancienne (avant 2000).';

	// Notes facultatives
	const ratings: Record<'beaute' | 'emplacement' | 'choixBieres' | 'qualiteBiere', number | null> = {
		beaute: null,
		emplacement: null,
		choixBieres: null,
		qualiteBiere: null
	};
	for (const key of ['beaute', 'emplacement', 'choixBieres', 'qualiteBiere'] as const) {
		const field = F[key];
		const v = parseRating(getField(src, field));
		if (v === INVALID) errors[field] = 'Choisis une note entre 1 et 5.';
		else ratings[key] = v;
	}

	// Terrasse : « none » ou 1–5
	let terrasse: number | null = null;
	const rawTerrasse = (getField(src, F.terrasse) ?? '').trim();
	if (rawTerrasse === TERRASSE_NONE_FORM_VALUE || rawTerrasse === String(TERRASSE_NONE)) {
		terrasse = TERRASSE_NONE;
	} else {
		const v = parseRating(rawTerrasse);
		if (v === INVALID) errors.terrasse = 'Choisis une note entre 1 et 5, ou « pas de terrasse ».';
		else terrasse = v;
	}

	// Soirée : obligatoire
	const soiree = parseRating(getField(src, F.soiree));
	if (soiree === INVALID) errors.soiree = 'Choisis une note entre 1 et 5.';
	else if (soiree === null) errors.soiree = 'Note au moins la soirée : c’est le seul critère obligatoire.';

	// Ambiances
	const ambiances: AmbianceSlug[] = [];
	for (const raw of getFieldAll(src, F.ambiances)) {
		const slug = raw.trim();
		if (slug === '') continue;
		if (!(AMBIANCE_SLUGS as readonly string[]).includes(slug)) {
			errors.ambiances = `Ambiance inconnue : ${slug}.`;
			continue;
		}
		if (!ambiances.includes(slug as AmbianceSlug)) ambiances.push(slug as AmbianceSlug);
	}

	// Humeur
	const humeur = parseRating(getField(src, F.humeur));
	if (humeur === INVALID) errors.humeur = 'Choisis une humeur dans la liste.';

	// Prix de la pinte
	const prix = parsePriceCents(getField(src, F.prix));
	if (prix === INVALID) errors.prix = 'Écris un prix comme 6,50.';
	else if (prix !== null && (prix < LIMITS.priceMinCents || prix > LIMITS.priceMaxCents))
		errors.prix = 'Prix de la pinte entre 0,50 € et 50 €.';

	// Commentaire
	const rawComment = (getField(src, F.commentaire) ?? '').replace(/\r\n?/g, '\n').trim();
	if (rawComment.length > LIMITS.commentMax)
		errors.commentaire = `${LIMITS.commentMax} caractères max (là, tu en as ${rawComment.length}).`;

	if (Object.keys(errors).length > 0) return { ok: false, errors };

	return {
		ok: true,
		value: {
			pseudo,
			date,
			...ratings,
			terrasse,
			soiree: soiree as number,
			ambiances,
			humeur: humeur as number | null,
			prixCents: prix as number | null,
			commentaire: rawComment === '' ? null : rawComment
		}
	};
}

/**
 * Inverse de `parseVisitForm` : valeurs de champs pour pré-remplir un formulaire
 * (édition d'un passage). Les notes absentes valent ''.
 */
export function visitToFormValues(v: VisitInput): Record<VisitField, string | string[]> {
	const n = (x: number | null) => (x === null ? '' : String(x));
	return {
		pseudo: v.pseudo,
		date: v.date,
		beaute: n(v.beaute),
		emplacement: n(v.emplacement),
		terrasse: v.terrasse === TERRASSE_NONE ? TERRASSE_NONE_FORM_VALUE : n(v.terrasse),
		choix_bieres: n(v.choixBieres),
		qualite_biere: n(v.qualiteBiere),
		soiree: String(v.soiree),
		ambiances: [...v.ambiances],
		humeur: n(v.humeur),
		prix: v.prixCents === null ? '' : (v.prixCents / 100).toFixed(2).replace('.', ','),
		commentaire: v.commentaire ?? ''
	};
}

/* ------------------------------------------------------------------ */
/* Choix du bar                                                       */
/* ------------------------------------------------------------------ */

/** Champs HTML du choix du bar (champs cachés du formulaire de passage). */
export const BAR_FIELDS = {
	barId: 'bar_id',
	source: 'source',
	sourceId: 'source_id',
	name: 'name',
	address: 'address',
	lat: 'lat',
	lon: 'lon',
	category: 'category'
} as const;

export interface NewBarPlace {
	name: string;
	address: string | null;
	lat: number;
	lon: number;
}

export type BarChoice =
	| { kind: 'existing'; barId: number }
	| ({ kind: 'osm'; sourceId: string; category: PlaceCategory | null } & NewBarPlace)
	| ({ kind: 'manual' } & NewBarPlace);

export type BarChoiceResult = { ok: true; value: BarChoice } | { ok: false; error: string };

const OSM_ID = /^(node|way|relation)\/\d+$/;

export function parseBarName(raw: string | null): { ok: true; value: string } | { ok: false; error: string } {
	const name = (raw ?? '').trim().replace(/\s+/g, ' ');
	if (name === '') return { ok: false, error: 'Donne un nom au bar.' };
	if (name.length > LIMITS.barNameMax)
		return { ok: false, error: `${LIMITS.barNameMax} caractères max pour le nom.` };
	return { ok: true, value: name };
}

export function parseAddress(raw: string | null): string | null {
	const a = (raw ?? '').trim().replace(/\s+/g, ' ');
	return a === '' ? null : a.slice(0, LIMITS.addressMax);
}

export function parseCoordinates(
	rawLat: string | null,
	rawLon: string | null
): { ok: true; value: { lat: number; lon: number } } | { ok: false; error: string } {
	const lat = Number((rawLat ?? '').trim());
	const lon = Number((rawLon ?? '').trim());
	if (
		(rawLat ?? '').trim() === '' ||
		(rawLon ?? '').trim() === '' ||
		!Number.isFinite(lat) ||
		!Number.isFinite(lon) ||
		lat < -90 ||
		lat > 90 ||
		lon < -180 ||
		lon > 180
	) {
		return { ok: false, error: 'Position du bar invalide.' };
	}
	return { ok: true, value: { lat, lon } };
}

/**
 * Lit le bar choisi :
 * - `bar_id` → bar déjà en base ;
 * - sinon `source=osm` + `source_id` (node/123) + name/lat/lon (+ address, category) ;
 * - sinon `source=manual` + name/lat/lon (+ address).
 */
export function parseBarChoice(src: FormSource): BarChoiceResult {
	const F = BAR_FIELDS;
	const rawId = (getField(src, F.barId) ?? '').trim();
	if (rawId !== '') {
		if (!/^\d+$/.test(rawId) || Number(rawId) <= 0) return { ok: false, error: 'Bar inconnu.' };
		return { ok: true, value: { kind: 'existing', barId: Number(rawId) } };
	}

	const source = (getField(src, F.source) ?? '').trim();
	if (source !== 'osm' && source !== 'manual') return { ok: false, error: 'Choisis d’abord un bar.' };

	const name = parseBarName(getField(src, F.name));
	if (!name.ok) return name;
	const coords = parseCoordinates(getField(src, F.lat), getField(src, F.lon));
	if (!coords.ok) return coords;
	const address = parseAddress(getField(src, F.address));

	if (source === 'manual') {
		return { ok: true, value: { kind: 'manual', name: name.value, address, ...coords.value } };
	}

	const sourceId = (getField(src, F.sourceId) ?? '').trim();
	if (!OSM_ID.test(sourceId)) return { ok: false, error: 'Identifiant OpenStreetMap invalide.' };
	const rawCategory = (getField(src, F.category) ?? '').trim();
	const category = (PLACE_CATEGORIES as readonly string[]).includes(rawCategory)
		? (rawCategory as PlaceCategory)
		: null;
	return {
		ok: true,
		value: { kind: 'osm', sourceId, category, name: name.value, address, ...coords.value }
	};
}
