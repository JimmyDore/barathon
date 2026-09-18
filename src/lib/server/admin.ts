/**
 * Session admin : cookie httpOnly signé (HMAC-SHA256), sans stockage serveur.
 * Valeur du cookie : `<expiration ms>.<signature hex>`. La clé est dérivée de
 * ADMIN_PASSWORD : changer le mot de passe déconnecte tout le monde.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { error, type Cookies } from '@sveltejs/kit';
import { adminPassword } from './config';

export const ADMIN_COOKIE = 'barathon_admin';
export const ADMIN_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sessionKey(password: string): Buffer {
	return createHash('sha256').update(`barathon-admin-session:${password}`).digest();
}

function sign(password: string, payload: string): string {
	return createHmac('sha256', sessionKey(password)).update(payload).digest('hex');
}

function safeEqualHex(a: string, b: string): boolean {
	const ba = Buffer.from(a, 'hex');
	const bb = Buffer.from(b, 'hex');
	return ba.length === bb.length && ba.length > 0 && timingSafeEqual(ba, bb);
}

/** Valeur de cookie signée, valable jusqu'à `expiresAt` (ms epoch). */
export function signSession(password: string, expiresAt: number): string {
	const payload = String(Math.floor(expiresAt));
	return `${payload}.${sign(password, payload)}`;
}

/** Vérifie la signature et l'expiration d'une valeur de cookie. */
export function verifySession(password: string, value: string | null | undefined, now = Date.now()): boolean {
	if (!value) return false;
	const dot = value.indexOf('.');
	if (dot <= 0) return false;
	const payload = value.slice(0, dot);
	const signature = value.slice(dot + 1);
	if (!/^\d+$/.test(payload) || !/^[0-9a-f]{64}$/.test(signature)) return false;
	if (Number(payload) <= now) return false;
	return safeEqualHex(signature, sign(password, payload));
}

/** Compare un mot de passe saisi au mot de passe attendu, en temps constant. */
export function checkPassword(input: string | null | undefined, expected: string): boolean {
	if (!input || !expected) return false;
	const a = createHash('sha256').update(input).digest();
	const b = createHash('sha256').update(expected).digest();
	return timingSafeEqual(a, b);
}

/* ---------- Helpers SvelteKit ---------- */

/** Le cookie de la requête ouvre-t-il une session admin valide ? */
export function isAdmin(cookies: Cookies): boolean {
	return verifySession(adminPassword(), cookies.get(ADMIN_COOKIE));
}

/**
 * Tente une connexion : si le mot de passe est bon, pose le cookie et renvoie true.
 * (Pense au limiteur `adminLoginLimiter` avant d'appeler.)
 */
export function loginAdmin(cookies: Cookies, password: string | null | undefined): boolean {
	const expected = adminPassword();
	if (!checkPassword(password, expected)) return false;
	const expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
	cookies.set(ADMIN_COOKIE, signSession(expected, expiresAt), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		// `secure` est à true par défaut dans SvelteKit (sauf sur http://localhost).
		maxAge: Math.floor(ADMIN_SESSION_TTL_MS / 1000)
	});
	return true;
}

export function logoutAdmin(cookies: Cookies): void {
	cookies.delete(ADMIN_COOKIE, { path: '/' });
}

/**
 * À appeler en tête d'un `load` ou d'une action réservée à l'admin.
 * `locals.admin` est rempli par hooks.server.ts. Lève une 403 sinon.
 */
export function requireAdmin(locals: App.Locals): void {
	if (!locals.admin) error(403, 'Réservé à l’admin : connecte-toi sur /admin.');
}
