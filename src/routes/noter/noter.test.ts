import { describe, expect, it, vi } from 'vitest';
import { optionToFormFields } from '$lib/geo/merge';
import { parseBarChoice } from '$lib/validation';
import { GeoError, canRetry, geoErrorMessage, geoPermission, getPosition } from './geolocation';
import { distancePhrase, findDuplicates, manualOption } from './manual';

function fakeGeo(outcome: { lat: number; lon: number } | { code: number } | 'throw') {
	return {
		getCurrentPosition: vi.fn((ok: PositionCallback, fail?: PositionErrorCallback | null) => {
			if (outcome === 'throw') throw new Error('boom');
			if ('code' in outcome) fail?.({ code: outcome.code } as GeolocationPositionError);
			else ok({ coords: { latitude: outcome.lat, longitude: outcome.lon } } as GeolocationPosition);
		})
	};
}

describe('getPosition', () => {
	it('resolves with lat/lon', async () => {
		await expect(getPosition(undefined, fakeGeo({ lat: 47.213, lon: -1.556 }))).resolves.toEqual({
			lat: 47.213,
			lon: -1.556
		});
	});

	it.each([
		[1, 'denied'],
		[2, 'unavailable'],
		[3, 'timeout']
	])('maps error code %i to %s', async (code, kind) => {
		const err = await getPosition(undefined, fakeGeo({ code })).catch((e) => e);
		expect(err).toBeInstanceOf(GeoError);
		expect(err.kind).toBe(kind);
	});

	it('rejects as unsupported without the API, unavailable if it throws', async () => {
		await expect(getPosition(undefined, undefined)).rejects.toMatchObject({ kind: 'unsupported' });
		await expect(getPosition(undefined, fakeGeo('throw'))).rejects.toMatchObject({ kind: 'unavailable' });
	});
});

describe('geoPermission', () => {
	it('reads the permission state without prompting', async () => {
		const perms = { query: vi.fn(async () => ({ state: 'granted' }) as PermissionStatus) };
		await expect(geoPermission(perms)).resolves.toBe('granted');
		expect(perms.query).toHaveBeenCalledWith({ name: 'geolocation' });
	});

	it('falls back to unknown', async () => {
		await expect(geoPermission(undefined)).resolves.toBe('unknown');
		await expect(geoPermission({ query: async () => Promise.reject(new TypeError('nope')) })).resolves.toBe(
			'unknown'
		);
	});
});

describe('geo messages', () => {
	it('explains every failure in French and only offers a retry when it can help', () => {
		for (const kind of ['denied', 'unsupported', 'timeout', 'unavailable'] as const) {
			expect(geoErrorMessage(kind)).toMatch(/cherche le bar par son nom/i);
		}
		expect(canRetry('denied')).toBe(false);
		expect(canRetry('unsupported')).toBe(false);
		expect(canRetry('timeout')).toBe(true);
	});
});

describe('manualOption', () => {
	it('produces hidden fields the server reads as a manual bar', () => {
		const option = manualOption('Chez Robert', null, { lat: 47.213, lon: -1.556 });
		const choice = parseBarChoice(optionToFormFields(option));
		expect(choice).toEqual({
			ok: true,
			value: { kind: 'manual', name: 'Chez Robert', address: null, lat: 47.213, lon: -1.556 }
		});
	});
});

describe('distancePhrase', () => {
	it('never claims a bar on the same spot is 10 m away', () => {
		expect(distancePhrase(0)).toBe('à moins de 10 m');
		expect(distancePhrase(32)).toBe('à 30 m');
		expect(distancePhrase(null)).toBe('tout près');
	});
});

describe('findDuplicates', () => {
	const bar = (id: number, distance: number) => ({
		id,
		name: `Bar ${id}`,
		address: null,
		lat: 47.2,
		lon: -1.5,
		source: 'manual' as const,
		sourceId: null,
		category: null,
		overall: null,
		visitCount: 1,
		distance
	});

	it('asks our API within 50 m and sorts closest first', async () => {
		const fetchMock = vi.fn(async () => Response.json({ bars: [bar(2, 40), bar(1, 5)] }));
		const found = await findDuplicates({ lat: 47.213, lon: -1.556 }, { fetch: fetchMock as typeof fetch });
		expect(found.map((b) => b.id)).toEqual([1, 2]);
		expect(String(fetchMock.mock.calls[0])).toContain('radius=50');
	});

	it('never blocks the flow when the API fails', async () => {
		const down = vi.fn(async () => new Response('nope', { status: 500 }));
		await expect(findDuplicates({ lat: 1, lon: 1 }, { fetch: down as typeof fetch })).resolves.toEqual([]);
		const offline = vi.fn(async () => Promise.reject(new TypeError('offline')));
		await expect(findDuplicates({ lat: 1, lon: 1 }, { fetch: offline as typeof fetch })).resolves.toEqual([]);
	});
});
