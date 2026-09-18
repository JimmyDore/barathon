/**
 * Fusion des lieux du fournisseur (Photon) avec nos bars en base (module pur).
 * Nos bars gagnent toujours sur leur doublon OSM (même `sourceId`) : ils portent la note.
 */
import { GEO, type PlaceCategory } from '$lib/constants';
import { BAR_FIELDS } from '$lib/validation';
import { haversine, type LatLon } from './distance';
import type { Place } from './provider';

/** Un choix de bar affichable dans « Autour de moi » ou la recherche. */
export interface PlaceOption {
	/** Clé unique (pour `{#each}`) : `bar:12` ou `osm:node/123`. */
	key: string;
	/** Id dans notre base, null si le lieu n'y est pas encore. */
	barId: number | null;
	source: 'osm' | 'manual';
	sourceId: string | null;
	name: string;
	address: string | null;
	lat: number;
	lon: number;
	category: PlaceCategory | null;
	/** Mètres depuis le point de référence, null si inconnu. */
	distance: number | null;
	/** Note du bar (null si pas en base ou pas noté). */
	overall: number | null;
	visitCount: number;
}

/** Ce qu'il faut d'un de nos bars pour la fusion (un `BarSummary` convient). */
export interface OwnBarLike {
	id: number;
	name: string;
	address: string | null;
	lat: number;
	lon: number;
	source: 'osm' | 'manual';
	sourceId: string | null;
	category: PlaceCategory | null;
	overall: number | null;
	visitCount: number;
}

export function barToOption(bar: OwnBarLike, origin: LatLon | null = null): PlaceOption {
	return {
		key: `bar:${bar.id}`,
		barId: bar.id,
		source: bar.source,
		sourceId: bar.sourceId,
		name: bar.name,
		address: bar.address,
		lat: bar.lat,
		lon: bar.lon,
		category: bar.category,
		distance: origin ? haversine(origin, bar) : null,
		overall: bar.overall,
		visitCount: bar.visitCount
	};
}

export function placeToOption(place: Place): PlaceOption {
	return {
		key: `osm:${place.sourceId}`,
		barId: null,
		source: 'osm',
		sourceId: place.sourceId,
		name: place.name,
		address: place.address,
		lat: place.lat,
		lon: place.lon,
		category: place.category,
		distance: place.distance,
		overall: null,
		visitCount: 0
	};
}

/**
 * « Autour de moi » : lieux OSM + nos bars dans le rayon, dédoublonnés par `sourceId`,
 * triés par distance, les `limit` plus proches (défaut : 5 dans 200 m).
 */
export function mergeNearby(
	places: readonly Place[],
	ours: readonly OwnBarLike[],
	origin: LatLon,
	{ radiusM = GEO.nearbyRadiusM, limit = GEO.nearbyLimit }: { radiusM?: number; limit?: number } = {}
): PlaceOption[] {
	const ownSourceIds = new Set(ours.map((b) => b.sourceId).filter((s): s is string => s !== null));
	const options = [
		...ours.map((b) => barToOption(b, origin)),
		...places
			.filter((p) => !ownSourceIds.has(p.sourceId))
			.map((p) => placeToOption({ ...p, distance: haversine(origin, p) }))
	];
	return options
		.filter((o) => (o.distance ?? Infinity) <= radiusM)
		.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
		.slice(0, limit);
}

/**
 * Recherche : nos bars trouvés par leur nom d'abord, puis les résultats du fournisseur
 * dans leur ordre (remplacés par notre bar quand on le connaît déjà).
 * `ours` = nos bars qui matchent le texte + ceux qui correspondent aux `sourceId` des résultats.
 */
export function mergeSearch(
	places: readonly Place[],
	ours: readonly OwnBarLike[],
	origin: LatLon | null,
	limit = 10
): PlaceOption[] {
	const bySourceId = new Map<string, OwnBarLike>();
	for (const b of ours) if (b.sourceId) bySourceId.set(b.sourceId, b);
	const placeIds = new Set(places.map((p) => p.sourceId));

	const own = ours
		.filter((b) => !(b.sourceId && placeIds.has(b.sourceId)))
		.map((b) => barToOption(b, origin));
	if (origin) own.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));

	const fromProvider = places.map((p) => {
		const mine = bySourceId.get(p.sourceId);
		return mine ? barToOption(mine, origin) : placeToOption(p);
	});

	const seen = new Set<string>();
	return [...own, ...fromProvider]
		.filter((o) => (seen.has(o.key) ? false : (seen.add(o.key), true)))
		.slice(0, limit);
}

/**
 * Champs cachés à mettre dans le formulaire de passage pour ce choix de bar
 * (lus côté serveur par `parseBarChoice`).
 */
export function optionToFormFields(o: PlaceOption): Record<string, string> {
	const F = BAR_FIELDS;
	if (o.barId !== null) return { [F.barId]: String(o.barId) };
	return {
		[F.source]: o.source,
		[F.sourceId]: o.sourceId ?? '',
		[F.name]: o.name,
		[F.address]: o.address ?? '',
		[F.lat]: String(o.lat),
		[F.lon]: String(o.lon),
		[F.category]: o.category ?? ''
	};
}
