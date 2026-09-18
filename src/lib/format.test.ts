import { describe, expect, it } from 'vitest';
import { isIsoDate, todayInParis } from './dates';
import { formatDate, formatDistance, formatPrice, formatScore, plural, priceToInput, scoreColor } from './format';

describe('format', () => {
	it('formats scores and prices the French way', () => {
		expect(formatScore(4.25)).toBe('4,3');
		expect(formatScore(4)).toBe('4,0');
		expect(formatScore(null)).toBe('–');
		expect(formatPrice(650).replace(/\s/g, ' ')).toBe('6,50 €');
		expect(formatPrice(null)).toBe('–');
		expect(priceToInput(650)).toBe('6,50');
		expect(priceToInput(null)).toBe('');
	});
	it('formats dates, distances and plurals', () => {
		expect(formatDate('2026-09-12')).toBe('12 sept. 2026');
		expect(formatDistance(42)).toBe('40 m');
		expect(formatDistance(3)).toBe('10 m');
		expect(formatDistance(1234)).toBe('1,2 km');
		expect(plural(1, 'passage')).toBe('1 passage');
		expect(plural(3, 'passage')).toBe('3 passages');
	});
});

describe('scoreColor', () => {
	it('ramps from brick to blonde and picks a readable ink', () => {
		expect(scoreColor(1)).toEqual({ bg: 'rgb(180 71 59)', fg: '#fff6e8' });
		expect(scoreColor(5)).toEqual({ bg: 'rgb(247 226 127)', fg: '#231a0e' });
		expect(scoreColor(3).bg).toBe('rgb(227 154 52)');
		expect(scoreColor(9)).toEqual(scoreColor(5));
		expect(scoreColor(null).bg).toBe('#5d6b6f');
	});
});

describe('dates', () => {
	it('gives the Paris date, not the UTC one', () => {
		expect(todayInParis(new Date('2026-09-18T22:30:00Z'))).toBe('2026-09-19');
		expect(todayInParis(new Date('2026-01-15T12:00:00Z'))).toBe('2026-01-15');
	});
	it('validates ISO dates', () => {
		expect(isIsoDate('2026-02-28')).toBe(true);
		expect(isIsoDate('2026-02-29')).toBe(false);
		expect(isIsoDate('2024-02-29')).toBe(true);
		expect(isIsoDate('2026-9-1')).toBe(false);
	});
});
