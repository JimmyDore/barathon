import { describe, expect, it, vi } from 'vitest';
import { haversine } from './distance';
import { mergeNearby, mergeSearch, optionToFormFields, type OwnBarLike } from './merge';
import { nearby, parsePhotonFeature, ProviderError, rankByProximity, search, type Place } from './provider';

const nantes = { lat: 47.213, lon: -1.556 };

function feature(id: number, name: string, lon: number, lat: number, extra: Record<string, unknown> = {}) {
	return {
		type: 'Feature',
		geometry: { type: 'Point', coordinates: [lon, lat] as [number, number] },
		properties: {
			osm_type: 'N',
			osm_id: id,
			osm_key: 'amenity',
			osm_value: 'bar',
			name,
			street: 'Rue Kervégan',
			city: 'Nantes',
			...extra
		}
	};
}

function mockFetch(body: unknown, status = 200) {
	return vi.fn(async (_url: string | URL | Request, _init?: RequestInit) =>
		new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
	) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

describe('haversine', () => {
	it('is zero for the same point and symmetric', () => {
		expect(haversine(nantes, nantes)).toBe(0);
		const roche = { lat: 46.6705, lon: -1.426 };
		expect(haversine(nantes, roche)).toBeCloseTo(haversine(roche, nantes), 6);
	});
	it('matches known distances', () => {
		// Nantes → La Roche-sur-Yon ≈ 61 km à vol d'oiseau
		const d = haversine(nantes, { lat: 46.6705, lon: -1.426 });
		expect(d).toBeGreaterThan(59_000);
		expect(d).toBeLessThan(63_000);
		// 0,001° de latitude ≈ 111 m
		expect(haversine(nantes, { lat: nantes.lat + 0.001, lon: nantes.lon })).toBeCloseTo(111.2, 0);
	});
});

describe('parsePhotonFeature', () => {
	it('maps a Photon feature to a Place', () => {
		const p = parsePhotonFeature(
			feature(4009374049, 'Le Chat Noir', -1.556283, 47.2129438, { housenumber: '3', street: 'Rue du Guesclin' }),
			nantes
		);
		expect(p).toMatchObject({
			sourceId: 'node/4009374049',
			name: 'Le Chat Noir',
			address: '3 Rue du Guesclin, Nantes',
			category: 'bar',
			lat: 47.2129438,
			lon: -1.556283
		});
		expect(p!.distance).toBeGreaterThan(0);
		expect(p!.distance).toBeLessThan(30);
	});
	it('maps ways and relations, and drops unnamed features', () => {
		expect(parsePhotonFeature(feature(7, 'X', 0, 0, { osm_type: 'W' }))!.sourceId).toBe('way/7');
		expect(parsePhotonFeature(feature(8, 'X', 0, 0, { osm_type: 'R' }))!.sourceId).toBe('relation/8');
		expect(parsePhotonFeature(feature(9, '', 0, 0))).toBeNull();
		expect(parsePhotonFeature({ properties: { name: 'X', osm_type: 'N', osm_id: 1 } })).toBeNull();
	});
	it('keeps only known amenity categories', () => {
		expect(parsePhotonFeature(feature(1, 'X', 0, 0, { osm_value: 'pub' }))!.category).toBe('pub');
		expect(parsePhotonFeature(feature(1, 'X', 0, 0, { osm_value: 'bank' }))!.category).toBeNull();
	});
});

describe('rankByProximity', () => {
	it('puts close results first but keeps relevance order inside a distance band', () => {
		const p = (sourceId: string, distance: number | null) => ({ sourceId, distance }) as Place;
		const ranked = rankByProximity([p('far', 300_000), p('near2', 3000), p('mid', 20_000), p('near1', 100)]);
		expect(ranked.map((x) => x.sourceId)).toEqual(['near2', 'near1', 'mid', 'far']);
	});
});

describe('search', () => {
	it('queries Photon with amenity filters and location bias, then ranks by proximity', async () => {
		const f = mockFetch({
			features: [
				feature(1, 'Chat Noir Angers', -0.55, 47.47),
				feature(2, 'Le Chat Noir', -1.5563, 47.2129),
				feature(2, 'Le Chat Noir', -1.5563, 47.2129)
			]
		});
		const res = await search('chat noir', { ...nantes, fetch: f });
		expect(res.map((r) => r.sourceId)).toEqual(['node/2', 'node/1']);
		const url = new URL(String(f.mock.calls[0][0]));
		expect(url.origin + url.pathname).toBe('https://photon.komoot.io/api/');
		expect(url.searchParams.get('q')).toBe('chat noir');
		expect(url.searchParams.get('lat')).toBe('47.21300');
		expect(url.searchParams.getAll('osm_tag')).toEqual([
			'amenity:bar',
			'amenity:pub',
			'amenity:cafe',
			'amenity:biergarten',
			'amenity:nightclub',
			'amenity:restaurant'
		]);
	});

	it('does not call Photon for queries shorter than 2 characters', async () => {
		const f = mockFetch({ features: [] });
		expect(await search(' a ', { fetch: f })).toEqual([]);
		expect(f).not.toHaveBeenCalled();
	});

	it('throws a ProviderError on HTTP errors and network failures', async () => {
		await expect(search('chat', { fetch: mockFetch({}, 503) })).rejects.toMatchObject({
			name: 'ProviderError',
			kind: 'http',
			status: 503
		});
		const broken = vi.fn(async () => {
			throw new TypeError('fetch failed');
		}) as unknown as typeof fetch;
		await expect(search('chat', { fetch: broken })).rejects.toBeInstanceOf(ProviderError);
	});

	it('reports timeouts', async () => {
		const slow = ((_: unknown, init?: RequestInit) =>
			new Promise((_, reject) => {
				init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
			})) as unknown as typeof fetch;
		await expect(search('chat', { fetch: slow, timeoutMs: 10 })).rejects.toMatchObject({ kind: 'timeout' });
	});

	it('reports caller aborts as "aborted"', async () => {
		const ctrl = new AbortController();
		const slow = ((_: unknown, init?: RequestInit) =>
			new Promise((_, reject) => {
				init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
			})) as unknown as typeof fetch;
		const p = search('chat', { fetch: slow, signal: ctrl.signal });
		ctrl.abort();
		await expect(p).rejects.toMatchObject({ kind: 'aborted' });
	});
});

describe('nearby', () => {
	it('uses Photon reverse with a radius in km and sorts by distance', async () => {
		const f = mockFetch({
			features: [
				feature(1, 'Loin', -1.556, 47.2146), // ~180 m
				feature(2, 'Tout près', -1.556, 47.2131), // ~11 m
				feature(3, 'Hors rayon', -1.556, 47.217) // ~440 m
			]
		});
		const res = await nearby(nantes, 200, { fetch: f });
		expect(res.map((r) => r.name)).toEqual(['Tout près', 'Loin']);
		const url = new URL(String(f.mock.calls[0][0]));
		expect(url.pathname).toBe('/reverse');
		expect(url.searchParams.get('radius')).toBe('0.2');
	});
});

describe('merge', () => {
	const place = (id: number, name: string, dLat: number): Place => ({
		sourceId: `node/${id}`,
		name,
		address: null,
		lat: nantes.lat + dLat,
		lon: nantes.lon,
		category: 'bar',
		distance: null
	});
	const own = (id: number, name: string, dLat: number, sourceId: string | null = null): OwnBarLike => ({
		id,
		name,
		address: null,
		lat: nantes.lat + dLat,
		lon: nantes.lon,
		source: sourceId ? 'osm' : 'manual',
		sourceId,
		category: null,
		overall: 4,
		visitCount: 2
	});

	it('mergeNearby dedupes by sourceId, sorts by distance and keeps 5 within the radius', () => {
		const res = mergeNearby(
			[
				place(1, 'OSM 1', 0.0001),
				place(2, 'Déjà chez nous', 0.0002),
				place(3, 'OSM 3', 0.0005),
				place(4, 'OSM 4', 0.0007),
				place(5, 'OSM 5', 0.0009),
				place(6, 'OSM 6', 0.0011),
				place(7, 'Trop loin', 0.01)
			],
			[own(10, 'Déjà chez nous (renommé)', 0.0002, 'node/2'), own(11, 'Manuel', 0.00015)],
			nantes
		);
		expect(res.map((o) => o.key)).toEqual(['osm:node/1', 'bar:11', 'bar:10', 'osm:node/3', 'osm:node/4']);
		expect(res[2].overall).toBe(4);
	});

	it('mergeSearch lists our text matches first, then provider results with our bars substituted', () => {
		const res = mergeSearch(
			[place(1, 'Chat Noir', 0.001), place(2, 'Chat Noir Angers', 1)],
			[own(10, 'Chat Noir', 0.001, 'node/1'), own(11, 'Le Chat Manuel', 0.002)],
			nantes
		);
		expect(res.map((o) => o.key)).toEqual(['bar:11', 'bar:10', 'osm:node/2']);
	});

	it('optionToFormFields gives bar_id for known bars, the place otherwise', () => {
		const [known, fresh] = mergeSearch([place(2, 'Nouveau', 0.001)], [own(11, 'Connu', 0)], nantes);
		expect(optionToFormFields(known)).toEqual({ bar_id: '11' });
		expect(optionToFormFields(fresh)).toMatchObject({ source: 'osm', source_id: 'node/2', name: 'Nouveau' });
	});
});
