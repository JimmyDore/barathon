/**
 * /passages/[id]/modifier : l'auteur (jeton gardé dans son navigateur) ou l'admin
 * modifie ou supprime un passage. Les deux actions marchent aussi sans JS.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import { todayInParis } from '$lib/dates';
import { getStore } from '$lib/server/db';
import { deleteVisitFromForm, TOKEN_FIELD, updateVisitFromForm } from '$lib/server/visit-actions';
import { visitToFormValues } from '$lib/validation';
import { visitValuesFromForm } from '$lib/visit-form';
import type { Actions, PageServerLoad } from './$types';

function visitIdOf(raw: string): number {
	if (!/^\d{1,12}$/.test(raw) || Number(raw) <= 0) error(404, 'Ce passage n’existe pas.');
	return Number(raw);
}

export const load: PageServerLoad = ({ params, locals }) => {
	const id = visitIdOf(params.id);
	const store = getStore();
	const visit = store.getVisit(id);
	if (!visit) error(404, 'Ce passage n’existe pas, ou plus.');
	const bar = store.getBarSummary(visit.barId);
	if (!bar) error(404, 'Le bar de ce passage n’existe plus.');
	return {
		visitId: id,
		pseudo: visit.pseudo,
		date: visit.date,
		values: visitToFormValues(visit),
		bar: { id: bar.id, name: bar.name, address: bar.address, visitCount: bar.visitCount },
		admin: locals.admin,
		/** Nom du champ caché qui renvoie le jeton d'auteur (le module serveur ne va pas au navigateur). */
		tokenField: TOKEN_FIELD,
		today: todayInParis()
	};
};

export const actions: Actions = {
	update: async ({ params, request, locals }) => {
		const id = visitIdOf(params.id);
		const form = await request.formData();
		const out = updateVisitFromForm(id, form, { admin: locals.admin });
		if (!out.ok) return fail(out.status, { errors: out.errors, values: visitValuesFromForm(form) });
		redirect(303, `/bars/${out.barId}`);
	},

	delete: async ({ params, request, locals }) => {
		const id = visitIdOf(params.id);
		const out = deleteVisitFromForm(id, await request.formData(), { admin: locals.admin });
		if (!out.ok) return fail(out.status, { errors: out.errors, deleteFailed: true as const });
		// Le bar disparaît avec son dernier passage : retour à la carte.
		redirect(303, out.barDeleted ? '/' : `/bars/${out.barId}`);
	}
};
