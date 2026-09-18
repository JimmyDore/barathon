/**
 * Petites mémoires du navigateur (localStorage). Tout est dans des try/catch :
 * navigation privée, stockage bloqué ou plein ne doivent jamais casser la page.
 *
 * Clés :
 * - `barathon.pseudo` : dernier pseudo saisi (texte).
 * - `barathon.tokens` : jetons d'auteur, objet JSON { "<id du passage>": "<jeton>" }.
 */

export const PSEUDO_STORAGE_KEY = 'barathon.pseudo';
export const TOKENS_STORAGE_KEY = 'barathon.tokens';

function read(key: string): string | null {
	try {
		return globalThis.localStorage?.getItem(key) ?? null;
	} catch {
		return null;
	}
}

function write(key: string, value: string): void {
	try {
		globalThis.localStorage?.setItem(key, value);
	} catch {
		/* stockage indisponible : tant pis */
	}
}

/** Dernier pseudo utilisé ('' si aucun). */
export function getSavedPseudo(): string {
	return read(PSEUDO_STORAGE_KEY) ?? '';
}

export function savePseudo(pseudo: string): void {
	const p = pseudo.trim();
	if (p) write(PSEUDO_STORAGE_KEY, p);
}

/** Tous les jetons connus de ce navigateur, par id de passage. */
export function getVisitTokens(): Record<string, string> {
	const raw = read(TOKENS_STORAGE_KEY);
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
		const out: Record<string, string> = {};
		for (const [k, v] of Object.entries(parsed)) if (typeof v === 'string') out[k] = v;
		return out;
	} catch {
		return {};
	}
}

/** Jeton d'auteur de ce passage s'il a été créé depuis ce navigateur. */
export function getVisitToken(visitId: number): string | null {
	return getVisitTokens()[String(visitId)] ?? null;
}

/** À appeler juste après la création d'un passage (le serveur renvoie le jeton une seule fois). */
export function saveVisitToken(visitId: number, token: string): void {
	const all = getVisitTokens();
	all[String(visitId)] = token;
	write(TOKENS_STORAGE_KEY, JSON.stringify(all));
}

/** À appeler après la suppression d'un passage. */
export function forgetVisitToken(visitId: number): void {
	const all = getVisitTokens();
	delete all[String(visitId)];
	write(TOKENS_STORAGE_KEY, JSON.stringify(all));
}
