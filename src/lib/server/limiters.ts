/**
 * Limiteurs partagés par tout le serveur (un seul process Node : la mémoire suffit).
 */
import type { RequestEvent } from '@sveltejs/kit';
import { RATE_LIMITS } from '$lib/constants';
import { createRateLimiter } from './ratelimit';

/** 20 créations de passages / 10 min / IP. */
export const visitCreateLimiter = createRateLimiter(RATE_LIMITS.visitCreate);
/** 10 tentatives de connexion admin / 10 min / IP. */
export const adminLoginLimiter = createRateLimiter(RATE_LIMITS.adminLogin);

/**
 * Adresse du client pour la limite de débit (jamais stockée).
 * Derrière Caddy, adapter-node la lit dans X-Forwarded-For (ADDRESS_HEADER + XFF_DEPTH).
 */
export function clientKey(event: Pick<RequestEvent, 'getClientAddress'>): string {
	try {
		return event.getClientAddress();
	} catch {
		return 'unknown';
	}
}
