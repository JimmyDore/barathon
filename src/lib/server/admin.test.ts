import { describe, expect, it } from 'vitest';
import { checkPassword, signSession, verifySession } from './admin';

describe('admin session', () => {
	const now = 1_800_000_000_000;

	it('verifies a freshly signed session', () => {
		const value = signSession('s3cret', now + 60_000);
		expect(verifySession('s3cret', value, now)).toBe(true);
	});

	it('rejects expired sessions', () => {
		const value = signSession('s3cret', now - 1);
		expect(verifySession('s3cret', value, now)).toBe(false);
	});

	it('rejects a session signed with another password', () => {
		const value = signSession('old', now + 60_000);
		expect(verifySession('new', value, now)).toBe(false);
	});

	it('rejects tampered or malformed values', () => {
		const value = signSession('s3cret', now + 60_000);
		const [exp, sig] = value.split('.');
		expect(verifySession('s3cret', `${Number(exp) + 1000}.${sig}`, now)).toBe(false);
		const flipped = sig.slice(0, -1) + (sig.endsWith('0') ? '1' : '0');
		expect(verifySession('s3cret', `${exp}.${flipped}`, now)).toBe(false);
		expect(verifySession('s3cret', 'garbage', now)).toBe(false);
		expect(verifySession('s3cret', '', now)).toBe(false);
		expect(verifySession('s3cret', undefined, now)).toBe(false);
		expect(verifySession('s3cret', `.${sig}`, now)).toBe(false);
	});
});

describe('checkPassword', () => {
	it('matches only the exact password', () => {
		expect(checkPassword('hunter2', 'hunter2')).toBe(true);
		expect(checkPassword('hunter3', 'hunter2')).toBe(false);
		expect(checkPassword('', 'hunter2')).toBe(false);
		expect(checkPassword(null, 'hunter2')).toBe(false);
	});
});
