import { describe, expect, it } from 'vitest';
import { summarizeVisits } from '$lib/stats';
import type { BarSummary } from '$lib/types';
import type { VisitInput } from '$lib/validation';
import { GEO } from '$lib/constants';
import {
	DEFAULT_ZONE,
	NO_FILTERS,
	countActiveFilters,
	filterBars,
	fitView,
	homeHref,
	isInBounds,
	normalizeAmbiances,
	parseFilters,
	parsePriceParam,
	parseView,
	priceRange,
	priceToSlider,
	rankBars,
	sameFilters,
	sliderToPrice,
	toHomeBar,
	toScreen,
	viewBounds,
	type HomeBar
} from './home';

function bar(id: number, over: Partial<HomeBar> = {}): HomeBar {
	return {
		id,
		name: `Bar ${id}`,
		address: null,
		lat: 47.2,
		lon: -1.55,
		overall: 3,
		blocks: { lieu: 3, biere: 3, moment: 3 },
		terrace: null,
		ambiances: [],
		avgPriceCents: null,
		visitCount: 1,
		...over
	};
}

const qs = (s: string) => new URLSearchParams(s);

describe('toHomeBar', () => {
	it('keeps what the home page needs from a summary', () => {
		const visit: VisitInput = {
			pseudo: 'Jim',
			date: '2026-09-12',
			beaute: 4,
			emplacement: null,
			terrasse: 5,
			choixBieres: 3,
			qualiteBiere: null,
			soiree: 5,
			ambiances: ['cosy', 'chill'],
			humeur: 5,
			prixCents: 650,
			commentaire: null
		};
		const summary: BarSummary = {
			id: 7,
			name: 'Le Nid',
			address: 'Nantes',
			lat: 47.21,
			lon: -1.55,
			source: 'osm',
			sourceId: 'node/1',
			category: 'bar',
			createdAt: '2026-09-12T20:00:00Z',
			...summarizeVisits([visit, { ...visit, ambiances: ['chill'], prixCents: 750, terrasse: null }])
		};
		const home = toHomeBar(summary);
		expect(home).toMatchObject({
			id: 7,
			name: 'Le Nid',
			terrace: 'oui',
			ambiances: ['chill', 'cosy'],
			avgPriceCents: 700,
			visitCount: 2,
			blocks: { lieu: 4.5, biere: 3, moment: 5 }
		});
		expect(home.overall).toBeCloseTo(4.1667, 3);
		expect(home).not.toHaveProperty('score');
	});
});

describe('URL ⇄ vue et filtres', () => {
	it('reads the view, map by default', () => {
		expect(parseView(qs(''))).toBe('carte');
		expect(parseView(qs('vue=classement'))).toBe('classement');
		expect(parseView(qs('vue=nimporte'))).toBe('carte');
	});

	it('reads filters and ignores junk', () => {
		expect(parseFilters(qs(''))).toEqual(NO_FILTERS);
		expect(parseFilters(qs('terrasse=oui&ambiances=cosy,chill,nope&prix_max=6.5'))).toEqual({
			terrace: true,
			ambiances: ['chill', 'cosy'],
			maxPriceCents: 650
		});
		expect(parseFilters(qs('terrasse=non&ambiances=&prix_max=abc'))).toEqual(NO_FILTERS);
		// ambiances répétées ou séparées par des virgules
		expect(parseFilters(qs('ambiances=match&ambiances=jeux,match')).ambiances).toEqual(['match', 'jeux']);
	});

	it('parses prices in euros with a dot or a comma', () => {
		expect(parsePriceParam('7')).toBe(700);
		expect(parsePriceParam('6,5')).toBe(650);
		expect(parsePriceParam(' 6.45 ')).toBe(645);
		expect(parsePriceParam('0')).toBeNull();
		expect(parsePriceParam('-3')).toBeNull();
		expect(parsePriceParam('')).toBeNull();
		expect(parsePriceParam(null)).toBeNull();
	});

	it('builds short, stable, shareable links', () => {
		expect(homeHref('carte', NO_FILTERS)).toBe('/');
		expect(homeHref('classement', NO_FILTERS)).toBe('/?vue=classement');
		const href = homeHref('classement', { terrace: true, ambiances: ['cosy', 'chill'], maxPriceCents: 650 });
		expect(href).toBe('/?vue=classement&terrasse=oui&ambiances=chill,cosy&prix_max=6.5');
		expect(homeHref('carte', { ...NO_FILTERS, maxPriceCents: 700 })).toBe('/?prix_max=7');
	});

	it('round-trips through the URL', () => {
		const filters = { terrace: true, ambiances: normalizeAmbiances(['jeux', 'date']), maxPriceCents: 550 };
		const url = new URL(homeHref('classement', filters), 'http://x');
		expect(parseView(url.searchParams)).toBe('classement');
		expect(parseFilters(url.searchParams)).toEqual(filters);
	});

	it('counts and compares filters', () => {
		expect(countActiveFilters(NO_FILTERS)).toBe(0);
		expect(countActiveFilters({ terrace: true, ambiances: ['chill', 'cosy'], maxPriceCents: 600 })).toBe(4);
		expect(sameFilters({ ...NO_FILTERS, ambiances: ['cosy', 'chill'] }, { ...NO_FILTERS, ambiances: ['chill', 'cosy'] })).toBe(true);
		expect(sameFilters(NO_FILTERS, { ...NO_FILTERS, terrace: true })).toBe(false);
	});
});

describe('filterBars', () => {
	const bars = [
		bar(1, { terrace: 'oui', ambiances: ['chill', 'cosy'], avgPriceCents: 600 }),
		bar(2, { terrace: 'non', ambiances: ['festif'], avgPriceCents: 500 }),
		bar(3, { terrace: null, ambiances: ['chill'], avgPriceCents: null }),
		bar(4, { terrace: 'oui', ambiances: ['chill'], avgPriceCents: 750 })
	];
	const ids = (list: HomeBar[]) => list.map((b) => b.id);

	it('keeps everything without filters', () => {
		expect(ids(filterBars(bars, NO_FILTERS))).toEqual([1, 2, 3, 4]);
	});
	it('terrace = only bars known to have one', () => {
		expect(ids(filterBars(bars, { ...NO_FILTERS, terrace: true }))).toEqual([1, 4]);
	});
	it('ambiances = all of the chosen ones', () => {
		expect(ids(filterBars(bars, { ...NO_FILTERS, ambiances: ['chill'] }))).toEqual([1, 3, 4]);
		expect(ids(filterBars(bars, { ...NO_FILTERS, ambiances: ['chill', 'cosy'] }))).toEqual([1]);
	});
	it('max price is inclusive and drops bars without a price', () => {
		expect(ids(filterBars(bars, { ...NO_FILTERS, maxPriceCents: 600 }))).toEqual([1, 2]);
	});
	it('combines filters', () => {
		expect(ids(filterBars(bars, { terrace: true, ambiances: ['chill'], maxPriceCents: 700 }))).toEqual([1]);
	});
});

describe('rankBars', () => {
	it('sorts by score, then visits, then name; unrated last', () => {
		const ranked = rankBars([
			bar(1, { overall: null, name: 'A' }),
			bar(2, { overall: 3.2, visitCount: 1, name: 'Zinc' }),
			bar(3, { overall: 4.6 }),
			bar(4, { overall: 3.2, visitCount: 4, name: 'Zèbre' }),
			bar(5, { overall: 3.2, visitCount: 1, name: 'Écume' })
		]);
		expect(ranked.map((b) => b.id)).toEqual([3, 4, 5, 2, 1]);
	});
	it('does not mutate its input', () => {
		const input = [bar(1, { overall: 1 }), bar(2, { overall: 5 })];
		rankBars(input);
		expect(input.map((b) => b.id)).toEqual([1, 2]);
	});
});

describe('prix max slider', () => {
	it('snaps the range to half euros', () => {
		const range = priceRange([bar(1, { avgPriceCents: 480 }), bar(2, { avgPriceCents: 720 }), bar(3)]);
		expect(range).toEqual({ min: 450, max: 750, step: 50 });
	});
	it('widens a single price so the slider can move', () => {
		expect(priceRange([bar(1, { avgPriceCents: 600 })])).toEqual({ min: 550, max: 600, step: 50 });
	});
	it('is null without any price', () => {
		expect(priceRange([bar(1)])).toBeNull();
	});
	it('maps the far right to « peu importe »', () => {
		const range = { min: 450, max: 750, step: 50 };
		expect(priceToSlider(null, range)).toBe(800);
		expect(sliderToPrice(800, range)).toBeNull();
		expect(sliderToPrice(600, range)).toBe(600);
		expect(priceToSlider(600, range)).toBe(600);
		// valeur d'URL hors bornes : curseur calé au bord
		expect(priceToSlider(300, range)).toBe(450);
		expect(priceToSlider(900, range)).toBe(750);
	});
});

describe('viewBounds', () => {
	it('covers the whole world at zoom 0 on 512 px', () => {
		const b = viewBounds({ lat: 0, lon: 0 }, 0, 512, 512);
		expect(b.west).toBeCloseTo(-180);
		expect(b.east).toBeCloseTo(180);
		expect(b.north).toBeCloseTo(85.0511, 3);
		expect(b.south).toBeCloseTo(-85.0511, 3);
	});
	it('tells whether a bar is on screen', () => {
		// Nantes, zoom 15, écran de téléphone : ~1 km de large
		const b = viewBounds({ lat: 47.2184, lon: -1.5536 }, 15, 390, 780);
		expect(isInBounds({ lat: 47.2186, lon: -1.554 }, b)).toBe(true);
		expect(isInBounds({ lat: 46.6705, lon: -1.426 }, b)).toBe(false); // La Roche-sur-Yon
		expect(b.east - b.west).toBeGreaterThan(0.005);
		expect(b.east - b.west).toBeLessThan(0.02);
	});
	it('projects a point to screen pixels', () => {
		const center = { lat: 47.2184, lon: -1.5536 };
		expect(toScreen(center, center, 15, 390, 780)).toEqual({ x: 195, y: 390 });
		const north = toScreen({ lat: 47.2284, lon: -1.5536 }, center, 15, 390, 780);
		expect(north.x).toBeCloseTo(195);
		expect(north.y).toBeLessThan(390);
		const b = viewBounds(center, 15, 390, 780);
		const corner = toScreen({ lat: b.south, lon: b.east }, center, 15, 390, 780);
		expect(corner.x).toBeCloseTo(390, 3);
		expect(corner.y).toBeCloseTo(780, 3);
	});
	it('fits points inside the free part of the map', () => {
		const nantes = { lat: 47.2184, lon: -1.5536 };
		const laRoche = { lat: 46.6705, lon: -1.426 };
		const pad = { top: 120, right: 40, bottom: 110, left: 40 };
		const view = fitView([nantes, laRoche], 390, 788, pad, 15)!;
		for (const p of [nantes, laRoche]) {
			const { x, y } = toScreen(p, view.center, view.zoom, 390, 788);
			expect(x).toBeGreaterThanOrEqual(pad.left - 0.5);
			expect(x).toBeLessThanOrEqual(390 - pad.right + 0.5);
			expect(y).toBeGreaterThanOrEqual(pad.top - 0.5);
			expect(y).toBeLessThanOrEqual(788 - pad.bottom + 0.5);
		}
		// l'axe qui contraint est rempli (nord-sud ici)
		const top = toScreen(nantes, view.center, view.zoom, 390, 788).y;
		const bottom = toScreen(laRoche, view.center, view.zoom, 390, 788).y;
		expect(top).toBeCloseTo(pad.top, 3);
		expect(bottom).toBeCloseTo(788 - pad.bottom, 3);
	});
	it('caps the zoom for a single point and centers it in the free area', () => {
		const p = { lat: 47.2, lon: -1.55 };
		const view = fitView([p], 390, 788, { top: 120, right: 0, bottom: 100, left: 0 }, 15)!;
		expect(view.zoom).toBe(15);
		expect(toScreen(p, view.center, 15, 390, 788).y).toBeCloseTo(120 + (788 - 220) / 2, 3);
		expect(fitView([], 390, 788, { top: 0, right: 0, bottom: 0, left: 0 }, 15)).toBeNull();
	});
	it('default zone is centered on GEO.defaultCenter', () => {
		const view = fitView(DEFAULT_ZONE, 390, 788, { top: 0, right: 0, bottom: 0, left: 0 }, 11)!;
		expect(Math.abs(view.center.lat - GEO.defaultCenter.lat)).toBeLessThan(0.05);
		expect(Math.abs(view.center.lon - GEO.defaultCenter.lon)).toBeLessThan(0.05);
		expect(view.zoom).toBeGreaterThan(8.5);
		expect(view.zoom).toBeLessThan(9.5);
	});
});
