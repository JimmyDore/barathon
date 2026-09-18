import { describe, expect, it } from 'vitest';
import { cleanPseudo, displayPseudo, pseudoKey } from './pseudo';

describe('pseudoKey', () => {
	it('ignores case, surrounding spaces and accents', () => {
		expect(pseudoKey('  Élodie ')).toBe('elodie');
		expect(pseudoKey('ELODIE')).toBe('elodie');
		expect(pseudoKey('élodie')).toBe(pseudoKey('Elodie'));
	});
	it('handles cedillas, ligature-free accents and inner spaces', () => {
		expect(pseudoKey('François')).toBe('francois');
		expect(pseudoKey('Jean   Michel')).toBe('jean michel');
		expect(pseudoKey('Zoë')).toBe('zoe');
	});
	it('keeps different people apart', () => {
		expect(pseudoKey('Jim')).not.toBe(pseudoKey('Jimmy'));
	});
});

describe('cleanPseudo', () => {
	it('trims and collapses spaces but keeps case and accents', () => {
		expect(cleanPseudo('  Élo   die ')).toBe('Élo die');
	});
});

describe('displayPseudo', () => {
	it('picks the most frequent spelling', () => {
		expect(displayPseudo(['élodie', 'Élodie', 'Élodie'])).toBe('Élodie');
	});
	it('breaks ties with the most recent spelling', () => {
		expect(displayPseudo(['elodie', 'Élodie'])).toBe('Élodie');
	});
	it('returns an empty string for no spelling', () => {
		expect(displayPseudo([])).toBe('');
	});
});
