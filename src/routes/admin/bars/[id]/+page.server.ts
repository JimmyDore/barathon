import { error, fail, redirect } from '@sveltejs/kit';
import { requireAdmin } from '$lib/server/admin';
import { getStore } from '$lib/server/db';
import {
	MERGE_NEARBY_LIMIT,
	MERGE_RADIUS_M,
	mergeBarFromForm,
	moveBarFromForm,
	parseId,
	renameBarFromForm
} from '../../admin-forms';
import type { Actions, PageServerLoad } from './$types';

const GONE = 'Ce bar n’existe pas, ou plus (supprimé ou fusionné).';

function barId(raw: string): number {
	const id = parseId(raw);
	if (id === null) error(404, GONE);
	return id;
}

export const load: PageServerLoad = ({ params, locals, url }) => {
	if (!locals.admin) redirect(303, `/admin?suite=${encodeURIComponent(url.pathname)}`);

	const id = barId(params.id);
	const store = getStore();
	const bar = store.getBarSummary(id);
	if (!bar) error(404, GONE);

	const nearby = store
		.barsNearby(bar.lat, bar.lon, MERGE_RADIUS_M)
		.filter((b) => b.id !== id)
		.slice(0, MERGE_NEARBY_LIMIT)
		.map((b) => ({
			id: b.id,
			name: b.name,
			address: b.address,
			overall: b.overall,
			visitCount: b.visitCount,
			distance: Math.round(b.distance)
		}));

	const merged = url.searchParams.get('fusion');
	return {
		bar: {
			id: bar.id,
			name: bar.name,
			address: bar.address,
			lat: bar.lat,
			lon: bar.lon,
			source: bar.source,
			sourceId: bar.sourceId,
			overall: bar.overall,
			visitCount: bar.visitCount
		},
		nearby,
		/** Retour d'une fusion (?fusion=<passages déplacés>&de=<nom du bar fusionné>). */
		merged:
			merged === null
				? null
				: { count: parseId(merged) ?? 0, from: url.searchParams.get('de')?.slice(0, 120) ?? '' }
	};
};

export const actions: Actions = {
	rename: async ({ params, locals, request }) => {
		requireAdmin(locals);
		const res = renameBarFromForm(getStore(), barId(params.id), await request.formData());
		if (!res.ok) return fail(res.status, { action: 'rename' as const, error: res.error });
		return { action: 'rename' as const, success: 'Nom et adresse enregistrés.' };
	},

	move: async ({ params, locals, request }) => {
		requireAdmin(locals);
		const res = moveBarFromForm(getStore(), barId(params.id), await request.formData());
		if (!res.ok) return fail(res.status, { action: 'move' as const, error: res.error });
		return { action: 'move' as const, success: 'Nouvelle position enregistrée.' };
	},

	merge: async ({ params, locals, request }) => {
		requireAdmin(locals);
		const res = mergeBarFromForm(getStore(), barId(params.id), await request.formData());
		if (!res.ok) return fail(res.status, { action: 'merge' as const, error: res.error });
		redirect(
			303,
			`/admin/bars/${res.into.id}?fusion=${res.movedVisits}&de=${encodeURIComponent(res.from.name)}`
		);
	},

	delete: async ({ params, locals }) => {
		requireAdmin(locals);
		const store = getStore();
		const bar = store.getBar(barId(params.id));
		if (!bar || !store.deleteBar(bar.id)) {
			return fail(404, { action: 'delete' as const, error: GONE });
		}
		redirect(303, `/admin?supprime=${encodeURIComponent(bar.name)}`);
	}
};
