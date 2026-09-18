import { describe, expect, it } from 'vitest';
import { generateToken, hashToken, verifyToken } from './tokens';

describe('tokens', () => {
	it('generates distinct url-safe tokens with their hash', () => {
		const a = generateToken();
		const b = generateToken();
		expect(a.token).not.toBe(b.token);
		expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
		expect(a.hash).toBe(hashToken(a.token));
		expect(a.hash).not.toContain(a.token);
	});

	it('verifies the right token only', () => {
		const { token, hash } = generateToken();
		expect(verifyToken(token, hash)).toBe(true);
		expect(verifyToken(token + 'x', hash)).toBe(false);
		expect(verifyToken(generateToken().token, hash)).toBe(false);
	});

	it('rejects missing or malformed inputs', () => {
		const { token, hash } = generateToken();
		expect(verifyToken(null, hash)).toBe(false);
		expect(verifyToken('', hash)).toBe(false);
		expect(verifyToken(token, '')).toBe(false);
		expect(verifyToken(token, 'not-hex')).toBe(false);
		expect(verifyToken(token, null)).toBe(false);
	});
});
