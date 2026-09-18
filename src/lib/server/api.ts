/**
 * Formes JSON renvoyées par les petites routes /api (côté serveur).
 */
import type { OwnBarLike } from '$lib/geo/merge';
import type { BarSummary } from '$lib/types';

/** Un de nos bars, réduit à ce qu'il faut pour la recherche / « autour de moi ». */
export type ApiBar = OwnBarLike & { distance?: number };

export function toApiBar(b: BarSummary & { distance?: number }): ApiBar {
	return {
		id: b.id,
		name: b.name,
		address: b.address,
		lat: b.lat,
		lon: b.lon,
		source: b.source,
		sourceId: b.sourceId,
		category: b.category,
		overall: b.overall,
		visitCount: b.visitCount,
		...(b.distance !== undefined ? { distance: Math.round(b.distance) } : {})
	};
}
