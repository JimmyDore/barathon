/**
 * Chargement de MapLibre (navigateur uniquement) et des styles OpenFreeMap.
 * Utilisé par `MapView.svelte` ; les pages n'ont normalement pas besoin d'y toucher.
 */
import type { StyleSpecification } from 'maplibre-gl';

/** Style sombre d'OpenFreeMap, repeint en ardoise (cf. `slateStyle`). */
export const DARK_STYLE_URL = 'https://tiles.openfreemap.org/styles/dark';
/** Style clair d'OpenFreeMap. */
export const LIGHT_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';

export type MapTheme = 'dark' | 'light';

type MapLibre = typeof import('maplibre-gl');
let maplibrePromise: Promise<MapLibre> | null = null;

/** Import dynamique de maplibre-gl + URL de son worker (bundlé par Vite). */
export function loadMaplibre(): Promise<MapLibre> {
	maplibrePromise ??= Promise.all([
		import('maplibre-gl'),
		import('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url')
	]).then(([ml, worker]) => {
		ml.setWorkerUrl(worker.default);
		return ml;
	});
	return maplibrePromise;
}

export function currentTheme(): MapTheme {
	return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches
		? 'light'
		: 'dark';
}

const styleCache = new Map<MapTheme, Promise<StyleSpecification | string>>();

/**
 * Style prêt à passer à `new Map({ style })`. En sombre, repeint en ardoise.
 * Si le JSON ne se charge pas, renvoie l'URL brute (MapLibre réessaiera lui-même).
 */
export function loadMapStyle(theme: MapTheme): Promise<StyleSpecification | string> {
	let p = styleCache.get(theme);
	if (!p) {
		const url = theme === 'dark' ? DARK_STYLE_URL : LIGHT_STYLE_URL;
		p = fetch(url)
			.then((r) => {
				if (!r.ok) throw new Error(String(r.status));
				return r.json() as Promise<StyleSpecification>;
			})
			.then((style) => (theme === 'dark' ? slateStyle(style) : lightStyle(style)))
			.catch(() => {
				styleCache.delete(theme);
				return url;
			});
		styleCache.set(theme, p);
	}
	return p;
}

/* ---------- Palette « ardoise » pour le style dark d'OpenFreeMap ---------- */

const SLATE = {
	background: '#1b2326',
	water: '#121a1e',
	residential: '#212a2e',
	park: '#1e2a27',
	building: '#182024',
	buildingOutline: '#263136',
	roadMinor: '#2a363b',
	roadMajor: '#34434a',
	roadCasing: 'rgba(78, 94, 101, 0.75)',
	path: '#2f3b40',
	rail: '#2a3439',
	label: '#8c9a99',
	labelHalo: '#1b2326',
	waterLabel: '#4d6770'
};

type Paint = Record<string, unknown>;

/** Surcharges de peinture par id de couche (les autres propriétés sont conservées). */
const SLATE_PAINT: Record<string, Paint> = {
	background: { 'background-color': SLATE.background },
	water: { 'fill-color': SLATE.water },
	waterway: { 'line-color': SLATE.water },
	landcover_ice_shelf: { 'fill-color': SLATE.background },
	landuse_residential: { 'fill-color': SLATE.residential, 'fill-opacity': 0.6 },
	// le motif « wood-pattern » n'existe pas dans le sprite OpenFreeMap : on le retire
	landcover_wood: { 'fill-color': SLATE.park, 'fill-pattern': null },
	landuse_park: { 'fill-color': SLATE.park },
	building: { 'fill-color': SLATE.building, 'fill-outline-color': SLATE.buildingOutline },
	road_area_pier: { 'fill-color': SLATE.background },
	road_pier: { 'line-color': SLATE.background },
	highway_path: { 'line-color': SLATE.path },
	highway_minor: { 'line-color': SLATE.roadMinor },
	highway_major_casing: { 'line-color': SLATE.roadCasing },
	highway_major_inner: { 'line-color': SLATE.roadMajor },
	highway_major_subtle: { 'line-color': SLATE.roadMinor },
	highway_motorway_casing: { 'line-color': SLATE.roadCasing },
	highway_motorway_inner: { 'line-color': SLATE.roadMajor },
	highway_motorway_subtle: { 'line-color': SLATE.roadMinor },
	railway_transit: { 'line-color': SLATE.rail },
	railway_minor: { 'line-color': SLATE.rail },
	railway: { 'line-color': SLATE.rail },
	railway_transit_dashline: { 'line-color': SLATE.background },
	railway_minor_dashline: { 'line-color': SLATE.background },
	railway_dashline: { 'line-color': SLATE.background },
	water_name: { 'text-color': SLATE.waterLabel, 'text-halo-color': SLATE.water }
};

function withPaint(style: StyleSpecification, override: (id: string, type: string) => Paint | undefined) {
	return {
		...style,
		layers: style.layers.map((layer) => {
			const extra = override(layer.id, layer.type);
			if (!extra) return layer;
			const paint: Paint = { ...((layer as { paint?: Paint }).paint ?? {}), ...extra };
			// `null` = retirer la propriété
			for (const k of Object.keys(paint)) if (paint[k] === null) delete paint[k];
			return { ...layer, paint };
		})
	} as StyleSpecification;
}

export function slateStyle(style: StyleSpecification): StyleSpecification {
	return withPaint(style, (id, type) => {
		if (SLATE_PAINT[id]) return SLATE_PAINT[id];
		if (type === 'symbol' && (id.startsWith('place_') || id.startsWith('highway_name')))
			return { 'text-color': SLATE.label, 'text-halo-color': SLATE.labelHalo, 'text-halo-width': 1.2 };
		return undefined;
	});
}

export function lightStyle(style: StyleSpecification): StyleSpecification {
	return withPaint(style, (id) => (id === 'background' ? { 'background-color': '#eceee9' } : undefined));
}
