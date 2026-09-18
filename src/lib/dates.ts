import { TIMEZONE } from './constants';

/** Date du jour (YYYY-MM-DD) à Paris, quel que soit le fuseau de la machine. */
export function todayInParis(now: Date = new Date()): string {
	// en-CA formate en YYYY-MM-DD.
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: TIMEZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
}

/** Vrai si `s` est une date calendaire valide au format YYYY-MM-DD. */
export function isIsoDate(s: string): boolean {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
	const [y, m, d] = s.split('-').map(Number);
	const date = new Date(Date.UTC(y, m - 1, d));
	return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
