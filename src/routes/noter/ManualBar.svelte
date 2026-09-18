<!--
  « Bar introuvable ? » : on tape le nom, on place l'épingle (position du téléphone,
  sinon centre de la carte), et avant de créer on vérifie qu'on n'a pas déjà un bar à moins de 50 m.
-->
<script lang="ts">
	import { onMount, tick, untrack } from 'svelte';
	import Button from '$lib/components/Button.svelte';
	import Field from '$lib/components/Field.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import { GEO, LIMITS } from '$lib/constants';
	import type { LatLon } from '$lib/geo/distance';
	import { barToOption, type PlaceOption } from '$lib/geo/merge';
	import { parseAddress, parseBarName } from '$lib/validation';
	import { distancePhrase, findDuplicates, manualOption, type NearbyBar } from './manual';
	import PlaceList from './PlaceList.svelte';

	interface Props {
		/** Position du téléphone (null tant qu'on ne l'a pas). */
		pos: LatLon | null;
		/** La géoloc est refusée (par un vrai essai, pas d'après la Permissions API) ou impossible. */
		geoBlocked: boolean;
		/** Nom prérempli (ce qui était tapé dans la recherche). */
		initialName?: string;
		/** Demande la position (si elle n'a pas encore été demandée). */
		onlocate: () => void;
		onpick: (option: PlaceOption) => void;
		oncancel: () => void;
	}

	let { pos, geoBlocked, initialName = '', onlocate, onpick, oncancel }: Props = $props();

	const start = untrack(() => pos);
	let name = $state(untrack(() => initialName));
	let address = $state('');
	let nameError = $state<string | null>(null);
	let pin = $state<LatLon | null>(start ?? { ...GEO.defaultCenter });
	/** Tant que personne n'a touché l'épingle ni reçu la position, elle suit le centre de la carte. */
	let followCenter = $state(start === null);
	let pinTouched = false;
	let checking = $state(false);
	/** Bars déjà en base près de l'épingle (null = pas encore vérifié pour cette épingle/ce nom). */
	let duplicates = $state<NearbyBar[] | null>(null);

	let mapView = $state<ReturnType<typeof MapView>>();
	let nameInput = $state<HTMLInputElement>();
	let warning = $state<HTMLElement>();

	onMount(() => {
		if (!start && !geoBlocked) onlocate();
	});

	let mapReady = false;
	let pendingFly: LatLon | null = null;

	// La position arrive après coup : l'épingle y saute (si on ne l'a pas déjà placée à la main).
	$effect(() => {
		const p = pos;
		if (!p || p === start || pinTouched) return;
		untrack(() => {
			pin = p;
			followCenter = false;
			if (mapReady) mapView?.flyTo(p, 18);
			else pendingFly = p;
		});
	});

	function onMapReady() {
		mapReady = true;
		if (pendingFly) mapView?.flyTo(pendingFly, 18);
		pendingFly = null;
	}

	function resetCheck() {
		duplicates = null;
	}

	function placePin(p: LatLon) {
		pinTouched = true;
		followCenter = false;
		pin = p;
		resetCheck();
	}

	async function next() {
		const parsed = parseBarName(name);
		if (!parsed.ok) {
			nameError = parsed.error;
			nameInput?.focus();
			return;
		}
		nameError = null;
		if (!pin) return;
		const option = manualOption(parsed.value, parseAddress(address), pin);
		if (duplicates === null) {
			checking = true;
			const found = await findDuplicates(pin);
			checking = false;
			if (found.length > 0) {
				duplicates = found;
				await tick();
				warning?.scrollIntoView({ behavior: 'smooth', block: 'center' });
				warning?.focus();
				return;
			}
		}
		onpick(option);
	}

	function createAnyway() {
		const parsed = parseBarName(name);
		if (parsed.ok && pin) onpick(manualOption(parsed.value, parseAddress(address), pin));
	}

	const closest = $derived(duplicates?.[0] ?? null);
	const others = $derived((duplicates ?? []).slice(1, 4).map((b) => barToOption(b, pin)));
</script>

<section class="manual stack" aria-labelledby="manual-title">
	<div class="stack head">
		<h1 id="manual-title">Ajouter un bar</h1>
		<p class="muted">Donne son nom et place l’épingle sur le bar.</p>
	</div>

	<Field id="bar-name" label="Nom du bar" required error={nameError}>
		<input
			id="bar-name"
			type="text"
			autocomplete="off"
			autocapitalize="words"
			maxlength={LIMITS.barNameMax}
			placeholder="Ex. Le Chat Noir"
			bind:this={nameInput}
			bind:value={name}
			oninput={() => {
				resetCheck();
				nameError = null;
			}}
			aria-invalid={!!nameError}
			aria-describedby={nameError ? 'bar-name-error' : undefined}
		/>
	</Field>

	<div class="stack map-block">
		<p class="map-hint" id="map-hint">
			{#if pos}
				L’épingle est sur ta position. Fais-la glisser sur l’entrée du bar, ou touche la carte au bon endroit.
			{:else if geoBlocked}
				Sans ta position, l’épingle part du centre de la carte : zoome jusqu’au bar, puis touche la carte à son emplacement.
			{:else}
				Je cherche ta position… En attendant, déplace la carte ou touche-la à l’emplacement du bar.
			{/if}
		</p>
		<div class="map">
			<MapView
				bind:this={mapView}
				center={start ?? GEO.defaultCenter}
				zoom={start ? 18 : GEO.defaultZoom}
				bind:pin
				onpinchange={(p) => placePin(p)}
				onmapclick={(p) => placePin(p)}
				onready={onMapReady}
				onmoveend={(c) => {
					if (followCenter) pin = c;
				}}
				label="Carte : place l’épingle sur le bar"
			/>
		</div>
	</div>

	<Field id="bar-address" label="Adresse" hint="Facultatif. Ex. 3 rue Kervégan, Nantes.">
		<input
			id="bar-address"
			type="text"
			autocomplete="off"
			maxlength={LIMITS.addressMax}
			bind:value={address}
			aria-describedby="bar-address-hint"
		/>
	</Field>

	{#if closest}
		<div class="warning stack" role="alert" tabindex="-1" bind:this={warning}>
			<p class="question">
				Il y a déjà « {closest.name} » {distancePhrase(closest.distance)}, c’est pas celui-là ?
			</p>
			<div class="actions">
				<Button type="button" full onclick={() => closest && onpick(barToOption(closest, pin))}>
					Oui, c’est {closest.name}
				</Button>
				{#if others.length > 0}
					<p class="muted small">Ou l’un de ceux-là :</p>
					<PlaceList options={others} {onpick} label="Autres bars tout près" />
				{/if}
				<Button type="button" variant="secondary" full onclick={createAnyway}>
					Non, c’est un autre bar
				</Button>
			</div>
		</div>
	{:else}
		<div class="actions">
			<Button type="button" size="lg" full busy={checking} onclick={next}>Continuer</Button>
		</div>
	{/if}

	<Button type="button" variant="ghost" onclick={oncancel}>Annuler, je cherche encore</Button>
</section>

<style>
	.manual {
		--stack-gap: var(--space-5);
	}
	.head {
		--stack-gap: var(--space-2);
	}
	.map-block {
		--stack-gap: var(--space-2);
	}
	.map-hint {
		font-size: var(--text-sm);
		color: var(--ink-dim);
	}
	.map {
		height: min(52vh, 380px);
		min-height: 260px;
		border-radius: var(--radius-l);
		overflow: hidden;
		box-shadow: inset 0 0 0 1.5px var(--line);
	}

	.warning {
		--stack-gap: var(--space-4);
		padding: var(--space-4);
		border-radius: var(--radius-l);
		background: var(--accent-soft);
		box-shadow: inset 0 0 0 2px var(--accent);
	}
	.warning:focus-visible {
		outline-offset: 3px;
	}
	.question {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: var(--display-sm);
		line-height: 1.1;
		text-wrap: balance;
	}
	.actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.small {
		font-size: var(--text-sm);
	}
</style>
