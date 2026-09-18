/**
 * « Bar introuvable ? » : le bar ajouté à la main et l'alerte doublon
 * (« Il y a déjà X à 30 m, c'est pas celui-là ? »).
 */
import { GEO } from '$lib/constants';
import type { LatLon } from '$lib/geo/distance';
import type { OwnBarLike, PlaceOption } from '$lib/geo/merge';
import { formatDistance } from '$lib/format';

/** Un de nos bars tel que renvoyé par /api/bars/nearby. */
export type NearbyBar = OwnBarLike & { distance?: number };

/** Choix « nouveau bar » à passer au formulaire (champs cachés source=manual…). */
export function manualOption(name: string, address: string | null, pos: LatLon): PlaceOption {
	return {
		key: 'manual',
		barId: null,
		source: 'manual',
		sourceId: null,
		name,
		address,
		lat: pos.lat,
		lon: pos.lon,
		category: null,
		distance: null,
		overall: null,
		visitCount: 0
	};
}

/** « à 30 m », « à moins de 10 m ». */
export function distancePhrase(meters: number | null | undefined): string {
	if (meters === null || meters === undefined || !Number.isFinite(meters)) return 'tout près';
	return meters < 10 ? 'à moins de 10 m' : `à ${formatDistance(meters)}`;
}

/**
 * Nos bars à moins de 50 m de l'épingle, du plus proche au plus loin.
 * En cas de panne on renvoie [] : l'alerte est une aide, pas un blocage.
 */
export async function findDuplicates(
	pos: LatLon,
	{
		radiusM = GEO.duplicateRadiusM,
		signal,
		fetch: doFetch = globalThis.fetch
	}: { radiusM?: number; signal?: AbortSignal; fetch?: typeof fetch } = {}
): Promise<NearbyBar[]> {
	try {
		const url = `/api/bars/nearby?lat=${pos.lat.toFixed(6)}&lon=${pos.lon.toFixed(6)}&radius=${radiusM}`;
		const res = await doFetch(url, { signal });
		if (!res.ok) return [];
		const body = (await res.json()) as { bars?: NearbyBar[] };
		return (body.bars ?? []).slice().sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
	} catch {
		return [];
	}
}
