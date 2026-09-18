/**
 * Logique commune des form actions de passage : création (anti-spam + validation + base),
 * modification et suppression (jeton d'auteur ou admin). Les pages n'ont plus qu'à
 * brancher ces fonctions et à renvoyer `fail(status, { errors })` en cas d'échec.
 *
 *   export const actions = {
 *     default: async (event) => {
 *       const out = createVisitFromForm(await event.request.formData(), { ip: clientKey(event) });
 *       if (!out.ok) return fail(out.status, { errors: out.errors });
 *       return out; // { ok, visitId, barId, token, score }
 *     }
 *   };
 */
import { todayInParis } from '$lib/dates';
import {
	isHoneypotFilled,
	parseBarChoice,
	parseVisitForm,
	getField,
	type FieldErrors,
	type FormSource
} from '$lib/validation';
import { getStore, type Store, type VisitAuth } from './db';
import { visitCreateLimiter } from './limiters';
import type { RateLimiter } from './ratelimit';
import { generateToken } from './tokens';

/** Champ caché qui porte le jeton d'auteur dans les formulaires de modification/suppression. */
export const TOKEN_FIELD = 'token';

export type Failure = { ok: false; status: 400 | 403 | 404 | 429; errors: FieldErrors };

export type CreateVisitOutcome =
	| {
			ok: true;
			visitId: number;
			barId: number;
			/** Jeton d'auteur en clair : à stocker dans le navigateur (`saveVisitToken`). */
			token: string;
			/** Note du passage seul. */
			score: number | null;
			/** true si le champ piège était rempli (rien n'a été enregistré). */
			discarded?: true;
	  }
	| Failure;

export interface CreateContext {
	/** Clé de limite de débit (IP via `clientKey(event)`), jamais stockée. */
	ip: string;
	store?: Store;
	limiter?: RateLimiter;
	/** Date du jour à Paris (tests). */
	today?: string;
}

export function createVisitFromForm(form: FormSource, ctx: CreateContext): CreateVisitOutcome {
	const store = ctx.store ?? getStore();
	const limiter = ctx.limiter ?? visitCreateLimiter;

	// Champ piège rempli : on fait semblant d'accepter, on ne stocke rien.
	if (isHoneypotFilled(form)) {
		return { ok: true, visitId: 0, barId: 0, token: generateToken().token, score: null, discarded: true };
	}

	const rate = limiter.hit(ctx.ip);
	if (!rate.ok) {
		const minutes = Math.max(1, Math.ceil(rate.retryAfterMs / 60_000));
		return {
			ok: false,
			status: 429,
			errors: { form: `Doucement ! Trop de passages d’un coup : réessaie dans ${minutes} min.` }
		};
	}

	const bar = parseBarChoice(form);
	const visit = parseVisitForm(form, { today: ctx.today ?? todayInParis() });
	if (!bar.ok || !visit.ok) {
		const errors: FieldErrors = visit.ok ? {} : { ...visit.errors };
		if (!bar.ok) errors.form = bar.error;
		return { ok: false, status: 400, errors };
	}

	const res = store.createVisit(bar.value, visit.value);
	if (!res.ok) return { ok: false, status: 404, errors: { form: 'Ce bar n’existe plus. Choisis-en un autre.' } };
	return { ok: true, visitId: res.visit.id, barId: res.bar.id, token: res.token, score: res.visit.score };
}

export interface EditContext {
	/** `locals.admin` */
	admin: boolean;
	store?: Store;
	today?: string;
}

function authOf(form: FormSource, admin: boolean): VisitAuth {
	return admin ? { admin: true } : { token: getField(form, TOKEN_FIELD) };
}

const FORBIDDEN: Failure = {
	ok: false,
	status: 403,
	errors: { form: 'Tu ne peux modifier que tes propres passages, depuis le téléphone qui les a notés.' }
};
const NOT_FOUND: Failure = { ok: false, status: 404, errors: { form: 'Ce passage n’existe plus.' } };

export function updateVisitFromForm(
	visitId: number,
	form: FormSource,
	ctx: EditContext
): { ok: true; visitId: number; barId: number; score: number | null } | Failure {
	const store = ctx.store ?? getStore();
	const auth = authOf(form, ctx.admin);
	const access = store.checkVisitAccess(visitId, auth);
	if (access === 'not_found') return NOT_FOUND;
	if (access === 'forbidden') return FORBIDDEN;

	const visit = parseVisitForm(form, { today: ctx.today ?? todayInParis() });
	if (!visit.ok) return { ok: false, status: 400, errors: visit.errors };

	const res = store.updateVisit(visitId, visit.value, auth);
	if (!res.ok) return res.reason === 'not_found' ? NOT_FOUND : FORBIDDEN;
	return { ok: true, visitId, barId: res.visit.barId, score: res.visit.score };
}

export function deleteVisitFromForm(
	visitId: number,
	form: FormSource,
	ctx: EditContext
): { ok: true; barId: number; barDeleted: boolean } | Failure {
	const store = ctx.store ?? getStore();
	const res = store.deleteVisit(visitId, authOf(form, ctx.admin));
	if (!res.ok) return res.reason === 'not_found' ? NOT_FOUND : FORBIDDEN;
	return { ok: true, barId: res.barId, barDeleted: res.barDeleted };
}
