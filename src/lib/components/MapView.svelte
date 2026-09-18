<!--
  Carte MapLibre + tuiles OpenFreeMap (ardoise en sombre, positron en clair, suit prefers-color-scheme).
  Chargée côté navigateur seulement ; donne-lui une hauteur (classe ou style du parent).

  - `markers` : pastilles colorées selon la note ; clic → `onmarkerclick(marker)`.
  - `pin` (bindable) : épingle ambre déplaçable ; `onpinchange` à chaque dépôt.
  - `locate` : bouton de géolocalisation + centrage sur l'utilisateur au chargement.
  - Méthodes (via bind:this) : flyTo(point, zoom?), fitTo(points), getCenter().
  Mention « © OpenStreetMap contributors » toujours visible.

  Usage :
    <MapView {markers} locate onmarkerclick={(m) => (selected = m.id)} class="h-full" />
    <MapView center={pos} zoom={17} bind:pin />
-->
<script lang="ts" module>
	export interface MapMarker {
		id: string | number;
		lat: number;
		lon: number;
		/** Note affichée dans la pastille (null = pas encore noté). */
		score?: number | null;
		/** Nom du bar (infobulle + lecteurs d'écran). */
		title?: string;
	}
</script>

<script lang="ts">
	import 'maplibre-gl/dist/maplibre-gl.css';
	import { onMount } from 'svelte';
	import type { GeolocateControl, Map as MlMap, Marker as MlMarker } from 'maplibre-gl';
	import { currentTheme, loadMaplibre, loadMapStyle } from '$lib/client/map';
	import { GEO } from '$lib/constants';
	import { formatScore, scoreColor } from '$lib/format';
	import type { LatLon } from '$lib/geo/distance';

	interface Props {
		/** Centre initial (défaut : Nantes – La Roche-sur-Yon). */
		center?: LatLon;
		/** Zoom initial (défaut : 9). */
		zoom?: number;
		markers?: MapMarker[];
		/** Marqueur mis en avant. */
		selectedId?: string | number | null;
		onmarkerclick?: (marker: MapMarker) => void;
		/** Épingle déplaçable (null = pas d'épingle). Bindable. */
		pin?: LatLon | null;
		/** L'épingle peut-elle être déplacée ? (défaut : oui) */
		pinDraggable?: boolean;
		onpinchange?: (pos: LatLon) => void;
		/** Bouton « me localiser » + centrage auto sur l'utilisateur au chargement. */
		locate?: boolean;
		onlocate?: (pos: LatLon) => void;
		onlocateerror?: () => void;
		/** Clic sur le fond de carte (hors marqueur). */
		onmapclick?: (pos: LatLon) => void;
		/** Fin de déplacement/zoom. */
		onmoveend?: (center: LatLon, zoom: number) => void;
		onready?: () => void;
		/** Libellé accessible de la carte. */
		label?: string;
		class?: string;
	}

	let {
		center = GEO.defaultCenter,
		zoom = GEO.defaultZoom,
		markers = [],
		selectedId = null,
		onmarkerclick,
		pin = $bindable(null),
		pinDraggable = true,
		onpinchange,
		locate = false,
		onlocate,
		onlocateerror,
		onmapclick,
		onmoveend,
		onready,
		label = 'Carte des bars',
		class: className = ''
	}: Props = $props();

	let container: HTMLDivElement;
	let map = $state<MlMap | null>(null);
	let ml: typeof import('maplibre-gl') | null = null;
	let failed = $state(false);

	const markerObjs = new Map<string, MlMarker>();
	const markerData = new Map<string, MapMarker>();
	let pinMarker: MlMarker | null = null;
	let geolocate: GeolocateControl | null = null;

	/* ---------- API publique (bind:this) ---------- */

	export function flyTo(pos: LatLon, targetZoom?: number) {
		map?.flyTo({ center: [pos.lon, pos.lat], zoom: targetZoom ?? Math.max(map.getZoom(), 15), essential: true });
	}

	export function fitTo(points: LatLon[], maxZoom = 16) {
		if (!map || !ml || points.length === 0) return;
		const bounds = new ml.LngLatBounds();
		for (const p of points) bounds.extend([p.lon, p.lat]);
		map.fitBounds(bounds, { padding: 60, maxZoom, duration: 600 });
	}

	export function getCenter(): LatLon | null {
		if (!map) return null;
		const c = map.getCenter();
		return { lat: c.lat, lon: c.lng };
	}

	/** Relance la géolocalisation (si `locate`). */
	export function locateMe() {
		geolocate?.trigger();
	}

	/* ---------- Création de la carte ---------- */

	onMount(() => {
		let disposed = false;
		const scheme = matchMedia('(prefers-color-scheme: light)');
		const onScheme = async () => {
			if (!map) return;
			const style = await loadMapStyle(currentTheme());
			map?.setStyle(style);
		};

		(async () => {
			try {
				ml = await loadMaplibre();
				const style = await loadMapStyle(currentTheme());
				if (disposed) return;
				const m = new ml.Map({
					container,
					style,
					center: [center.lon, center.lat],
					zoom,
					maxZoom: 19,
					attributionControl: { compact: false, customAttribution: '© OpenStreetMap contributors' },
					dragRotate: false,
					pitchWithRotate: false,
					touchPitch: false
				});
				m.touchZoomRotate.disableRotation();
				m.keyboard.disableRotation();

				if (locate) {
					geolocate = new ml.GeolocateControl({
						positionOptions: { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
						fitBoundsOptions: { maxZoom: 15 },
						trackUserLocation: false,
						showAccuracyCircle: false
					});
					m.addControl(geolocate, 'bottom-right');
					geolocate.on('geolocate', (e) =>
						onlocate?.({ lat: e.coords.latitude, lon: e.coords.longitude })
					);
					geolocate.on('error', () => onlocateerror?.());
					m.once('load', () => geolocate?.trigger());
				}

				m.on('click', (e) => onmapclick?.({ lat: e.lngLat.lat, lon: e.lngLat.lng }));
				m.on('moveend', () => {
					const c = m.getCenter();
					onmoveend?.({ lat: c.lat, lon: c.lng }, m.getZoom());
				});
				m.once('load', () => onready?.());
				map = m;
				scheme.addEventListener('change', onScheme);
			} catch (err) {
				console.error('[MapView]', err);
				failed = true;
			}
		})();

		return () => {
			disposed = true;
			scheme.removeEventListener('change', onScheme);
			map?.remove();
			map = null;
			markerObjs.clear();
			markerData.clear();
			pinMarker = null;
			geolocate = null;
		};
	});

	/* ---------- Pastilles ---------- */

	function markerElement(key: string): HTMLButtonElement {
		const el = document.createElement('button');
		el.type = 'button';
		el.className = 'bm-marker';
		el.innerHTML = '<span class="bm-marker__score"></span>';
		el.addEventListener('click', (e) => {
			e.stopPropagation();
			const data = markerData.get(key);
			if (data) onmarkerclick?.(data);
		});
		return el;
	}

	function paintMarker(el: HTMLElement, m: MapMarker, selected: boolean) {
		const score = m.score ?? null;
		const c = scoreColor(score);
		el.style.setProperty('--bm-bg', c.bg);
		el.style.setProperty('--bm-fg', c.fg);
		el.classList.toggle('is-empty', score === null);
		el.classList.toggle('is-selected', selected);
		el.title = m.title ?? '';
		el.setAttribute(
			'aria-label',
			`${m.title ?? 'Bar'}, ${score === null ? 'pas encore noté' : `noté ${formatScore(score)} sur 5`}`
		);
		el.querySelector('.bm-marker__score')!.textContent = formatScore(score);
	}

	$effect(() => {
		const m = map;
		const list = markers;
		const selected = selectedId;
		if (!m || !ml) return;
		const seen = new Set<string>();
		for (const mk of list) {
			const key = String(mk.id);
			seen.add(key);
			markerData.set(key, mk);
			let obj = markerObjs.get(key);
			if (!obj) {
				obj = new ml.Marker({ element: markerElement(key), anchor: 'bottom' });
				obj.setLngLat([mk.lon, mk.lat]).addTo(m);
				markerObjs.set(key, obj);
			} else {
				obj.setLngLat([mk.lon, mk.lat]);
			}
			paintMarker(obj.getElement(), mk, selected !== null && String(selected) === key);
		}
		for (const [key, obj] of markerObjs) {
			if (!seen.has(key)) {
				obj.remove();
				markerObjs.delete(key);
				markerData.delete(key);
			}
		}
	});

	/* ---------- Épingle déplaçable ---------- */

	function pinElement(): HTMLDivElement {
		const el = document.createElement('div');
		el.className = 'bm-pin';
		el.setAttribute('aria-label', 'Position du bar (déplaçable)');
		el.innerHTML =
			'<svg viewBox="0 0 40 52" aria-hidden="true"><path d="M20 51C20 51 38 31.5 38 19A18 18 0 0 0 2 19c0 12.5 18 32 18 32z"/><circle cx="20" cy="19" r="7"/></svg>';
		return el;
	}

	$effect(() => {
		const m = map;
		const p = pin;
		const draggable = pinDraggable;
		if (!m || !ml) return;
		if (!p) {
			pinMarker?.remove();
			pinMarker = null;
			return;
		}
		if (!pinMarker) {
			const marker = new ml.Marker({ element: pinElement(), anchor: 'bottom', draggable });
			marker.setLngLat([p.lon, p.lat]).addTo(m);
			marker.on('dragstart', () => marker.getElement().classList.add('is-dragging'));
			marker.on('dragend', () => {
				marker.getElement().classList.remove('is-dragging');
				const ll = marker.getLngLat();
				pin = { lat: ll.lat, lon: ll.lng };
				onpinchange?.(pin);
			});
			pinMarker = marker;
		} else {
			pinMarker.setDraggable(draggable);
			const cur = pinMarker.getLngLat();
			if (cur.lat !== p.lat || cur.lng !== p.lon) pinMarker.setLngLat([p.lon, p.lat]);
		}
	});
</script>

<div class="map-view {className}">
	<div class="canvas" bind:this={container} role="region" aria-label={label}></div>
	{#if failed}
		<p class="fallback">La carte ne s’affiche pas (connexion ou navigateur trop ancien). Le reste du site marche quand même.</p>
	{/if}
</div>

<style>
	.map-view {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 200px;
		background: var(--bg-sunk);
		overflow: hidden;
	}
	.canvas {
		position: absolute;
		inset: 0;
	}
	.fallback {
		position: absolute;
		inset: auto var(--space-4) var(--space-4);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-m);
		background: var(--bg-raised);
		color: var(--ink-dim);
		font-size: var(--text-sm);
	}

	/* ---------- Pastilles (créées hors Svelte : styles globaux) ---------- */

	/* MapLibre place la pastille avec un transform en ligne : elle doit rester en
	   position absolute (comme .maplibregl-marker) et on ne touche ni à transform
	   ni à sa transition (sinon les pastilles s'empilent ou traînent derrière la carte). */
	.map-view :global(.bm-marker) {
		position: absolute;
		display: grid;
		place-items: center;
		min-width: 40px;
		height: 30px;
		margin-bottom: 7px;
		padding: 0 7px;
		border: 2px solid var(--bg);
		border-radius: var(--radius-pill);
		background: var(--bm-bg);
		color: var(--bm-fg);
		font-family: var(--font-display);
		font-size: 17px;
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
		box-shadow: 0 3px 8px rgb(0 0 0 / 0.35);
	}
	/* zone tactile élargie à ~48px */
	.map-view :global(.bm-marker::before) {
		content: '';
		position: absolute;
		inset: -9px -5px;
	}
	/* petite pointe vers le lieu exact */
	.map-view :global(.bm-marker::after) {
		content: '';
		position: absolute;
		left: 50%;
		bottom: -8px;
		width: 10px;
		height: 10px;
		background: var(--bm-bg);
		border-right: 2px solid var(--bg);
		border-bottom: 2px solid var(--bg);
		transform: translateX(-50%) rotate(45deg);
		border-bottom-right-radius: 2px;
	}
	.map-view :global(.bm-marker.is-empty) {
		min-width: 30px;
	}
	.map-view :global(.bm-marker.is-selected) {
		z-index: 2;
		min-width: 48px;
		height: 36px;
		font-size: 21px;
		border-color: var(--foam);
	}
	.map-view :global(.bm-marker.is-selected::after) {
		border-color: var(--foam);
	}
	.map-view :global(.bm-marker:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 3px;
	}

	/* MapLibre place l'épingle avec un `transform` en ligne sur cet élément racine :
	   pas de transition ni de transform ici (sinon l'épingle traîne derrière le doigt),
	   l'effet « soulevée » se fait sur le SVG intérieur. */
	.map-view :global(.bm-pin) {
		width: 40px;
		height: 52px;
		cursor: grab;
		filter: drop-shadow(0 4px 4px rgb(0 0 0 / 0.4));
	}
	.map-view :global(.bm-pin svg) {
		display: block;
		width: 100%;
		height: 100%;
		transform-origin: 50% 100%;
		transition: transform 140ms var(--ease-out);
	}
	.map-view :global(.bm-pin path) {
		fill: var(--accent);
		stroke: var(--accent-ink);
		stroke-width: 1.5;
	}
	.map-view :global(.bm-pin circle) {
		fill: var(--foam);
	}
	.map-view :global(.bm-pin.is-dragging) {
		cursor: grabbing;
	}
	.map-view :global(.bm-pin.is-dragging svg) {
		transform: translateY(-10px) scale(1.08);
	}

	/* ---------- Contrôles MapLibre aux couleurs du site ---------- */

	.map-view :global(.maplibregl-ctrl-attrib) {
		background: color-mix(in srgb, var(--bg) 82%, transparent);
		color: var(--ink-dim);
		font-family: var(--font-body);
		font-size: 11px;
		border-radius: var(--radius-s) 0 0 0;
	}
	.map-view :global(.maplibregl-ctrl-attrib a) {
		color: var(--ink-dim);
	}
	.map-view :global(.maplibregl-ctrl-group) {
		background: var(--bg-raised);
		border-radius: var(--radius-m);
		box-shadow: var(--shadow);
	}
	.map-view :global(.maplibregl-ctrl-group button) {
		width: 44px;
		height: 44px;
	}
	@media (prefers-color-scheme: dark) {
		.map-view :global(.maplibregl-ctrl-group .maplibregl-ctrl-icon) {
			filter: invert(0.92);
		}
	}
</style>
