/**
 * Constantes produit partagées (client + serveur).
 * Tout ce qui décrit le formulaire de passage vit ici : critères, blocs,
 * ambiances, humeurs, bornes des champs.
 */

export type CriterionKey =
	| 'beaute'
	| 'emplacement'
	| 'terrasse'
	| 'choixBieres'
	| 'qualiteBiere'
	| 'soiree';

export type BlockKey = 'lieu' | 'biere' | 'moment';

export const BLOCKS: readonly { key: BlockKey; label: string; criteria: readonly CriterionKey[] }[] = [
	{ key: 'lieu', label: 'Lieu', criteria: ['beaute', 'emplacement', 'terrasse'] },
	{ key: 'biere', label: 'Bière', criteria: ['choixBieres', 'qualiteBiere'] },
	{ key: 'moment', label: 'Moment', criteria: ['soiree'] }
] as const;

export const CRITERIA: readonly {
	key: CriterionKey;
	/** Nom du champ dans le formulaire HTML (FormData). */
	field: string;
	label: string;
	block: BlockKey;
	required: boolean;
}[] = [
	{ key: 'beaute', field: 'beaute', label: 'Beauté', block: 'lieu', required: false },
	{ key: 'emplacement', field: 'emplacement', label: 'Emplacement', block: 'lieu', required: false },
	{ key: 'terrasse', field: 'terrasse', label: 'Terrasse', block: 'lieu', required: false },
	{ key: 'choixBieres', field: 'choix_bieres', label: 'Choix de bières', block: 'biere', required: false },
	{ key: 'qualiteBiere', field: 'qualite_biere', label: 'Qualité de la bière', block: 'biere', required: false },
	{ key: 'soiree', field: 'soiree', label: 'La soirée', block: 'moment', required: true }
] as const;

/** Valeur stockée pour « pas de terrasse » (n'entre dans aucune moyenne). */
export const TERRASSE_NONE = 0;
/** Valeur de formulaire pour « pas de terrasse ». */
export const TERRASSE_NONE_FORM_VALUE = 'none';

/** Petit mot affiché à côté d'une note 1–5. Index = note. */
export const RATING_WORDS = ['', 'bof', 'moyen', 'correct', 'bien', 'top'] as const;

export const AMBIANCES = [
	{ slug: 'chill', label: 'chill' },
	{ slug: 'festif', label: 'festif' },
	{ slug: 'bruyant', label: 'bruyant' },
	{ slug: 'cosy', label: 'cosy' },
	{ slug: 'dansant', label: 'dansant' },
	{ slug: 'match', label: 'match/sport' },
	{ slug: 'afterwork', label: 'afterwork' },
	{ slug: 'date', label: 'date' },
	{ slug: 'jeux', label: 'jeux' }
] as const;

export type AmbianceSlug = (typeof AMBIANCES)[number]['slug'];

export const AMBIANCE_SLUGS: readonly AmbianceSlug[] = AMBIANCES.map((a) => a.slug);

export function ambianceLabel(slug: string): string {
	return AMBIANCES.find((a) => a.slug === slug)?.label ?? slug;
}

/** Humeur : affichée à côté du passage, jamais comptée dans les notes. */
export const MOODS = [
	{ value: 1, emoji: '😫', label: 'au bout du rouleau' },
	{ value: 2, emoji: '😕', label: 'bof' },
	{ value: 3, emoji: '😐', label: 'neutre' },
	{ value: 4, emoji: '🙂', label: 'bien' },
	{ value: 5, emoji: '🤩', label: 'au taquet' }
] as const;

export function moodEmoji(value: number | null | undefined): string {
	return MOODS.find((m) => m.value === value)?.emoji ?? '';
}

/** Types OSM retenus (clé `amenity`). */
export const PLACE_CATEGORIES = ['bar', 'pub', 'cafe', 'biergarten', 'nightclub', 'restaurant'] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const PLACE_CATEGORY_LABELS: Record<PlaceCategory, string> = {
	bar: 'bar',
	pub: 'pub',
	cafe: 'café',
	biergarten: 'biergarten',
	nightclub: 'boîte de nuit',
	restaurant: 'restaurant'
};

export const LIMITS = {
	pseudoMax: 40,
	commentMax: 280,
	barNameMax: 80,
	addressMax: 160,
	/** Prix de la pinte accepté, en centimes. */
	priceMinCents: 50,
	priceMaxCents: 5000
} as const;

export const GEO = {
	/** Rayon de « Autour de moi », en mètres. */
	nearbyRadiusM: 200,
	nearbyLimit: 5,
	/** Rayon de l'alerte « c'est pas celui-là ? » avant de créer un bar à la main. */
	duplicateRadiusM: 50,
	/** Centre par défaut : zone Nantes – La Roche-sur-Yon. */
	defaultCenter: { lat: 46.95, lon: -1.5 },
	defaultZoom: 9
} as const;

export const RATE_LIMITS = {
	/** Créations de passages par IP. */
	visitCreate: { limit: 20, windowMs: 10 * 60 * 1000 },
	/** Tentatives de connexion admin par IP. */
	adminLogin: { limit: 10, windowMs: 10 * 60 * 1000 }
} as const;

export const TIMEZONE = 'Europe/Paris';
