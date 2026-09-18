/**
 * GET /api/bars/nearby?lat=47.21&lon=-1.55&radius=200
 * Nos bars dans le rayon (mètres, 10–5000, défaut 200), du plus proche au plus loin.
 * Sert à « Autour de moi » et à l'alerte « c'est pas celui-là ? » (radius=50).
 */
import { error, json } from '@sveltejs/kit';
import { GEO } from '$lib/constants';
import { toApiBar } from '$lib/server/api';
import { getStore } from '$lib/server/db';
import { parseCoordinates } from '$lib/validation';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const coords = parseCoordinates(url.searchParams.get('lat'), url.searchParams.get('lon'));
	if (!coords.ok) error(400, coords.error);
	const rawRadius = Number(url.searchParams.get('radius') ?? GEO.nearbyRadiusM);
	const radius = Number.isFinite(rawRadius) ? Math.min(5000, Math.max(10, rawRadius)) : GEO.nearbyRadiusM;
	const bars = getStore().barsNearby(coords.value.lat, coords.value.lon, radius).map(toApiBar);
	return json({ bars });
};
