<!--
  Étape 1 de /noter : « Autour de moi », recherche, ou « Bar introuvable ? ».
  Appelle `onpick(option)` avec le bar choisi (nos bars, lieu OSM ou nouveau bar à la main).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { pushState } from '$app/navigation';
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';
	import { findByName, findNearby } from '$lib/client/places';
	import { GEO } from '$lib/constants';
	import type { LatLon } from '$lib/geo/distance';
	import type { PlaceOption } from '$lib/geo/merge';
	import { canRetry, GeoError, geoErrorMessage, geoPermission, getPosition, type GeoErrorKind } from './geolocation';
	import ManualBar from './ManualBar.svelte';
	import PlaceList from './PlaceList.svelte';
	import { noterState } from './state';

	interface Props {
		onpick: (option: PlaceOption) => void;
		/** Message en tête (ex. le bar de `?bar=` n'existe plus). */
		notice?: string | null;
	}

	let { onpick, notice = null }: Props = $props();

	/* ---------- Position ---------- */

	type Geo =
		| { status: 'idle' }
		| { status: 'locating' }
		| { status: 'ok'; pos: LatLon }
		| { status: 'error'; kind: GeoErrorKind };

	let geo = $state<Geo>({ status: 'idle' });
	const pos = $derived(geo.status === 'ok' ? geo.pos : null);
	const geoBlocked = $derived(geo.status === 'error' && !canRetry(geo.kind));

	let near = $state<{ loading: boolean; options: PlaceOption[] | null; providerError: boolean }>({
		loading: false,
		options: null,
		providerError: false
	});
	let nearCtrl: AbortController | null = null;

	async function locate() {
		if (geo.status === 'locating') return;
		geo = { status: 'locating' };
		try {
			const p = await getPosition();
			geo = { status: 'ok', pos: p };
			loadNearby(p);
		} catch (e) {
			geo = { status: 'error', kind: e instanceof GeoError ? e.kind : 'unavailable' };
		}
	}

	async function loadNearby(p: LatLon) {
		nearCtrl?.abort();
		const ctrl = (nearCtrl = new AbortController());
		near = { loading: true, options: null, providerError: false };
		try {
			const r = await findNearby(p, { signal: ctrl.signal });
			if (!ctrl.signal.aborted) near = { loading: false, ...r };
		} catch {
			if (!ctrl.signal.aborted) near = { loading: false, options: [], providerError: true };
		}
	}

	onMount(() => {
		// On ne demande rien d'office : si c'est déjà autorisé on y va, sinon on attend un tap.
		geoPermission().then((perm) => {
			if (geo.status !== 'idle') return;
			if (perm === 'granted') locate();
			else if (perm === 'denied') geo = { status: 'error', kind: 'denied' };
			else if (!('geolocation' in navigator)) geo = { status: 'error', kind: 'unsupported' };
		});
		return () => nearCtrl?.abort();
	});

	/* ---------- Recherche ---------- */

	let query = $state('');
	let searching = $state(false);
	let results = $state<{ query: string; options: PlaceOption[]; providerError: boolean } | null>(null);

	// Debounce 300 ms + annulation de la requête précédente à chaque frappe.
	$effect(() => {
		const q = query.trim();
		const origin = pos ?? GEO.defaultCenter;
		if (q.length < 2) {
			results = null;
			searching = false;
			return;
		}
		searching = true;
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const r = await findByName(q, origin, { signal: ctrl.signal });
				if (!ctrl.signal.aborted) results = { query: q, ...r };
			} catch {
				if (!ctrl.signal.aborted) results = { query: q, options: [], providerError: true };
			} finally {
				if (!ctrl.signal.aborted) searching = false;
			}
		}, 300);
		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	});

	const searchStatus = $derived.by(() => {
		if (query.trim().length < 2) return '';
		if (searching) return 'Je cherche…';
		if (!results) return '';
		if (results.providerError)
			return results.options.length
				? 'La recherche ne répond pas bien : seuls nos bars s’affichent. Pas dedans ? Ajoute-le à la main.'
				: 'La recherche ne répond pas pour l’instant. Réessaie dans un moment, ou ajoute le bar à la main.';
		if (results.options.length === 0)
			return `Rien trouvé pour « ${results.query} ». Vérifie l’orthographe, ou ajoute le bar à la main.`;
		return '';
	});

	/* ---------- Bar introuvable ---------- */

	const manual = $derived(!!noterState(page.state).noterManual);
	let manualName = $state('');

	function openManual() {
		manualName = query.trim();
		pushState('', $state.snapshot({ ...page.state, noterManual: true }));
		window.scrollTo({ top: 0 });
	}
</script>

{#if manual}
	<ManualBar
		{pos}
		{geoBlocked}
		initialName={manualName}
		onlocate={locate}
		{onpick}
		oncancel={() => history.back()}
	/>
{:else}
	<div class="picker">
		<header class="intro">
			<h1>Noter un bar</h1>
			<p class="muted">T’es dans quel bar ? Choisis-le, puis note ton passage.</p>
		</header>

		{#if notice}<p class="notice" role="status">{notice}</p>{/if}

		<section class="block" aria-labelledby="near-title">
			<h2 id="near-title">Autour de moi</h2>
			{#if geo.status === 'idle'}
				<p class="muted">
					Partage ta position pour voir les bars à moins de {GEO.nearbyRadiusM} m. Elle sert juste à ça,
					on ne la garde pas.
				</p>
				<div><Button type="button" variant="secondary" onclick={locate}>Voir les bars autour de moi</Button></div>
			{:else if geo.status === 'locating'}
				<p class="status" role="status">Je cherche où tu es…</p>
			{:else if geo.status === 'error'}
				<p class="muted" role="status">{geoErrorMessage(geo.kind)}</p>
				{#if canRetry(geo.kind)}
					<div><Button type="button" variant="ghost" onclick={locate}>Réessayer</Button></div>
				{/if}
			{:else if near.loading || near.options === null}
				<p class="status" role="status">Je regarde ce qu’il y a autour…</p>
			{:else}
				{#if near.options.length > 0}
					<PlaceList options={near.options} {onpick} label="Bars autour de moi" />
				{:else}
					<p class="muted" role="status">
						Aucun bar repéré à moins de {GEO.nearbyRadiusM} m. Cherche-le par son nom, ou ajoute-le à la main.
					</p>
				{/if}
				{#if near.providerError}
					<p class="small muted">La recherche autour de toi ne répond pas bien : seuls nos bars s’affichent.</p>
				{/if}
			{/if}
		</section>

		<section class="block" aria-labelledby="search-title">
			<h2 id="search-title">Chercher un bar</h2>
			<div class="search">
				<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="M13 13l4.5 4.5" /></svg>
				<input
					id="bar-search"
					type="search"
					placeholder="Nom du bar, ex. Les Berthom"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					enterkeyhint="search"
					aria-labelledby="search-title"
					aria-describedby="search-status"
					bind:value={query}
				/>
			</div>
			<p class="status" id="search-status" aria-live="polite">{searchStatus}</p>
			{#if results && results.options.length > 0}
				<PlaceList options={results.options} {onpick} showDistance={pos !== null} label="Résultats de la recherche" />
			{/if}
		</section>

		<section class="block lost" aria-labelledby="lost-title">
			<h2 id="lost-title">Bar introuvable ?</h2>
			<p class="muted">Ajoute-le à la main : son nom et une épingle sur la carte.</p>
			<div><Button type="button" variant="secondary" onclick={openManual}>Ajouter un bar</Button></div>
		</section>
	</div>
{/if}

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: var(--space-6);
	}
	.intro {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.notice {
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-m);
		background: var(--danger-soft);
		color: var(--ink);
		font-weight: 700;
	}

	.block {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.status {
		min-height: 1.5em;
		color: var(--ink-dim);
		font-size: var(--text-sm);
	}
	.status:empty {
		min-height: 0;
	}
	.small {
		font-size: var(--text-sm);
	}

	.search {
		position: relative;
	}
	.search svg {
		position: absolute;
		left: var(--space-4);
		top: 50%;
		width: 20px;
		height: 20px;
		transform: translateY(-50%);
		fill: none;
		stroke: var(--ink-faint);
		stroke-width: 2;
		stroke-linecap: round;
		pointer-events: none;
	}
	.search input {
		min-height: var(--tap-lg);
		padding-left: calc(var(--space-4) + 28px);
		font-size: var(--text-lg);
	}

	.lost {
		padding-top: var(--space-5);
		border-top: 2px dotted var(--line-strong);
	}
</style>
