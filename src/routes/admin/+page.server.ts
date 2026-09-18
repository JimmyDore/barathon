import { fail, redirect } from '@sveltejs/kit';
import { loginAdmin, logoutAdmin } from '$lib/server/admin';
import { getStore } from '$lib/server/db';
import { adminLoginLimiter, clientKey } from '$lib/server/limiters';
import { getField } from '$lib/validation';
import { ADMIN_FIELDS, safeNext } from './admin-forms';
import type { Actions, PageServerLoad } from './$types';

const RECENT_VISITS = 40;

export const load: PageServerLoad = ({ locals, url }) => {
	const next = safeNext(url.searchParams.get(ADMIN_FIELDS.next));
	if (!locals.admin) return { admin: false as const, next };
	if (next) redirect(303, next);

	const store = getStore();
	const bars = store
		.listBarSummaries()
		.map((b) => ({
			id: b.id,
			name: b.name,
			address: b.address,
			overall: b.overall,
			visitCount: b.visitCount,
			lastVisitDate: b.lastVisitDate
		}))
		.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

	return {
		admin: true as const,
		next: null,
		bars,
		visits: store.listRecentVisits(RECENT_VISITS),
		/** Nom du bar qu'on vient de supprimer (cf. /admin/bars/[id]?/delete). */
		deleted: url.searchParams.get('supprime')?.slice(0, 120) ?? null
	};
};

export const actions: Actions = {
	login: async (event) => {
		if (!adminLoginLimiter.hit(clientKey(event)).ok) {
			return fail(429, { error: 'Trop d’essais, attends quelques minutes.' });
		}
		const data = await event.request.formData();
		if (!loginAdmin(event.cookies, getField(data, ADMIN_FIELDS.password) ?? '')) {
			return fail(401, { error: 'Mauvais mot de passe.' });
		}
		redirect(303, safeNext(getField(data, ADMIN_FIELDS.next)) ?? '/admin');
	},

	logout: ({ cookies }) => {
		logoutAdmin(cookies);
		redirect(303, '/admin');
	}
};
