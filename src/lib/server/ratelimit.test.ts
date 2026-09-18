import { describe, expect, it } from 'vitest';
import { createRateLimiter } from './ratelimit';

describe('createRateLimiter', () => {
	it('accepts up to the limit within the window, then refuses', () => {
		const rl = createRateLimiter({ limit: 3, windowMs: 1000 });
		expect(rl.hit('a', 0).ok).toBe(true);
		expect(rl.hit('a', 10).ok).toBe(true);
		const third = rl.hit('a', 20);
		expect(third).toEqual({ ok: true, remaining: 0, retryAfterMs: 0 });
		const refused = rl.hit('a', 30);
		expect(refused.ok).toBe(false);
		expect(refused.retryAfterMs).toBe(970);
	});

	it('slides the window', () => {
		const rl = createRateLimiter({ limit: 2, windowMs: 1000 });
		rl.hit('a', 0);
		rl.hit('a', 500);
		expect(rl.hit('a', 999).ok).toBe(false);
		expect(rl.hit('a', 1001).ok).toBe(true); // le coup à t=0 est sorti
		expect(rl.hit('a', 1002).ok).toBe(false);
	});

	it('does not count refused hits', () => {
		const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
		rl.hit('a', 0);
		for (let t = 100; t < 1000; t += 100) expect(rl.hit('a', t).ok).toBe(false);
		expect(rl.hit('a', 1000).ok).toBe(true);
	});

	it('keeps keys independent', () => {
		const rl = createRateLimiter({ limit: 1, windowMs: 1000 });
		expect(rl.hit('1.1.1.1', 0).ok).toBe(true);
		expect(rl.hit('2.2.2.2', 0).ok).toBe(true);
		expect(rl.hit('1.1.1.1', 1).ok).toBe(false);
	});

	it('forgets stale keys and supports reset', () => {
		const rl = createRateLimiter({ limit: 5, windowMs: 1000 });
		rl.hit('a', 0);
		rl.hit('b', 0);
		expect(rl.size()).toBe(2);
		rl.hit('c', 5000); // balayage : a et b sont périmées
		expect(rl.size()).toBe(1);
		rl.reset();
		expect(rl.size()).toBe(0);
	});
});
