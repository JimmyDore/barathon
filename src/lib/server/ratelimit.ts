/**
 * Limiteur de débit en mémoire (fenêtre glissante), par clé (ex. IP).
 * Rien n'est écrit sur disque : les IP ne sont jamais stockées en base.
 */

export interface RateLimitResult {
	ok: boolean;
	/** Coups restants dans la fenêtre après celui-ci. */
	remaining: number;
	/** Délai avant qu'un nouveau coup soit accepté (0 si ok). */
	retryAfterMs: number;
}

export interface RateLimiter {
	/** Enregistre un coup pour `key` et dit s'il est accepté. Un coup refusé n'est pas compté. */
	hit(key: string, now?: number): RateLimitResult;
	/** Oublie une clé (ou tout). */
	reset(key?: string): void;
	/** Nombre de clés suivies (pour les tests). */
	size(): number;
}

export function createRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }): RateLimiter {
	const hits = new Map<string, number[]>();
	let lastSweep = 0;

	function sweep(now: number) {
		if (now - lastSweep < windowMs) return;
		lastSweep = now;
		for (const [key, list] of hits) {
			if (list.length === 0 || list[list.length - 1] <= now - windowMs) hits.delete(key);
		}
	}

	return {
		hit(key, now = Date.now()) {
			sweep(now);
			const since = now - windowMs;
			const list = (hits.get(key) ?? []).filter((t) => t > since);
			if (list.length >= limit) {
				hits.set(key, list);
				return { ok: false, remaining: 0, retryAfterMs: list[0] + windowMs - now };
			}
			list.push(now);
			hits.set(key, list);
			return { ok: true, remaining: limit - list.length, retryAfterMs: 0 };
		},
		reset(key) {
			if (key === undefined) hits.clear();
			else hits.delete(key);
		},
		size() {
			return hits.size;
		}
	};
}
