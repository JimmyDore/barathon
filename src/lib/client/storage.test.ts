import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	forgetVisitToken,
	getSavedPseudo,
	getVisitToken,
	getVisitTokens,
	savePseudo,
	saveVisitToken,
	TOKENS_STORAGE_KEY
} from './storage';

function memoryStorage() {
	const data = new Map<string, string>();
	return {
		getItem: (k: string) => data.get(k) ?? null,
		setItem: (k: string, v: string) => void data.set(k, v),
		removeItem: (k: string) => void data.delete(k)
	};
}

afterEach(() => vi.unstubAllGlobals());

describe('client storage', () => {
	it('remembers the pseudo and visit tokens', () => {
		vi.stubGlobal('localStorage', memoryStorage());
		expect(getSavedPseudo()).toBe('');
		savePseudo('  Jim ');
		expect(getSavedPseudo()).toBe('Jim');
		saveVisitToken(12, 'tok-12');
		saveVisitToken(13, 'tok-13');
		expect(getVisitToken(12)).toBe('tok-12');
		forgetVisitToken(12);
		expect(getVisitToken(12)).toBeNull();
		expect(getVisitTokens()).toEqual({ '13': 'tok-13' });
	});

	it('survives corrupted data', () => {
		const s = memoryStorage();
		s.setItem(TOKENS_STORAGE_KEY, '{not json');
		vi.stubGlobal('localStorage', s);
		expect(getVisitTokens()).toEqual({});
		saveVisitToken(1, 'a');
		expect(getVisitToken(1)).toBe('a');
	});

	it('never throws when storage is blocked', () => {
		vi.stubGlobal('localStorage', {
			getItem() {
				throw new Error('SecurityError');
			},
			setItem() {
				throw new Error('QuotaExceededError');
			}
		});
		expect(getSavedPseudo()).toBe('');
		expect(() => savePseudo('Jim')).not.toThrow();
		expect(() => saveVisitToken(1, 'a')).not.toThrow();
		expect(getVisitToken(1)).toBeNull();
	});
});
