import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { VisitInput } from '$lib/validation';
import { createStore, MIGRATIONS, openDatabase } from './db';

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

const chatNoir = {
	kind: 'osm' as const,
	sourceId: 'node/4009374049',
	category: 'bar' as const,
	name: 'Le Chat Noir',
	address: 'Rue du Guesclin, Nantes',
	lat: 47.2129438,
	lon: -1.556283
};

function freshStore() {
	return createStore(openDatabase(':memory:'));
}

describe('openDatabase', () => {
	it('creates the file, enables WAL and migrates to the latest version', () => {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'barathon-'));
		const file = path.join(dir, 'sub', 'barathon.db');
		const db = openDatabase(file);
		expect(fs.existsSync(file)).toBe(true);
		expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
		expect(db.pragma('user_version', { simple: true })).toBe(MIGRATIONS.length);
		expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
		db.close();
		// Réouverture : migrations idempotentes
		const again = openDatabase(file);
		expect(again.pragma('user_version', { simple: true })).toBe(MIGRATIONS.length);
		again.close();
		fs.rmSync(dir, { recursive: true, force: true });
	});
});

describe('store: visits', () => {
	it('creates an OSM bar with the first visit and returns a token', () => {
		const s = freshStore();
		const res = s.createVisit(chatNoir, input({ ambiances: ['chill'], terrasse: 0, prixCents: 650 }));
		expect(res.ok).toBe(true);
		if (!res.ok) return;
		expect(res.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
		expect(res.bar).toMatchObject({ name: 'Le Chat Noir', source: 'osm', sourceId: 'node/4009374049' });
		expect(res.visit).toMatchObject({ barId: res.bar.id, pseudoKey: 'jimmy', terrasse: 0, score: 4 });
		// le hash du jeton ne sort jamais
		expect(JSON.stringify(res.visit)).not.toMatch(/token/i);
	});

	it('reuses the same OSM bar instead of duplicating it', () => {
		const s = freshStore();
		const a = s.createVisit(chatNoir, input());
		const b = s.createVisit({ ...chatNoir, name: 'Autre nom' }, input({ pseudo: 'Zoé' }));
		expect(a.ok && b.ok && a.bar.id === b.bar.id).toBe(true);
		expect(s.listBarSummaries()).toHaveLength(1);
	});

	it('refuses a visit on an unknown bar id', () => {
		const s = freshStore();
		expect(s.createVisit({ kind: 'existing', barId: 999 }, input())).toEqual({
			ok: false,
			reason: 'bar_not_found'
		});
	});

	it('lets the author (token) or the admin update and delete, nobody else', () => {
		const s = freshStore();
		const res = s.createVisit(chatNoir, input());
		if (!res.ok) throw new Error('create failed');
		const id = res.visit.id;

		expect(s.updateVisit(id, input({ soiree: 1 }), { token: 'wrong' })).toEqual({
			ok: false,
			reason: 'forbidden'
		});
		expect(s.updateVisit(id, input({ soiree: 1 }), { token: null })).toMatchObject({ ok: false });
		const upd = s.updateVisit(id, input({ soiree: 2, commentaire: 'Bof' }), { token: res.token });
		expect(upd.ok && upd.visit.soiree === 2 && upd.visit.updatedAt !== null).toBe(true);
		expect(s.updateVisit(id, input({ soiree: 5 }), { admin: true }).ok).toBe(true);
		expect(s.updateVisit(12345, input(), { admin: true })).toEqual({ ok: false, reason: 'not_found' });

		expect(s.checkVisitAccess(id, { token: res.token })).toBe('ok');
		expect(s.deleteVisit(id, { token: 'nope' })).toEqual({ ok: false, reason: 'forbidden' });
		expect(s.deleteVisit(id, { token: res.token })).toEqual({ ok: true, barId: res.bar.id, barDeleted: true });
		expect(s.getVisit(id)).toBeNull();
		expect(s.getBar(res.bar.id)).toBeNull();
	});

	it('keeps the bar when other visits remain', () => {
		const s = freshStore();
		const a = s.createVisit(chatNoir, input());
		s.createVisit(chatNoir, input({ pseudo: 'Zoé' }));
		if (!a.ok) throw new Error();
		expect(s.deleteVisit(a.visit.id, { admin: true })).toMatchObject({ ok: true, barDeleted: false });
		expect(s.getBar(a.bar.id)).not.toBeNull();
	});

	it('lists visits by bar and by person (accent/case-insensitive), newest first', () => {
		const s = freshStore();
		const a = s.createVisit(chatNoir, input({ pseudo: 'Élodie', date: '2026-09-01' }));
		s.createVisit(chatNoir, input({ pseudo: 'elodie ', date: '2026-09-10' }));
		s.createVisit({ kind: 'manual', name: 'Chez Toto', address: null, lat: 47.3, lon: -1.5 }, input({ pseudo: 'ELODIE' }));
		if (!a.ok) throw new Error();
		expect(s.listVisitsByBar(a.bar.id).map((v) => v.date)).toEqual(['2026-09-10', '2026-09-01']);
		const mine = s.listVisitsByPerson('elodie');
		expect(mine).toHaveLength(3);
		expect(mine.map((v) => v.barName)).toContain('Chez Toto');
		expect(s.listRecentVisits(2)).toHaveLength(2);
	});
});

describe('store: bars', () => {
	it('summarizes bars with scores and sorts them', () => {
		const s = freshStore();
		s.createVisit(chatNoir, input({ soiree: 2 }));
		const manual = s.createVisit(
			{ kind: 'manual', name: 'Chez Toto', address: null, lat: 47.3, lon: -1.5 },
			input({ soiree: 5, choixBieres: 5, prixCents: 500 })
		);
		const list = s.listBarSummaries();
		expect(list.map((b) => b.name)).toEqual(['Chez Toto', 'Le Chat Noir']);
		expect(list[0]).toMatchObject({ overall: 5, avgPriceCents: 500, visitCount: 1, source: 'manual' });
		if (!manual.ok) throw new Error();
		expect(s.getBarSummary(manual.bar.id)?.overall).toBe(5);
		expect(s.getBarSummary(999)).toBeNull();
	});

	it('finds our bars nearby, by OSM id and by name', () => {
		const s = freshStore();
		s.createVisit(chatNoir, input());
		s.createVisit({ kind: 'manual', name: 'Le Café d’à côté', address: null, lat: 47.2131, lon: -1.5562 }, input());
		s.createVisit({ kind: 'manual', name: 'Loin', address: null, lat: 47.3, lon: -1.5 }, input());

		const near = s.barsNearby(47.213, -1.556, 50);
		expect(near.map((b) => b.name)).toEqual(['Le Café d’à côté', 'Le Chat Noir']); // ~19 m puis ~22 m
		expect(near[0].distance).toBeLessThan(30);

		expect(s.findBarBySourceId('node/4009374049')?.name).toBe('Le Chat Noir');
		expect(s.findBarBySourceId('node/1')).toBeNull();
		expect(s.getBarSummariesBySourceIds(['node/1', 'node/4009374049']).map((b) => b.name)).toEqual([
			'Le Chat Noir'
		]);

		expect(s.searchBars('cafe').map((b) => b.name)).toEqual(['Le Café d’à côté']);
		expect(s.searchBars('LE ').map((b) => b.name)).toEqual(['Le Café d’à côté', 'Le Chat Noir']);
		expect(s.searchBars('nantes').map((b) => b.name)).toEqual(['Le Chat Noir']);
		expect(s.searchBars('   ')).toEqual([]);
	});

	it('renames, moves and deletes bars', () => {
		const s = freshStore();
		const res = s.createVisit(chatNoir, input());
		if (!res.ok) throw new Error();
		const id = res.bar.id;
		expect(s.renameBar(id, 'Chat Noir')?.address).toBe('Rue du Guesclin, Nantes');
		expect(s.renameBar(id, 'Chat Noir', null)?.address).toBeNull();
		expect(s.moveBar(id, 47.1, -1.4)).toMatchObject({ lat: 47.1, lon: -1.4 });
		expect(s.moveBar(999, 1, 1)).toBeNull();
		expect(s.deleteBar(id)).toBe(true);
		expect(s.getVisit(res.visit.id)).toBeNull(); // cascade
		expect(s.deleteBar(id)).toBe(false);
	});

	it('merges bar A into bar B and hands over the OSM id', () => {
		const s = freshStore();
		const a = s.createVisit(chatNoir, input({ pseudo: 'A' }));
		s.createVisit(chatNoir, input({ pseudo: 'A2' }));
		const b = s.createVisit({ kind: 'manual', name: 'Chat Noir (manuel)', address: null, lat: 47.21, lon: -1.55 }, input());
		if (!a.ok || !b.ok) throw new Error();

		expect(s.mergeBars(a.bar.id, a.bar.id)).toEqual({ ok: false, reason: 'same_bar' });
		expect(s.mergeBars(a.bar.id, 999)).toEqual({ ok: false, reason: 'not_found' });

		const merged = s.mergeBars(a.bar.id, b.bar.id);
		expect(merged).toMatchObject({ ok: true, movedVisits: 2 });
		expect(s.getBar(a.bar.id)).toBeNull();
		expect(s.listVisitsByBar(b.bar.id)).toHaveLength(3);
		expect(s.getBar(b.bar.id)).toMatchObject({ source: 'osm', sourceId: 'node/4009374049', category: 'bar' });
		// Un nouveau passage via l'id OSM tombe désormais sur B
		const again = s.createVisit(chatNoir, input());
		expect(again.ok && again.bar.id === b.bar.id).toBe(true);
	});
});

describe('store: people', () => {
	it('ranks people by distinct bars then visits', () => {
		const s = freshStore();
		const toto = { kind: 'manual' as const, name: 'Toto', address: null, lat: 47, lon: -1 };
		s.createVisit(chatNoir, input({ pseudo: 'Zoé' }));
		s.createVisit(chatNoir, input({ pseudo: 'zoe' }));
		s.createVisit(chatNoir, input({ pseudo: 'Jim' }));
		s.createVisit(toto, input({ pseudo: 'Jim' }));
		const people = s.listPeople();
		expect(people.map((p) => [p.key, p.barCount, p.visitCount])).toEqual([
			['jim', 2, 2],
			['zoe', 1, 2]
		]);
		expect(s.getPerson('zoe')?.visitCount).toBe(2);
		expect(s.getPerson('nobody')).toBeNull();
	});
});
