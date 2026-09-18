import { error } from '@sveltejs/kit';
import { getStore } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, locals }) => {
	const id = /^\d{1,15}$/.test(params.id) ? Number(params.id) : 0;
	const store = getStore();
	const bar = id > 0 ? store.getBarSummary(id) : null;
	if (!bar) error(404, 'Ce bar n’existe pas, ou plus : il a peut-être été fusionné avec un autre.');
	return { bar, visits: store.listVisitsByBar(bar.id), admin: locals.admin };
};
