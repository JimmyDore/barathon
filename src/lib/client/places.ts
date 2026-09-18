/**
 * Recherche et « Autour de moi » côté navigateur : fournisseur (Photon) + nos bars
 * (/api/bars/*), fusionnés et dédoublonnés. Si Photon tombe, on renvoie quand même nos bars
 * avec `providerError: true` (à afficher, avec le lien « Bar introuvable ? »).
 */
import { GEO } from '$lib/constants';
import type { LatLon } from '$lib/geo/distance';
import { mergeNearby, mergeSearch, type OwnBarLike, type PlaceOption } from '$lib/geo/merge';
import { nearby, ProviderError, search, type Place } from '$lib/geo/provider';

export interface PlacesResult {
	options: PlaceOption[];
	/** Le fournisseur n'a pas répondu (les résultats ne contiennent que nos bars). */
	providerError: boolean;
}

async function ourBars(url: string, signal?: AbortSignal): Promise<OwnBarLike[]> {
	try {
		const res = await fetch(url, { signal });
		if (!res.ok) return [];
		const body = (await res.json()) as { bars?: OwnBarLike[] };
		return body.bars ?? [];
	} catch {
		return [];
	}
}

async function providerCall(fn: () => Promise<Place[]>): Promise<{ places: Place[]; failed: boolean }> {
	try {
		return { places: await fn(), failed: false };
	} catch (e) {
		if (e instanceof ProviderError && e.kind === 'aborted') throw e;
		return { places: [], failed: true };
	}
}

/**
 * Les bars les plus proches (5 dans 200 m par défaut).
 * Lève une `ProviderError` de type 'aborted' si `signal` est annulé.
 */
export async function findNearby(
	origin: LatLon,
	{ radiusM = GEO.nearbyRadiusM, limit = GEO.nearbyLimit, signal }: { radiusM?: number; limit?: number; signal?: AbortSignal } = {}
): Promise<PlacesResult> {
	const [provider, ours] = await Promise.all([
		providerCall(() => nearby(origin, radiusM, { signal })),
		ourBars(`/api/bars/nearby?lat=${origin.lat}&lon=${origin.lon}&radius=${radiusM}`, signal)
	]);
	return { options: mergeNearby(provider.places, ours, origin, { radiusM, limit }), providerError: provider.failed };
}

/**
 * Recherche par nom, biaisée autour de `origin` (position ou centre de carte).
 * À appeler avec un debounce (~300 ms) et un AbortController par frappe.
 */
export async function findByName(
	query: string,
	origin: LatLon | null,
	{ limit = 10, signal }: { limit?: number; signal?: AbortSignal } = {}
): Promise<PlacesResult> {
	const q = query.trim();
	if (q.length < 2) return { options: [], providerError: false };
	const provider = await providerCall(() => search(q, { ...(origin ?? {}), limit: 8, signal }));
	const ids = provider.places.map((p) => p.sourceId).join(',');
	const ours = await ourBars(
		`/api/bars/search?q=${encodeURIComponent(q)}&source_ids=${encodeURIComponent(ids)}`,
		signal
	);
	return { options: mergeSearch(provider.places, ours, origin, limit), providerError: provider.failed };
}
