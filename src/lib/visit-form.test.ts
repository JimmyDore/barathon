import { describe, expect, it } from 'vitest';
import { parseVisitForm, visitToFormValues } from './validation';
import { emptyVisitState, visitStateFromValues, visitValuesFromForm } from './visit-form';

const today = '2026-09-18';

describe('emptyVisitState', () => {
	it('starts empty, dated today, with the remembered pseudo', () => {
		expect(emptyVisitState(today, 'Jim')).toEqual({
			pseudo: 'Jim',
			date: today,
			beaute: null,
			emplacement: null,
			terrasse: null,
			choixBieres: null,
			qualiteBiere: null,
			soiree: null,
			ambiances: [],
			humeur: null,
			prix: '',
			commentaire: ''
		});
	});
});

describe('visitStateFromValues', () => {
	it('reads ratings, "pas de terrasse", ambiances and text fields', () => {
		const state = visitStateFromValues(
			{
				pseudo: 'Léa',
				date: '2026-09-01',
				beaute: '4',
				terrasse: 'none',
				choix_bieres: '2',
				qualite_biere: '',
				soiree: '5',
				ambiances: ['chill', 'cosy'],
				humeur: '3',
				prix: '6,50',
				commentaire: 'Top'
			},
			{ today }
		);
		expect(state).toMatchObject({
			pseudo: 'Léa',
			date: '2026-09-01',
			beaute: 4,
			emplacement: null,
			terrasse: 0,
			choixBieres: 2,
			qualiteBiere: null,
			soiree: 5,
			ambiances: ['chill', 'cosy'],
			humeur: 3,
			prix: '6,50',
			commentaire: 'Top'
		});
	});

	it('turns invalid ratings back into "pas testé" and drops unknown ambiances', () => {
		const state = visitStateFromValues(
			{ beaute: '9', soiree: 'abc', terrasse: '7', ambiances: ['chill', 'rave', 'chill'] },
			{ today }
		);
		expect(state.beaute).toBeNull();
		expect(state.soiree).toBeNull();
		expect(state.terrasse).toBeNull();
		expect(state.ambiances).toEqual(['chill']);
	});

	it('accepts a single ambiance given as a string', () => {
		expect(visitStateFromValues({ ambiances: 'festif' }, { today }).ambiances).toEqual(['festif']);
	});

	it('keeps a pseudo the user emptied, but falls back when the field is missing', () => {
		expect(visitStateFromValues({ pseudo: '' }, { today, pseudo: 'Jim' }).pseudo).toBe('');
		expect(visitStateFromValues({}, { today, pseudo: 'Jim' }).pseudo).toBe('Jim');
	});

	it('defaults an empty date to today', () => {
		expect(visitStateFromValues({ date: '' }, { today }).date).toBe(today);
	});

	it('round-trips an existing visit through visitToFormValues', () => {
		const parsed = parseVisitForm(
			{ pseudo: 'Jim', date: '2026-09-10', terrasse: 'none', soiree: '4', ambiances: ['jeux'], prix: '7' },
			{ today }
		);
		expect(parsed.ok).toBe(true);
		if (!parsed.ok) return;
		const state = visitStateFromValues(visitToFormValues(parsed.value), { today });
		expect(state).toMatchObject({ pseudo: 'Jim', date: '2026-09-10', terrasse: 0, soiree: 4, prix: '7,00' });
		expect(state.ambiances).toEqual(['jeux']);
	});
});

describe('visitValuesFromForm', () => {
	it('echoes only the visit fields, never the token, honeypot or bar fields', () => {
		const fd = new FormData();
		fd.set('pseudo', 'Jim');
		fd.set('soiree', '');
		fd.append('ambiances', 'chill');
		fd.append('ambiances', 'cosy');
		fd.set('token', 'secret');
		fd.set('site_web', 'spam');
		fd.set('bar_id', '3');
		const values = visitValuesFromForm(fd);
		expect(values).toEqual({ pseudo: 'Jim', soiree: '', ambiances: ['chill', 'cosy'] });
	});

	it('truncates very long values', () => {
		const values = visitValuesFromForm({ commentaire: 'x'.repeat(5000) });
		expect((values.commentaire as string).length).toBe(1000);
	});

	it('gives back what the user typed after a failed submit', () => {
		const fd = new FormData();
		fd.set('pseudo', 'Jim');
		fd.set('beaute', '3');
		fd.set('prix', '6,5O');
		const state = visitStateFromValues(visitValuesFromForm(fd), { today });
		expect(state).toMatchObject({ pseudo: 'Jim', beaute: 3, prix: '6,5O', ambiances: [] });
	});
});
