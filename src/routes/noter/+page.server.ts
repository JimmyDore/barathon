/**
 * /noter : choisir le bar (dans le navigateur), puis noter son passage.
 * `?bar=<id>` saute le choix du bar. L'enregistrement marche aussi sans JS (form action).
 */
import { fail } from '@sveltejs/kit';
import { todayInParis } from '$lib/dates';
import { toApiBar } from '$lib/server/api';
import { getStore } from '$lib/server/db';
import { clientKey } from '$lib/server/limiters';
import { createVisitFromForm } from '$lib/server/visit-actions';
import { visitValuesFromForm } from '$lib/visit-form';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const raw = url.searchParams.get('bar');
	let bar = null;
	if (raw !== null && /^\d{1,12}$/.test(raw)) {
		const summary = getStore().getBarSummary(Number(raw));
		if (summary) bar = toApiBar(summary);
	}
	return {
		/** Bar demandé par `?bar=<id>` (null s'il n'existe pas). */
		bar,
		/** `?bar=` pointait vers un bar qui n'existe pas (ou plus). */
		missingBar: raw !== null && bar === null,
		today: todayInParis()
	};
};

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.formData();
		const out = createVisitFromForm(form, { ip: clientKey(event) });
		if (!out.ok) return fail(out.status, { errors: out.errors, values: visitValuesFromForm(form) });
		// `discarded` (champ piège) ne sort jamais : un robot doit croire que ça a marché.
		return { ok: true as const, visitId: out.visitId, barId: out.barId, token: out.token, score: out.score };
	}
};
