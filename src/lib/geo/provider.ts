/**
 * Fournisseur de lieux (« search provider »). SEUL fichier à réécrire pour passer
 * de Photon à Geoapify / Google : garder les signatures de `search` et `nearby`.
 *
 * Implémentation actuelle : Photon (https://photon.komoot.io), données OpenStreetMap.
 * - `search` : /api, filtré sur amenity = bar, pub, cafe, biergarten, nightclub, restaurant,
 *   biaisé autour d'un point puis re-trié par proximité (Photon privilégie la pertinence textuelle).
 * - `nearby` : /reverse avec `radius` + mêmes filtres. Choisi plutôt qu'Overpass : mesuré
 *   autour de Nantes, Photon répond en 1–2 s à chaque fois, alors que l'instance publique
 *   d'Overpass a renvoyé 429 / 504 / timeouts sur 3 requêtes sur 4.
 *
 * Utilisable côté navigateur (Photon renvoie `Access-Control-Allow-Origin: *`) comme côté serveur.
 * Aucune dépendance Node.
 */
import { GEO, PLACE_CATEGORIES, type PlaceCategory } from '$lib/constants';
import { haversine, type LatLon } from './distance';

export { haversine, type LatLon } from './distance';

/** Un lieu renvoyé par le fournisseur (pas forcément dans notre base). */
export interface Place {
	/** Identifiant OSM stable, ex. `node/4009374049`. Sert de `source_id` en base. */
	sourceId: string;
	name: string;
	/** Ex. « 3 Rue du Guesclin, Nantes ». */
	address: string | null;
	lat: number;
	lon: number;
	category: PlaceCategory | null;
	/** Distance au point de référence (mètres), null si aucun point fourni. */
	distance: number | null;
}

export interface ProviderOptions {
	/** Pour annuler une requête (ex. frappe suivante dans la recherche). */
	signal?: AbortSignal;
	/** Délai max avant abandon (ms). Défaut : 6000. */
	timeoutMs?: number;
	/** `fetch` à utiliser (celui de SvelteKit dans un `load`, un mock en test). */
	fetch?: typeof fetch;
}

export interface SearchOptions extends ProviderOptions, Partial<LatLon> {
	/** Nombre max de résultats (défaut 8). */
	limit?: number;
}

export interface NearbyOptions extends ProviderOptions {
	/** Nombre max de résultats (défaut 20 : on garde de la marge pour la fusion avec nos bars). */
	limit?: number;
}

/** Erreur réseau/HTTP du fournisseur. `kind: 'aborted'` = annulée volontairement (à ignorer). */
export class ProviderError extends Error {
	constructor(
		message: string,
		readonly kind: 'network' | 'timeout' | 'http' | 'aborted',
		readonly status?: number
	) {
		super(message);
		this.name = 'ProviderError';
	}
}

export const PROVIDER_NAME = 'photon';

const PHOTON_URL = 'https://photon.komoot.io';
const USER_AGENT = 'Barathon/1.0 (+https://barathon.jimmydore.fr)';
const DEFAULT_TIMEOUT_MS = 6000;

/**
 * Recherche de bars par nom, biaisée autour de `lat`/`lon` si fournis.
 * Lève `ProviderError` si Photon ne répond pas.
 */
export async function search(query: string, opts: SearchOptions = {}): Promise<Place[]> {
	const q = query.trim();
	if (q.length < 2) return [];
	const limit = opts.limit ?? 8;
	const origin = hasOrigin(opts) ? { lat: opts.lat, lon: opts.lon } : null;

	const params = new URLSearchParams({ q, limit: String(Math.min(50, limit * 3)), lang: 'fr' });
	if (origin) {
		params.set('lat', origin.lat.toFixed(5));
		params.set('lon', origin.lon.toFixed(5));
		params.set('zoom', '12');
		params.set('location_bias_scale', '0.1');
	}
	addTagFilters(params);

	const features = await photon(`/api/?${params}`, opts);
	const places = features.map((f) => parsePhotonFeature(f, origin)).filter((p): p is Place => p !== null);
	return rankByProximity(dedupe(places)).slice(0, limit);
}

/**
 * Lieux autour d'un point, dans un rayon en mètres (défaut 200 m), du plus proche au plus loin.
 * Lève `ProviderError` si Photon ne répond pas.
 */
export async function nearby(
	origin: LatLon,
	radiusM: number = GEO.nearbyRadiusM,
	opts: NearbyOptions = {}
): Promise<Place[]> {
	const limit = opts.limit ?? 20;
	const params = new URLSearchParams({
		lat: origin.lat.toFixed(6),
		lon: origin.lon.toFixed(6),
		radius: String(Math.max(0.01, radiusM / 1000)),
		limit: String(Math.min(50, limit)),
		lang: 'fr'
	});
	addTagFilters(params);

	const features = await photon(`/reverse?${params}`, opts);
	return dedupe(
		features.map((f) => parsePhotonFeature(f, origin)).filter((p): p is Place => p !== null)
	)
		.filter((p) => (p.distance ?? 0) <= radiusM * 1.1)
		.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0))
		.slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Photon                                                             */
/* ------------------------------------------------------------------ */

interface PhotonFeature {
	geometry?: { type?: string; coordinates?: [number, number] };
	properties?: Record<string, unknown>;
}

function hasOrigin(o: Partial<LatLon>): o is LatLon {
	return typeof o.lat === 'number' && typeof o.lon === 'number' && Number.isFinite(o.lat) && Number.isFinite(o.lon);
}

function addTagFilters(params: URLSearchParams) {
	for (const c of PLACE_CATEGORIES) params.append('osm_tag', `amenity:${c}`);
}

async function photon(pathAndQuery: string, opts: ProviderOptions): Promise<PhotonFeature[]> {
	const doFetch = opts.fetch ?? globalThis.fetch;
	const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	const controller = new AbortController();
	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		controller.abort();
	}, timeoutMs);
	const onAbort = () => controller.abort();
	if (opts.signal) {
		if (opts.signal.aborted) controller.abort();
		else opts.signal.addEventListener('abort', onAbort, { once: true });
	}

	const headers: Record<string, string> = { Accept: 'application/json' };
	// Le navigateur interdit de changer le User-Agent (et ça déclencherait un preflight CORS).
	if (typeof window === 'undefined') headers['User-Agent'] = USER_AGENT;

	try {
		const res = await doFetch(`${PHOTON_URL}${pathAndQuery}`, { signal: controller.signal, headers });
		if (!res.ok) throw new ProviderError(`Photon a répondu ${res.status}`, 'http', res.status);
		const body = (await res.json()) as { features?: PhotonFeature[] };
		return Array.isArray(body.features) ? body.features : [];
	} catch (e) {
		if (e instanceof ProviderError) throw e;
		if (timedOut) throw new ProviderError('Photon ne répond pas (délai dépassé)', 'timeout');
		if (opts.signal?.aborted) throw new ProviderError('Requête annulée', 'aborted');
		throw new ProviderError('Photon injoignable', 'network');
	} finally {
		clearTimeout(timer);
		opts.signal?.removeEventListener('abort', onAbort);
	}
}

const OSM_TYPES: Record<string, string> = { N: 'node', W: 'way', R: 'relation' };

/** Feature GeoJSON de Photon → `Place` (null si inexploitable : sans nom, sans position…). */
export function parsePhotonFeature(f: PhotonFeature, origin: LatLon | null = null): Place | null {
	const p = f.properties ?? {};
	const coords = f.geometry?.coordinates;
	const name = typeof p.name === 'string' ? p.name.trim() : '';
	const osmType = OSM_TYPES[String(p.osm_type ?? '')];
	const osmId = p.osm_id;
	if (!name || !osmType || (typeof osmId !== 'number' && typeof osmId !== 'string')) return null;
	if (!Array.isArray(coords) || coords.length < 2) return null;
	const [lon, lat] = coords;
	if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

	const value = String(p.osm_value ?? '');
	const category =
		p.osm_key === 'amenity' && (PLACE_CATEGORIES as readonly string[]).includes(value)
			? (value as PlaceCategory)
			: null;

	const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string).trim() : '');
	const street = [str('housenumber'), str('street')].filter(Boolean).join(' ');
	const address = [street, str('city') || str('locality') || str('district')].filter(Boolean).join(', ');

	return {
		sourceId: `${osmType}/${osmId}`,
		name,
		address: address || null,
		lat,
		lon,
		category,
		distance: origin ? haversine(origin, { lat, lon }) : null
	};
}

function dedupe(places: Place[]): Place[] {
	const seen = new Set<string>();
	return places.filter((p) => (seen.has(p.sourceId) ? false : (seen.add(p.sourceId), true)));
}

/**
 * Re-tri par tranches de distance (< 5 km, < 50 km, reste) en gardant l'ordre de pertinence
 * de Photon dans chaque tranche. Sans point de référence, l'ordre de Photon est conservé.
 */
export function rankByProximity(places: Place[]): Place[] {
	const bucket = (d: number | null) => (d === null ? 0 : d < 5_000 ? 0 : d < 50_000 ? 1 : 2);
	return places
		.map((p, i) => ({ p, i, b: bucket(p.distance) }))
		.sort((a, z) => a.b - z.b || a.i - z.i)
		.map((x) => x.p);
}
