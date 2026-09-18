/**
 * GET /api/bars/search?q=chat&source_ids=node/1,way/2
 * Nos bars dont le nom (ou l'adresse) contient `q` (sans casse ni accents),
 * plus ceux qui correspondent aux identifiants OSM donnés (résultats du fournisseur).
 */
import { json } from '@sveltejs/kit';
import { toApiBar } from '$lib/server/api';
import { getStore } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const store = getStore();
	const q = (url.searchParams.get('q') ?? '').slice(0, 100);
	const sourceIds = (url.searchParams.get('source_ids') ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter((s) => /^(node|way|relation)\/\d+$/.test(s))
		.slice(0, 50);

	const byText = store.searchBars(q, 8);
	const bySource = store.getBarSummariesBySourceIds(sourceIds);
	const seen = new Set<number>();
	const bars = [...byText, ...bySource]
		.filter((b) => (seen.has(b.id) ? false : (seen.add(b.id), true)))
		.map(toApiBar);
	return json({ bars });
};
