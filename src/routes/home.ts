/**
 * Accueil (`/`) : logique pure de la carte et du classement.
 *
 * - `HomeBar` : ce que la page reçoit du serveur pour chaque bar (résumé allégé).
 * - Vue et filtres lus/écrits dans l'URL pour pouvoir partager un lien :
 *   `/?vue=classement&terrasse=oui&ambiances=chill,cosy&prix_max=6.5`
 * - Filtrage et tri côté client, sur les résumés déjà chargés.
 */
import { AMBIANCES, type AmbianceSlug } from '$lib/constants';
import type { LatLon } from '$lib/geo/distance';
import type { BlockScores, TerraceStatus } from '$lib/scoring';
import type { BarSummary } from '$lib/types';

/* ------------------------------------------------------------------ */
/* Données                                                            */
/* ------------------------------------------------------------------ */

export interface HomeBar {
	id: number;
	name: string;
	address: string | null;
	lat: number;
	lon: number;
	overall: number | null;
	blocks: BlockScores;
	terrace: TerraceStatus;
	/** Ambiances citées, de la plus citée à la moins citée. */
	ambiances: AmbianceSlug[];
	avgPriceCents: number | null;
	visitCount: number;
}

export function toHomeBar(s: BarSummary): HomeBar {
	return {
		id: s.id,
		name: s.name,
		address: s.address,
		lat: s.lat,
		lon: s.lon,
		overall: s.overall,
		blocks: { ...s.score.blocks },
		terrace: s.terrace,
		ambiances: s.ambiances.map((a) => a.slug),
		avgPriceCents: s.avgPriceCents,
		visitCount: s.visitCount
	};
}

/* ------------------------------------------------------------------ */
/* Vue + filtres ⇄ URL                                                */
/* ------------------------------------------------------------------ */

export type HomeView = 'carte' | 'classement';

export interface HomeFilters {
	/** Seulement les bars avec terrasse. */
	terrace: boolean;
	/** Le bar doit avoir été cité avec toutes ces ambiances. */
	ambiances: AmbianceSlug[];
	/** Prix moyen de la pinte maximum, en centimes (null = peu importe). */
	maxPriceCents: number | null;
}

export const NO_FILTERS: HomeFilters = { terrace: false, ambiances: [], maxPriceCents: null };

const PARAM = {
	view: 'vue',
	terrace: 'terrasse',
	ambiances: 'ambiances',
	maxPrice: 'prix_max'
} as const;

const AMBIANCE_ORDER: readonly string[] = AMBIANCES.map((a) => a.slug);

export function parseView(params: URLSearchParams): HomeView {
	return params.get(PARAM.view) === 'classement' ? 'classement' : 'carte';
}

/** Slugs valides, sans doublon, dans l'ordre de la liste officielle (URL stable). */
export function normalizeAmbiances(values: readonly string[]): AmbianceSlug[] {
	const wanted = new Set(values.map((v) => v.trim().toLowerCase()));
	return AMBIANCE_ORDER.filter((slug) => wanted.has(slug)) as AmbianceSlug[];
}

/** « 6.5 », « 6,50 » ou « 7 » (euros) → centimes ; null si absent ou invalide. */
export function parsePriceParam(value: string | null): number | null {
	if (value === null) return null;
	const n = Number(value.trim().replace(',', '.'));
	if (!value.trim() || !Number.isFinite(n) || n <= 0) return null;
	return Math.round(n * 100);
}

/** 650 → « 6.5 », 700 → « 7 ». */
export function priceParam(cents: number): string {
	return String(Math.round(cents) / 100);
}

export function parseFilters(params: URLSearchParams): HomeFilters {
	const terrace = ['oui', '1', 'true'].includes((params.get(PARAM.terrace) ?? '').toLowerCase());
	const ambiances = normalizeAmbiances(params.getAll(PARAM.ambiances).flatMap((v) => v.split(',')));
	return { terrace, ambiances, maxPriceCents: parsePriceParam(params.get(PARAM.maxPrice)) };
}

/** Lien vers l'accueil avec cette vue et ces filtres (`/` quand tout est par défaut). */
export function homeHref(view: HomeView, filters: HomeFilters): string {
	const parts: string[] = [];
	if (view === 'classement') parts.push(`${PARAM.view}=classement`);
	if (filters.terrace) parts.push(`${PARAM.terrace}=oui`);
	const ambiances = normalizeAmbiances(filters.ambiances);
	// les slugs sont en [a-z] : la virgule reste lisible dans l'URL
	if (ambiances.length) parts.push(`${PARAM.ambiances}=${ambiances.join(',')}`);
	if (filters.maxPriceCents !== null) parts.push(`${PARAM.maxPrice}=${priceParam(filters.maxPriceCents)}`);
	return parts.length ? `/?${parts.join('&')}` : '/';
}

export function countActiveFilters(filters: HomeFilters): number {
	return (filters.terrace ? 1 : 0) + filters.ambiances.length + (filters.maxPriceCents !== null ? 1 : 0);
}

export function sameFilters(a: HomeFilters, b: HomeFilters): boolean {
	return (
		a.terrace === b.terrace &&
		a.maxPriceCents === b.maxPriceCents &&
		normalizeAmbiances(a.ambiances).join(',') === normalizeAmbiances(b.ambiances).join(',')
	);
}

/* ------------------------------------------------------------------ */
/* Filtrage + classement                                              */
/* ------------------------------------------------------------------ */

/**
 * Bars qui passent les filtres. Un bar sans prix renseigné est écarté dès qu'un
 * prix max est demandé ; sans terrasse connue, il est écarté par le filtre terrasse.
 */
export function filterBars<T extends HomeBar>(bars: readonly T[], filters: HomeFilters): T[] {
	return bars.filter(
		(b) =>
			(!filters.terrace || b.terrace === 'oui') &&
			filters.ambiances.every((a) => b.ambiances.includes(a)) &&
			(filters.maxPriceCents === null ||
				(b.avgPriceCents !== null && b.avgPriceCents <= filters.maxPriceCents))
	);
}

/** Classement : note décroissante (non notés à la fin), puis nb de passages, puis nom. */
export function compareHomeBars(a: HomeBar, b: HomeBar): number {
	if (a.overall === null && b.overall !== null) return 1;
	if (b.overall === null && a.overall !== null) return -1;
	return (
		(b.overall ?? 0) - (a.overall ?? 0) ||
		b.visitCount - a.visitCount ||
		a.name.localeCompare(b.name, 'fr')
	);
}

export function rankBars<T extends HomeBar>(bars: readonly T[]): T[] {
	return [...bars].sort(compareHomeBars);
}

/* ------------------------------------------------------------------ */
/* Curseur « prix max de la pinte »                                   */
/* ------------------------------------------------------------------ */

export const PRICE_STEP_CENTS = 50;

export interface PriceRange {
	/** Premier cran du curseur (centimes). */
	min: number;
	/** Dernier prix réel ; le cran suivant (`max + step`) veut dire « peu importe ». */
	max: number;
	step: number;
}

/** Bornes du curseur d'après les prix connus (au demi-euro), null si aucun prix. */
export function priceRange(bars: readonly HomeBar[]): PriceRange | null {
	const prices = bars.map((b) => b.avgPriceCents).filter((p): p is number => p !== null);
	if (prices.length === 0) return null;
	const step = PRICE_STEP_CENTS;
	let min = Math.floor(Math.min(...prices) / step) * step;
	const max = Math.ceil(Math.max(...prices) / step) * step;
	if (min >= max) min = Math.max(step, max - step);
	return { min, max, step };
}

/** Position du curseur pour un prix max (null = tout à droite, « peu importe »). */
export function priceToSlider(price: number | null, range: PriceRange): number {
	if (price === null) return range.max + range.step;
	return Math.min(range.max, Math.max(range.min, price));
}

export function sliderToPrice(value: number, range: PriceRange): number | null {
	return value > range.max ? null : value;
}

/* ------------------------------------------------------------------ */
/* Carte : « y a-t-il des bars dans l'écran ? »                        */
/* ------------------------------------------------------------------ */

export interface Bounds {
	west: number;
	east: number;
	south: number;
	north: number;
}

const TILE_PX = 512; // MapLibre : le monde fait 512 px de large au zoom 0

/** Emprise approximative de la carte (Web Mercator) pour un centre, un zoom et une taille en px. */
export function viewBounds(center: LatLon, zoom: number, widthPx: number, heightPx: number): Bounds {
	const world = TILE_PX * 2 ** zoom;
	const x = ((center.lon + 180) / 360) * world;
	const sin = Math.sin((center.lat * Math.PI) / 180);
	const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * world;
	const lon = (px: number) => (px / world) * 360 - 180;
	const lat = (py: number) => (Math.atan(Math.sinh(Math.PI - (2 * Math.PI * py) / world)) * 180) / Math.PI;
	return {
		west: lon(x - widthPx / 2),
		east: lon(x + widthPx / 2),
		north: lat(y - heightPx / 2),
		south: lat(y + heightPx / 2)
	};
}

export function isInBounds(p: LatLon, b: Bounds): boolean {
	return p.lat >= b.south && p.lat <= b.north && p.lon >= b.west && p.lon <= b.east;
}
