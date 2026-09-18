import { describe, expect, it } from 'vitest';
import {
	HONEYPOT_FIELD,
	isHoneypotFilled,
	parseBarChoice,
	parseCoordinates,
	parsePriceCents,
	parseRating,
	parseVisitForm,
	visitToFormValues
} from './validation';

const today = '2026-09-18';

function fd(entries: [string, string][]): FormData {
	const f = new FormData();
	for (const [k, v] of entries) f.append(k, v);
	return f;
}

describe('parseVisitForm', () => {
	it('accepts a minimal visit (pseudo + soirée) and defaults the date to today', () => {
		const res = parseVisitForm(fd([['pseudo', 'Jimmy'], ['soiree', '4']]), { today });
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.value).toEqual({
			pseudo: 'Jimmy',
			date: today,
			beaute: null,
			emplacement: null,
			terrasse: null,
			choixBieres: null,
			qualiteBiere: null,
			soiree: 4,
			ambiances: [],
			humeur: null,
			prixCents: null,
			commentaire: null
		});
	});

	it('parses a full FormData', () => {
		const res = parseVisitForm(
			fd([
				['pseudo', '  Élodie  '],
				['date', '2026-09-12'],
				['beaute', '4'],
				['emplacement', '3'],
				['terrasse', 'none'],
				['choix_bieres', '5'],
				['qualite_biere', '2'],
				['soiree', '5'],
				['ambiances', 'chill'],
				['ambiances', 'cosy'],
				['ambiances', 'chill'],
				['humeur', '4'],
				['prix', '6,50 €'],
				['commentaire', '  Super IPA\r\nmais bruyant  ']
			]),
			{ today }
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.value.pseudo).toBe('Élodie');
		expect(res.value.date).toBe('2026-09-12');
		expect(res.value.terrasse).toBe(0);
		expect(res.value.choixBieres).toBe(5);
		expect(res.value.qualiteBiere).toBe(2);
		expect(res.value.ambiances).toEqual(['chill', 'cosy']);
		expect(res.value.humeur).toBe(4);
		expect(res.value.prixCents).toBe(650);
		expect(res.value.commentaire).toBe('Super IPA\nmais bruyant');
	});

	it('accepts a plain object with numbers and arrays', () => {
		const res = parseVisitForm(
			{ pseudo: 'Jim', soiree: 3, terrasse: 4, ambiances: ['jeux', 'match'], prix: '7' },
			{ today }
		);
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.value.terrasse).toBe(4);
		expect(res.value.ambiances).toEqual(['jeux', 'match']);
		expect(res.value.prixCents).toBe(700);
	});

	it('requires a pseudo and the soirée', () => {
		const res = parseVisitForm(fd([['pseudo', '   ']]), { today });
		expect(res.ok).toBe(false);
		if (res.ok) return;
		expect(res.errors.pseudo).toMatch(/qui tu es/);
		expect(res.errors.soiree).toMatch(/soirée/);
	});

	it('rejects out-of-range ratings, unknown ambiances and bad moods', () => {
		const res = parseVisitForm(
			fd([
				['pseudo', 'Jim'],
				['soiree', '6'],
				['beaute', '0'],
				['terrasse', 'yes'],
				['ambiances', 'rave'],
				['humeur', '9']
			]),
			{ today }
		);
		expect(res.ok).toBe(false);
		if (res.ok) return;
		expect(Object.keys(res.errors).sort()).toEqual(
			['ambiances', 'beaute', 'humeur', 'soiree', 'terrasse'].sort()
		);
	});

	it('rejects future, impossible and very old dates', () => {
		const at = (date: string) => parseVisitForm({ pseudo: 'Jim', soiree: 3, date }, { today });
		expect(at('2026-09-19').ok).toBe(false);
		expect(at('2026-02-30').ok).toBe(false);
		expect(at('1999-12-31').ok).toBe(false);
		expect(at('18/09/2026').ok).toBe(false);
		expect(at(today).ok).toBe(true);
	});

	it('limits the pseudo and the comment length', () => {
		const res = parseVisitForm(
			{ pseudo: 'x'.repeat(41), soiree: 3, commentaire: 'y'.repeat(281) },
			{ today }
		);
		expect(res.ok).toBe(false);
		if (res.ok) return;
		expect(res.errors.pseudo).toMatch(/40/);
		expect(res.errors.commentaire).toMatch(/281/);
		expect(parseVisitForm({ pseudo: 'Jim', soiree: 3, commentaire: 'y'.repeat(280) }, { today }).ok).toBe(
			true
		);
	});

	it('bounds the pint price', () => {
		const at = (prix: string) => parseVisitForm({ pseudo: 'Jim', soiree: 3, prix }, { today });
		expect(at('0,20').ok).toBe(false);
		expect(at('51').ok).toBe(false);
		expect(at('abc').ok).toBe(false);
		expect(at('0,50').ok).toBe(true);
		expect(at('').ok).toBe(true);
	});

	it('round-trips through visitToFormValues', () => {
		const first = parseVisitForm(
			{ pseudo: 'Jim', soiree: 3, terrasse: 'none', prix: '6.5', ambiances: ['date'], humeur: 2 },
			{ today }
		);
		expect(first.ok).toBe(true);
		if (!first.ok) return;
		const values = visitToFormValues(first.value);
		expect(values.terrasse).toBe('none');
		expect(values.prix).toBe('6,50');
		const second = parseVisitForm(values, { today });
		expect(second).toEqual(first);
	});
});

describe('parseRating / parsePriceCents', () => {
	it('treats empty as "pas testé"', () => {
		expect(parseRating('')).toBeNull();
		expect(parseRating(null)).toBeNull();
		expect(parseRating(' 3 ')).toBe(3);
		expect(typeof parseRating('3.5')).toBe('symbol');
	});
	it('reads French and English decimals', () => {
		expect(parsePriceCents('6,5')).toBe(650);
		expect(parsePriceCents('6.50')).toBe(650);
		expect(parsePriceCents(' 12 € ')).toBe(1200);
		expect(parsePriceCents('')).toBeNull();
		expect(typeof parsePriceCents('6,555')).toBe('symbol');
	});
});

describe('honeypot', () => {
	it('detects a filled trap field', () => {
		expect(isHoneypotFilled(fd([[HONEYPOT_FIELD, 'http://spam']]))).toBe(true);
		expect(isHoneypotFilled(fd([[HONEYPOT_FIELD, '']]))).toBe(false);
		expect(isHoneypotFilled({})).toBe(false);
	});
});

describe('parseBarChoice', () => {
	it('reads an existing bar id', () => {
		expect(parseBarChoice({ bar_id: '12' })).toEqual({
			ok: true,
			value: { kind: 'existing', barId: 12 }
		});
		expect(parseBarChoice({ bar_id: 'abc' }).ok).toBe(false);
		expect(parseBarChoice({ bar_id: '9'.repeat(40) }).ok).toBe(false);
	});

	it('reads an OSM place', () => {
		const res = parseBarChoice({
			source: 'osm',
			source_id: 'node/4009374049',
			name: ' Le Chat Noir ',
			address: 'Rue du Guesclin, Nantes',
			lat: '47.2129438',
			lon: '-1.556283',
			category: 'bar'
		});
		expect(res).toEqual({
			ok: true,
			value: {
				kind: 'osm',
				sourceId: 'node/4009374049',
				category: 'bar',
				name: 'Le Chat Noir',
				address: 'Rue du Guesclin, Nantes',
				lat: 47.2129438,
				lon: -1.556283
			}
		});
	});

	it('rejects a malformed OSM id', () => {
		const res = parseBarChoice({ source: 'osm', source_id: '123', name: 'X', lat: 1, lon: 1 });
		expect(res.ok).toBe(false);
		// Un identifiant démesuré ne finit pas en base.
		const long = parseBarChoice({ source: 'osm', source_id: `node/${'1'.repeat(5000)}`, name: 'X', lat: 1, lon: 1 });
		expect(long.ok).toBe(false);
	});

	it('reads a manual bar and requires a name and a position', () => {
		expect(parseBarChoice({ source: 'manual', name: 'Chez Toto', lat: 47.2, lon: -1.5 })).toEqual({
			ok: true,
			value: { kind: 'manual', name: 'Chez Toto', address: null, lat: 47.2, lon: -1.5 }
		});
		expect(parseBarChoice({ source: 'manual', name: '', lat: 47.2, lon: -1.5 }).ok).toBe(false);
		expect(parseBarChoice({ source: 'manual', name: 'X', lat: '', lon: -1.5 }).ok).toBe(false);
		expect(parseBarChoice({}).ok).toBe(false);
	});

	it('validates coordinates', () => {
		expect(parseCoordinates('91', '0').ok).toBe(false);
		expect(parseCoordinates('0', '181').ok).toBe(false);
		expect(parseCoordinates('47.2', '-1.5')).toEqual({ ok: true, value: { lat: 47.2, lon: -1.5 } });
	});
});
