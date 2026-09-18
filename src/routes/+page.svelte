<!--
  Accueil : carte plein écran des bars notés ⇄ classement (`?vue=classement`).
  Filtres (terrasse, ambiances, prix max de la pinte) dans l'URL, appliqués côté client.
-->
<script lang="ts">
	import { fly } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';
	import MapView, { type MapMarker } from '$lib/components/MapView.svelte';
	import { GEO } from '$lib/constants';
	import { plural } from '$lib/format';
	import type { LatLon } from '$lib/geo/distance';
	import BarPeek from './BarPeek.svelte';
	import FilterSheet from './FilterSheet.svelte';
	import Ranking from './Ranking.svelte';
	import {
		DEFAULT_ZONE,
		NO_FILTERS,
		countActiveFilters,
		filterBars,
		fitView,
		homeHref,
		isInBounds,
		parseFilters,
		parseView,
		priceRange,
		rankBars,
		toScreen,
		viewBounds,
		type HomeFilters
	} from './home';

	let { data } = $props();

	/* ---------- Vue + filtres (dans l'URL) ---------- */

	const view = $derived(parseView(page.url.searchParams));
	/** Filtres en train d'être appliqués (le temps que l'URL suive, ou pendant qu'on glisse le curseur). */
	let draft = $state<HomeFilters | null>(null);
	const filters = $derived(draft ?? parseFilters(page.url.searchParams));
	const activeCount = $derived(countActiveFilters(filters));

	const hasBars = $derived(data.bars.length > 0);
	const results = $derived(rankBars(filterBars(data.bars, filters)));
	const range = $derived(priceRange(data.bars));

	let navigation = 0;
	function setFilters(next: HomeFilters, { commit = true }: { commit?: boolean } = {}) {
		draft = next;
		if (selectedId !== null && !filterBars(data.bars, next).some((b) => b.id === selectedId)) selectedId = null;
		if (!commit) return;
		const seq = ++navigation;
		goto(homeHref(view, next), { replaceState: true, keepFocus: true, noScroll: true }).finally(() => {
			if (seq === navigation) draft = null;
		});
	}

	let sheet = $state<ReturnType<typeof FilterSheet>>();

	/* ---------- Carte ---------- */

	let mapView = $state<ReturnType<typeof MapView>>();
	/**
	 * La carte n'est créée qu'une fois affichée et mesurée (pour cadrer la vue de départ),
	 * puis gardée (position, géoloc) quand on passe au classement.
	 */
	let mapMounted = $state(false);
	$effect(() => {
		if (view === 'carte' && mapHeight > 0) mapMounted = true;
	});

	/**
	 * Zone de la carte où une pastille reste visible (px) : sous la barre carte/classement
	 * (la pastille dépasse ~45 px au-dessus de son point), au-dessus du bouton et de la mention OSM.
	 */
	const CLEAR = { top: 170, right: 36, bottom: 110, left: 36 };
	/** Hauteur cachée par la carte du bar sélectionné (+ mention OSM). */
	const PEEK_CLEAR = 310;

	let mapReady = $state(false);
	let mapWidth = $state(0);
	let mapHeight = $state(0);
	/** Vue de départ (sans géoloc) : Nantes – La Roche-sur-Yon, cadrée dans la partie libre de l'écran. */
	const startView = $derived(
		fitView(DEFAULT_ZONE, mapWidth, mapHeight, CLEAR, 11) ?? { center: GEO.defaultCenter, zoom: GEO.defaultZoom }
	);
	/** Dernière position connue de la carte (null tant qu'elle n'a pas bougé). */
	let moved = $state<{ center: LatLon; zoom: number } | null>(null);
	const camera = $derived(moved ?? startView);
	let selectedId = $state<number | null>(null);
	const selected = $derived(selectedId === null ? null : (results.find((b) => b.id === selectedId) ?? null));

	/** Du moins bon au meilleur : quand des pastilles se chevauchent, la mieux notée passe dessus. */
	const markers: MapMarker[] = $derived(
		results.map((b) => ({ id: b.id, lat: b.lat, lon: b.lon, score: b.overall, title: b.name })).reverse()
	);

	/** Aucun bar à l'écran (ex. géolocalisé loin de tout bar noté) : on propose de tout voir. */
	const nothingInView = $derived.by(() => {
		if (!mapReady || mapWidth === 0 || results.length === 0) return false;
		const bounds = viewBounds(camera.center, camera.zoom, mapWidth, mapHeight);
		return !results.some((b) => isInBounds(b, bounds));
	});

	function selectBar(id: number) {
		selectedId = id;
		const bar = results.find((b) => b.id === id);
		if (!bar || !mapView || mapHeight === 0) return;
		// si la pastille finit sous la carte du bar (ou sous la barre du haut), on recentre dessus
		const { y } = toScreen(bar, camera.center, camera.zoom, mapWidth, mapHeight);
		if (y > mapHeight - PEEK_CLEAR || y < CLEAR.top) mapView.flyTo(bar, camera.zoom);
	}

	function showAll() {
		const view = fitView(results, mapWidth, mapHeight, CLEAR, 15);
		if (view) mapView?.flyTo(view.center, view.zoom);
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key !== 'Escape' || selectedId === null) return;
		if (e.target instanceof Element && e.target.closest('dialog')) return;
		selectedId = null;
	}

	const summary = $derived(
		activeCount === 0
			? `${plural(results.length, 'bar')}, du mieux noté au moins bien noté.`
			: `${plural(results.length, 'bar')} sur ${data.bars.length} avec tes filtres.`
	);
</script>

<svelte:head>
	<title>{view === 'classement' ? 'Classement · Barathon' : 'Barathon'}</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

{#snippet empty()}
	<div class="empty">
		<svg class="empty-pint" viewBox="0 0 48 64" aria-hidden="true">
			<path class="glass" d="M7 5h34l-3.7 51.6a3 3 0 0 1-3 2.8H13.7a3 3 0 0 1-3-2.8z" />
			<path class="foam" d="M9 15h30" />
		</svg>
		<h2>La carte est encore vide</h2>
		<p class="muted">Personne n’a noté de bar pour l’instant. Commence par celui où tu trinques, les potes suivront.</p>
		<Button href="/noter" size="lg" full>Noter le premier bar</Button>
	</div>
{/snippet}

{#snippet noMatch()}
	<div class="no-match" role="status">
		<p>Aucun bar ne colle à tes filtres.</p>
		<Button variant="secondary" type="button" onclick={() => setFilters(NO_FILTERS)}>Effacer les filtres</Button>
	</div>
{/snippet}

<div class="home" class:is-map={view === 'carte'} class:is-list={view === 'classement'}>
	{#if hasBars}
		<div class="toolbar">
			<nav class="switch" aria-label="Affichage">
				<a href={homeHref('carte', filters)} aria-current={view === 'carte' ? 'page' : undefined}>Carte</a>
				<a href={homeHref('classement', filters)} aria-current={view === 'classement' ? 'page' : undefined}>
					Classement
				</a>
			</nav>
			<button
				class="filter-btn"
				class:active={activeCount > 0}
				type="button"
				aria-haspopup="dialog"
				onclick={() => sheet?.open()}
			>
				<svg viewBox="0 0 20 20" aria-hidden="true">
					<path d="M3 6h8M15 6h2M3 14h2M9 14h8" /><circle cx="13" cy="6" r="2" /><circle cx="7" cy="14" r="2" />
				</svg>
				Filtres
				{#if activeCount > 0}
					<span class="count"><span class="visually-hidden">, </span>{activeCount}<span class="visually-hidden">{activeCount > 1 ? ' actifs' : ' actif'}</span></span>
				{/if}
			</button>
		</div>
	{/if}

	<div class="map-wrap" hidden={view !== 'carte'} bind:clientWidth={mapWidth} bind:clientHeight={mapHeight}>
		<h1 class="visually-hidden">Carte des bars notés</h1>
		{#if mapMounted}
			<MapView
				bind:this={mapView}
				center={startView.center}
				zoom={startView.zoom}
				{markers}
				selectedId={selected?.id ?? null}
				locate
				label="Carte des bars notés"
				onmarkerclick={(m) => selectBar(Number(m.id))}
				onmapclick={() => (selectedId = null)}
				onmoveend={(center, zoom) => (moved = { center, zoom })}
				onready={() => (mapReady = true)}
			/>
		{/if}

		{#if !hasBars}
			<div class="map-empty">{@render empty()}</div>
		{:else if results.length === 0}
			<div class="map-notice">{@render noMatch()}</div>
		{:else if nothingInView && !selected}
			<div class="map-notice">
				<div class="no-match" role="status">
					<p>Aucun bar noté par ici.</p>
					<Button variant="secondary" type="button" onclick={showAll}>Voir tous les bars</Button>
				</div>
			</div>
		{/if}

		{#if selected}
			<div class="peek-wrap" transition:fly={{ y: 48, duration: 220 }}>
				<BarPeek bar={selected} onclose={() => (selectedId = null)} />
			</div>
		{/if}
	</div>

	{#if view === 'classement'}
		<section class="ranking container" aria-labelledby="classement-titre">
			<header class="ranking-head">
				<h1 id="classement-titre">Classement</h1>
				{#if hasBars}<p class="muted">{summary}</p>{/if}
			</header>
			{#if !hasBars}
				{@render empty()}
			{:else if results.length === 0}
				{@render noMatch()}
			{:else}
				<Ranking bars={results} />
			{/if}
		</section>
	{/if}

	{#if hasBars && !(view === 'carte' && selected)}
		<div class="fab">
			<Button href="/noter" size="lg">
				<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
				Noter un bar
			</Button>
		</div>
	{/if}
</div>

{#if hasBars}
	<FilterSheet
		bind:this={sheet}
		{filters}
		{range}
		count={results.length}
		onchange={setFilters}
		onclear={() => setFilters(NO_FILTERS)}
	/>
{/if}

<style>
	.home {
		/* ce qu'il faut laisser libre en bas de la carte pour la mention OSM */
		--attribution-clear: calc(env(safe-area-inset-bottom) + 2.25rem);
		position: relative;
	}
	.home.is-map {
		/* tout l'écran sous l'en-tête (hauteur + encoche + son filet d'1 px) : pas de défilement */
		height: calc(100dvh - var(--header-h) - env(safe-area-inset-top) - 1px);
		overflow: hidden;
	}

	/* ---------- Barre carte ⇄ classement + filtres ---------- */

	.toolbar {
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
	}
	.is-map .toolbar {
		position: absolute;
		top: var(--space-3);
		left: var(--space-3);
		right: var(--space-3);
		pointer-events: none; /* la carte reste manipulable entre les boutons */
	}
	.is-map .toolbar > * {
		pointer-events: auto;
	}
	.is-list .toolbar {
		position: sticky;
		top: calc(var(--header-h) + env(safe-area-inset-top));
		max-width: var(--content-max);
		margin-inline: auto;
		padding: var(--space-3) var(--gutter);
		background: color-mix(in srgb, var(--bg) 92%, transparent);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
	}

	.switch {
		display: flex;
		padding: 3px;
		border-radius: var(--radius-pill);
		background: var(--bg-raised);
		box-shadow:
			inset 0 0 0 1.5px var(--line),
			var(--shadow);
	}
	.switch a {
		display: inline-flex;
		align-items: center;
		min-height: 42px;
		padding: 0 var(--space-4);
		border-radius: var(--radius-pill);
		color: var(--ink-dim);
		font-size: var(--text-sm);
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
	}
	.switch a:hover {
		color: var(--ink);
	}
	.switch a[aria-current='page'] {
		background: var(--ink);
		color: var(--bg);
	}

	.filter-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap);
		padding: 0 var(--space-4);
		border: 0;
		border-radius: var(--radius-pill);
		background: var(--bg-raised);
		box-shadow:
			inset 0 0 0 1.5px var(--line),
			var(--shadow);
		font-size: var(--text-sm);
		font-weight: 700;
		white-space: nowrap;
		cursor: pointer;
	}
	.filter-btn:hover {
		box-shadow:
			inset 0 0 0 1.5px var(--line-strong),
			var(--shadow);
	}
	.filter-btn.active {
		box-shadow:
			inset 0 0 0 2px var(--accent),
			var(--shadow);
	}
	.filter-btn svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
	}
	.count {
		display: grid;
		place-items: center;
		min-width: 1.4rem;
		height: 1.4rem;
		padding: 0 0.3rem;
		border-radius: var(--radius-pill);
		background: var(--accent);
		color: var(--accent-ink);
		font-size: var(--text-xs);
		line-height: 1;
	}

	/* ---------- Carte ---------- */

	.map-wrap {
		position: absolute;
		inset: 0;
	}
	.map-wrap[hidden] {
		display: none;
	}
	/* la mention OSM et le bouton « me localiser » restent au-dessus de la barre d'accueil iOS */
	.map-wrap :global(.maplibregl-ctrl-bottom-right),
	.map-wrap :global(.maplibregl-ctrl-bottom-left) {
		bottom: env(safe-area-inset-bottom);
	}

	.map-notice {
		position: absolute;
		z-index: 10;
		top: calc(var(--space-3) + var(--tap) + var(--space-3));
		left: var(--space-3);
		right: var(--space-3);
		display: flex;
		justify-content: center;
		pointer-events: none;
	}
	.map-notice .no-match {
		pointer-events: auto;
		max-width: 24rem;
		padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
		border-radius: var(--radius-l);
		background: var(--bg-raised);
		box-shadow:
			0 0 0 1px var(--line),
			var(--shadow);
	}

	.map-empty {
		position: absolute;
		z-index: 10;
		inset: 0;
		display: grid;
		place-items: center;
		padding: var(--space-4) var(--space-3) var(--attribution-clear);
		background: color-mix(in srgb, var(--bg) 35%, transparent);
	}
	.map-empty .empty {
		max-width: 22rem;
		padding: var(--space-5) var(--space-4) var(--space-4);
		border-radius: var(--radius-l);
		background: var(--bg-raised);
		box-shadow:
			0 0 0 1px var(--line),
			var(--shadow);
	}

	.peek-wrap {
		position: absolute;
		z-index: 15;
		left: var(--space-3);
		right: var(--space-3);
		bottom: var(--attribution-clear);
		max-width: 26rem;
		margin-inline: auto;
	}

	/* ---------- Bouton « Noter un bar » ---------- */

	/* en bas à gauche, sur la même ligne que « me localiser » (à droite) */
	.fab {
		position: absolute;
		z-index: 12;
		left: var(--space-3);
		bottom: calc(var(--attribution-clear) + var(--space-1));
	}
	.is-list .fab {
		position: fixed;
		left: max(var(--space-3), calc((100vw - var(--content-max)) / 2 + var(--gutter)));
		bottom: calc(env(safe-area-inset-bottom) + var(--space-4));
	}
	.fab :global(a.btn) {
		white-space: nowrap;
		box-shadow:
			0 -3px 0 rgb(0 0 0 / 0.14) inset,
			0 8px 24px -6px rgb(0 0 0 / 0.55);
	}
	.fab svg {
		width: 18px;
		height: 18px;
		stroke: currentColor;
		stroke-width: 2.6;
		stroke-linecap: round;
	}

	/* ---------- Classement ---------- */

	.ranking {
		padding-top: var(--space-2);
		padding-bottom: calc(var(--tap-lg) + var(--space-7) + env(safe-area-inset-bottom));
	}
	.ranking-head {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		margin-bottom: var(--space-3);
	}
	.ranking > .no-match,
	.ranking > .empty {
		margin-top: var(--space-4);
	}

	/* ---------- États vides ---------- */

	.empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
		text-align: center;
	}
	.empty h2 {
		font-size: var(--display-sm);
	}
	.empty p {
		max-width: 30ch;
		margin-bottom: var(--space-2);
	}
	.empty-pint {
		width: 44px;
		height: 58px;
		fill: none;
		stroke-linejoin: round;
	}
	.empty-pint .glass {
		stroke: var(--line-strong);
		stroke-width: 2.5;
	}
	.empty-pint .foam {
		stroke: var(--accent);
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-dasharray: 3 5;
	}

	.no-match {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-3);
	}
	.no-match p {
		font-weight: 700;
	}
</style>
