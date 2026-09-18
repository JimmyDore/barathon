import { describe, expect, it } from 'vitest';
import { createStore, openDatabase } from '$lib/server/db';
import type { VisitInput } from '$lib/validation';
import { mergeBarFromForm, moveBarFromForm, parseId, renameBarFromForm, safeNext } from './admin-forms';

function input(p: Partial<VisitInput> = {}): VisitInput {
	return {
		pseudo: 'Jimmy',
		date: '2026-09-12',
		beaute: null,
		emplacement: null,
		terrasse: null,
		choixBieres: null,
		qualiteBiere: null,
		soiree: 4,
		ambiances: [],
		humeur: null,
		prixCents: null,
		commentaire: null,
		...p
	};
}

function setup() {
	const store = createStore(openDatabase(':memory:'));
	const a = store.createVisit(
		{ kind: 'manual', name: 'Chat Noir', address: null, lat: 47.2129, lon: -1.5562 },
		input({ soiree: 2 })
	);
	const b = store.createVisit(
		{
			kind: 'osm',
			sourceId: 'node/1',
			category: 'bar',
			name: 'Le Chat Noir',
			address: 'Rue du Guesclin',
			lat: 47.213,
			lon: -1.5563
		},
		input({ soiree: 4 })
	);
	if (!a.ok || !b.ok) throw new Error('setup');
	store.createVisit({ kind: 'existing', barId: a.bar.id }, input({ pseudo: 'Léa', soiree: 3 }));
	return { store, a: a.bar, b: b.bar };
}

describe('parseId', () => {
	it('accepts positive integers only', () => {
		expect(parseId('12')).toBe(12);
		expect(parseId(' 7 ')).toBe(7);
		for (const bad of ['0', '-1', '1.5', 'abc', '', null, undefined, '1e3', '9'.repeat(20)]) {
			expect(parseId(bad)).toBeNull();
		}
	});
});

describe('safeNext', () => {
	it('keeps internal paths', () => {
		expect(safeNext('/admin/bars/3')).toBe('/admin/bars/3');
		expect(safeNext('/passages/4/modifier?x=1')).toBe('/passages/4/modifier?x=1');
	});

	it('refuses external or odd targets', () => {
		for (const bad of [
			'https://evil.example/',
			'//evil.example/x',
			'/\\evil.example',
			'javascript:alert(1)',
			'admin/bars/3',
			'',
			null,
			undefined
		]) {
			expect(safeNext(bad)).toBeNull();
		}
	});

	it('never sends back to /admin itself', () => {
		expect(safeNext('/admin')).toBeNull();
		expect(safeNext('/admin?suite=/admin')).toBeNull();
	});
});

describe('renameBarFromForm', () => {
	it('renames and sets or clears the address', () => {
		const { store, a } = setup();
		const res = renameBarFromForm(store, a.id, { name: '  Le   Chat  ', address: '3 rue X' });
		expect(res).toMatchObject({ ok: true, bar: { name: 'Le Chat', address: '3 rue X' } });
		const cleared = renameBarFromForm(store, a.id, { name: 'Le Chat', address: '  ' });
		expect(cleared).toMatchObject({ ok: true, bar: { address: null } });
	});

	it('rejects an empty name and an unknown bar', () => {
		const { store, a } = setup();
		expect(renameBarFromForm(store, a.id, { name: '   ' })).toMatchObject({ ok: false, status: 400 });
		expect(store.getBar(a.id)?.name).toBe('Chat Noir');
		expect(renameBarFromForm(store, 999, { name: 'X' })).toMatchObject({ ok: false, status: 404 });
	});
});

describe('moveBarFromForm', () => {
	it('moves the bar', () => {
		const { store, a } = setup();
		const res = moveBarFromForm(store, a.id, { lat: '47.25', lon: '-1.6' });
		expect(res).toMatchObject({ ok: true, bar: { lat: 47.25, lon: -1.6 } });
	});

	it('rejects bad coordinates and unknown bars', () => {
		const { store, a } = setup();
		expect(moveBarFromForm(store, a.id, { lat: '120', lon: '0' })).toMatchObject({ ok: false, status: 400 });
		expect(moveBarFromForm(store, a.id, { lat: '', lon: '' })).toMatchObject({ ok: false, status: 400 });
		expect(moveBarFromForm(store, 999, { lat: '47', lon: '-1' })).toMatchObject({ ok: false, status: 404 });
	});
});

describe('mergeBarFromForm', () => {
	it('moves the visits into the target and deletes the source', () => {
		const { store, a, b } = setup();
		const res = mergeBarFromForm(store, a.id, { into: String(b.id) });
		expect(res).toMatchObject({ ok: true, movedVisits: 2, from: { name: 'Chat Noir' }, into: { id: b.id } });
		expect(store.getBar(a.id)).toBeNull();
		expect(store.listVisitsByBar(b.id)).toHaveLength(3);
		expect(store.getBarSummary(b.id)?.overall).toBe(3); // (2 + 4 + 3) / 3
	});

	it('refuses a missing, identical or unknown target', () => {
		const { store, a } = setup();
		expect(mergeBarFromForm(store, a.id, {})).toMatchObject({ ok: false, status: 400 });
		expect(mergeBarFromForm(store, a.id, { into: String(a.id) })).toMatchObject({ ok: false, status: 400 });
		expect(mergeBarFromForm(store, a.id, { into: '999' })).toMatchObject({ ok: false, status: 404 });
		expect(mergeBarFromForm(store, 999, { into: String(a.id) })).toMatchObject({ ok: false, status: 404 });
		expect(store.listVisitsByBar(a.id)).toHaveLength(2);
	});
});
