import { describe, expect, it } from 'vitest';
import { createStore, openDatabase } from './db';
import { createRateLimiter } from './ratelimit';
import { createVisitFromForm, deleteVisitFromForm, updateVisitFromForm } from './visit-actions';

const today = '2026-09-18';
const osmForm = {
	source: 'osm',
	source_id: 'node/4009374049',
	name: 'Le Chat Noir',
	lat: '47.2129438',
	lon: '-1.556283',
	category: 'bar',
	pseudo: 'Jim',
	soiree: '4',
	beaute: '5'
};

function setup(limit = 20) {
	const store = createStore(openDatabase(':memory:'));
	const limiter = createRateLimiter({ limit, windowMs: 60_000 });
	return { store, limiter, today, ip: '1.2.3.4' };
}

describe('createVisitFromForm', () => {
	it('creates the bar and the visit and returns the token', () => {
		const ctx = setup();
		const out = createVisitFromForm(osmForm, ctx);
		expect(out).toMatchObject({ ok: true, score: 4.5 });
		if (!out.ok) return;
		expect(out.token.length).toBeGreaterThan(40);
		expect(ctx.store.getVisit(out.visitId)?.barId).toBe(out.barId);
	});

	it('pretends to accept but stores nothing when the honeypot is filled', () => {
		const ctx = setup();
		const out = createVisitFromForm({ ...osmForm, site_web: 'http://spam' }, ctx);
		expect(out).toMatchObject({ ok: true, discarded: true, visitId: 0 });
		expect(ctx.store.listBarSummaries()).toHaveLength(0);
	});

	it('returns field errors and a form error', () => {
		const ctx = setup();
		const out = createVisitFromForm({ pseudo: '', soiree: '' }, ctx);
		expect(out.ok).toBe(false);
		if (out.ok) return;
		expect(out.status).toBe(400);
		expect(out.errors.pseudo).toBeTruthy();
		expect(out.errors.soiree).toBeTruthy();
		expect(out.errors.form).toMatch(/bar/);
	});

	it('rate-limits creations per IP', () => {
		const ctx = setup(2);
		expect(createVisitFromForm(osmForm, ctx).ok).toBe(true);
		expect(createVisitFromForm(osmForm, ctx).ok).toBe(true);
		const third = createVisitFromForm(osmForm, ctx);
		expect(third).toMatchObject({ ok: false, status: 429 });
		expect(createVisitFromForm(osmForm, { ...ctx, ip: '5.6.7.8' }).ok).toBe(true);
	});

	it('404s on an unknown bar id', () => {
		const ctx = setup();
		expect(createVisitFromForm({ bar_id: '99', pseudo: 'Jim', soiree: '3' }, ctx)).toMatchObject({
			ok: false,
			status: 404
		});
	});
});

describe('update / delete from form', () => {
	it('requires the author token unless admin', () => {
		const ctx = setup();
		const created = createVisitFromForm(osmForm, ctx);
		if (!created.ok) throw new Error();
		const id = created.visitId;

		expect(updateVisitFromForm(id, { pseudo: 'Jim', soiree: '1' }, { ...ctx, admin: false })).toMatchObject({
			ok: false,
			status: 403
		});
		expect(
			updateVisitFromForm(id, { pseudo: 'Jim', soiree: '1', token: created.token }, { ...ctx, admin: false })
		).toMatchObject({ ok: true, score: 1 });
		expect(
			updateVisitFromForm(id, { pseudo: '', soiree: '1', token: created.token }, { ...ctx, admin: false })
		).toMatchObject({ ok: false, status: 400 });
		expect(updateVisitFromForm(id, { pseudo: 'Admin', soiree: '2' }, { ...ctx, admin: true }).ok).toBe(true);

		expect(deleteVisitFromForm(id, { token: 'nope' }, { ...ctx, admin: false })).toMatchObject({ status: 403 });
		expect(deleteVisitFromForm(id, { token: created.token }, { ...ctx, admin: false })).toMatchObject({
			ok: true,
			barDeleted: true
		});
		expect(deleteVisitFromForm(id, {}, { ...ctx, admin: true })).toMatchObject({ status: 404 });
	});
});
