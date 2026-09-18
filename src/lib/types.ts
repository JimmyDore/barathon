/**
 * Types de données partagés serveur/client (ce que renvoient les `load`).
 */
import type { AmbianceSlug, PlaceCategory } from './constants';
import type { Score, TerraceStatus } from './scoring';
import type { VisitInput } from './validation';

export type BarSource = 'osm' | 'manual';

export interface Bar {
	id: number;
	name: string;
	address: string | null;
	lat: number;
	lon: number;
	/** `osm` (trouvé via Photon/OSM) ou `manual` (ajouté à la main). */
	source: BarSource;
	/** Identifiant OSM (`node/123`, `way/456`…), null pour un bar manuel. */
	sourceId: string | null;
	category: PlaceCategory | null;
	createdAt: string;
}

/** Un passage (sans le hash du jeton, qui ne quitte jamais la base). */
export interface Visit extends VisitInput {
	id: number;
	barId: number;
	pseudoKey: string;
	createdAt: string;
	updatedAt: string | null;
	/** Note de ce passage seul (même formule que pour un bar), null si rien de noté. */
	score: number | null;
}

export interface VisitWithBar extends Visit {
	barName: string;
}

export interface AmbianceCount {
	slug: AmbianceSlug;
	count: number;
}

/** Agrégats d'un bar calculés à partir de ses passages. */
export interface BarStats {
	/** Détail : critères, blocs, globale. */
	score: Score;
	/** Raccourci de `score.overall`. */
	overall: number | null;
	/** Terrasse selon la majorité des passages qui l'ont renseignée. */
	terrace: TerraceStatus;
	/** Ambiances citées, de la plus citée à la moins citée. */
	ambiances: AmbianceCount[];
	avgPriceCents: number | null;
	visitCount: number;
	lastVisitDate: string | null;
}

export interface BarSummary extends Bar, BarStats {}

export interface BarNearby extends BarSummary {
	/** Distance au point de recherche, en mètres. */
	distance: number;
}

/** Un barathonien (pseudos regroupés par `pseudoKey`). */
export interface Person {
	key: string;
	/** Orthographe la plus utilisée. */
	name: string;
	barCount: number;
	visitCount: number;
	lastVisitDate: string | null;
}
