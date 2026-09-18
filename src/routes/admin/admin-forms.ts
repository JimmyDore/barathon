/**
 * Logique des formulaires admin (connexion, fiche bar admin), sans SvelteKit :
 * les pages branchent ces fonctions dans leurs form actions, les tests les
 * appellent avec un store SQLite en mémoire.
 */
import type { Store } from '$lib/server/db';
import type { Bar } from '$lib/types';
import {
	getField,
	parseAddress,
	parseBarName,
	parseCoordinates,
	type FormSource
} from '$lib/validation';

/** Rayon (m) des candidats à la fusion proposés sur la fiche admin d'un bar. */
export const MERGE_RADIUS_M = 500;
/** Nombre max de candidats « à côté ». */
export const MERGE_NEARBY_LIMIT = 6;

/** Noms des champs des formulaires admin. */
export const ADMIN_FIELDS = {
	password: 'password',
	next: 'suite',
	name: 'name',
	address: 'address',
	lat: 'lat',
	lon: 'lon',
	into: 'into'
} as const;

/** Identifiant entier positif (« 12 ») ; null sinon. */
export function parseId(raw: string | null | undefined): number | null {
	const s = (raw ?? '').trim();
	if (!/^\d{1,15}$/.test(s)) return null;
	const n = Number(s);
	return n > 0 && Number.isSafeInteger(n) ? n : null;
}

const BASE = 'http://barathon.invalid';

/**
 * Où revenir après la connexion : un chemin interne seulement (pas de `//ailleurs`,
 * pas d'URL absolue), et jamais `/admin` lui-même (pas de boucle).
 */
export function safeNext(raw: string | null | undefined): string | null {
	const s = (raw ?? '').trim();
	if (!s.startsWith('/') || s.startsWith('//') || s.includes('\\')) return null;
	try {
		const u = new URL(s, BASE);
		if (u.origin !== BASE) return null;
		if (u.pathname === '/admin' || u.pathname === '/admin/') return null;
		return u.pathname + u.search;
	} catch {
		return null;
	}
}

export type AdminFailure = { ok: false; status: 400 | 404; error: string };

const GONE: AdminFailure = { ok: false, status: 404, error: 'Ce bar n’existe plus.' };

/** Renommer (et changer l'adresse : vide = pas d'adresse). */
export function renameBarFromForm(store: Store, id: number, form: FormSource): { ok: true; bar: Bar } | AdminFailure {
	const name = parseBarName(getField(form, ADMIN_FIELDS.name));
	if (!name.ok) return { ok: false, status: 400, error: name.error };
	const address = parseAddress(getField(form, ADMIN_FIELDS.address));
	const bar = store.renameBar(id, name.value, address);
	return bar ? { ok: true, bar } : GONE;
}

/** Déplacer le bar sur la position de l'épingle. */
export function moveBarFromForm(store: Store, id: number, form: FormSource): { ok: true; bar: Bar } | AdminFailure {
	const coords = parseCoordinates(getField(form, ADMIN_FIELDS.lat), getField(form, ADMIN_FIELDS.lon));
	if (!coords.ok) return { ok: false, status: 400, error: coords.error };
	const bar = store.moveBar(id, coords.value.lat, coords.value.lon);
	return bar ? { ok: true, bar } : GONE;
}

/** Fusionner le bar `id` dans le bar choisi (`into`) : ses passages y passent, il est supprimé. */
export function mergeBarFromForm(
	store: Store,
	id: number,
	form: FormSource
): { ok: true; from: Bar; into: Bar; movedVisits: number } | AdminFailure {
	const intoId = parseId(getField(form, ADMIN_FIELDS.into));
	if (intoId === null) return { ok: false, status: 400, error: 'Choisis le bar dans lequel fusionner.' };
	if (intoId === id) return { ok: false, status: 400, error: 'Un bar ne peut pas fusionner avec lui-même.' };
	const from = store.getBar(id);
	if (!from) return GONE;
	const res = store.mergeBars(id, intoId);
	if (!res.ok) {
		return res.reason === 'same_bar'
			? { ok: false, status: 400, error: 'Un bar ne peut pas fusionner avec lui-même.' }
			: { ok: false, status: 404, error: 'L’autre bar n’existe plus. Choisis-en un autre.' };
	}
	return { ok: true, from, into: res.bar, movedVisits: res.movedVisits };
}
