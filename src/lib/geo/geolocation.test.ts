import { describe, expect, it, vi } from 'vitest';
import {
	GeoError,
	canRetry,
	geoErrorMessage,
	geoPermission,
	getPosition,
	initialGeoStep,
	stopAsking,
	type GeoErrorKind,
	type GeoPermission
} from './geolocation';

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

describe('initialGeoStep', () => {
	it('locates right away only when the permission is already granted', () => {
		expect(initialGeoStep('granted', true)).toBe('locate');
	});

	// iOS Chrome/Firefox/Edge answer `denied` before the user was ever asked.
	it.each<GeoPermission>(['denied', 'prompt', 'unknown'])(
		'waits for a tap on the button when the permission says %s',
		(perm) => {
			expect(initialGeoStep(perm, true)).toBe('ask');
		}
	);

	it('never gives up on a permission query that says denied', async () => {
		const perms = { query: async () => ({ state: 'denied' }) as PermissionStatus };
		const step = initialGeoStep(await geoPermission(perms), true);
		expect(step).toBe('ask');
		// …and the tap then asks the real API, which is the one that decides.
		const geo = fakeGeo({ lat: 47.213, lon: -1.556 });
		await expect(getPosition(undefined, geo)).resolves.toEqual({ lat: 47.213, lon: -1.556 });
		expect(geo.getCurrentPosition).toHaveBeenCalledOnce();
	});

	it('only reports unsupported when the browser has no geolocation', () => {
		expect(initialGeoStep('granted', false)).toBe('unsupported');
		expect(initialGeoStep('unknown', false)).toBe('unsupported');
	});
});

describe('geo messages and retry', () => {
	const kinds: GeoErrorKind[] = ['denied', 'unsupported', 'timeout', 'unavailable'];

	it('explains every failure in French and points to the search', () => {
		for (const kind of kinds) expect(geoErrorMessage(kind)).toMatch(/cherche le bar par son nom/i);
	});

	it('tells iPhone users where to turn the position back on', () => {
		expect(geoErrorMessage('denied')).toMatch(/^Position refusée\./);
		expect(geoErrorMessage('denied')).toMatch(/Réglages › Apps › Chrome \(ou Safari\) › Position/);
	});

	it('still offers a retry after a real denial (settings may have changed), not without the API', () => {
		expect(canRetry('denied')).toBe(true);
		expect(canRetry('timeout')).toBe(true);
		expect(canRetry('unavailable')).toBe(true);
		expect(canRetry('unsupported')).toBe(false);
	});

	it('stops asking on its own only after a real denial or without the API', () => {
		expect(stopAsking('denied')).toBe(true);
		expect(stopAsking('unsupported')).toBe(true);
		expect(stopAsking('timeout')).toBe(false);
		expect(stopAsking('unavailable')).toBe(false);
	});
});
