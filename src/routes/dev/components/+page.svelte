<!-- Vitrine des composants partagés (dev uniquement). -->
<script lang="ts">
	import AmbiancePicker from '$lib/components/AmbiancePicker.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Field from '$lib/components/Field.svelte';
	import MapView, { type MapMarker } from '$lib/components/MapView.svelte';
	import MoodPicker from '$lib/components/MoodPicker.svelte';
	import PintCelebration from '$lib/components/PintCelebration.svelte';
	import RatingInput from '$lib/components/RatingInput.svelte';
	import ScoreBadge from '$lib/components/ScoreBadge.svelte';
	import TerraceInput from '$lib/components/TerraceInput.svelte';
	import type { LatLon } from '$lib/geo/distance';

	let beaute = $state<number | null>(4);
	let soiree = $state<number | null>(null);
	let terrasse = $state<number | null>(0);
	let humeur = $state<number | null>(4);
	let ambiances = $state<string[]>(['chill']);
	let pseudo = $state('');
	let celebrate = $state(false);
	let selected = $state<string | number | null>(null);
	let pin = $state<LatLon | null>({ lat: 47.2131, lon: -1.5558 });

	const markers: MapMarker[] = [
		{ id: 1, lat: 47.21294, lon: -1.55628, score: 4.6, title: 'Le Chat Noir' },
		{ id: 2, lat: 47.21271, lon: -1.55572, score: 3.1, title: 'Le Petit Marais' },
		{ id: 3, lat: 47.21252, lon: -1.55618, score: 1.4, title: 'Le Tiki Bar' },
		{ id: 4, lat: 47.21309, lon: -1.55477, score: null, title: "Atomic's Café" },
		{ id: 5, lat: 47.21348, lon: -1.55744, score: 2.4, title: 'Mamatte' }
	];
</script>

<svelte:head><title>Composants · Barathon</title></svelte:head>

<div class="container stack page">
	<h1>Composants</h1>

	<section class="stack">
		<h2>Notes</h2>
		<div class="row">
			{#each [null, 1, 1.8, 2.5, 3.2, 4, 4.6, 5] as s (s)}
				<ScoreBadge score={s} />
			{/each}
		</div>
		<div class="row">
			<ScoreBadge score={4.25} variant="numeral" size="lg" outOf />
			<ScoreBadge score={2.1} variant="numeral" size="md" />
		</div>
		<div class="leader"><span>Beauté</span><span>4,2</span></div>
		<div class="leader"><span>Qualité de la bière</span><span>3,5</span></div>
	</section>

	<Card>
		<form class="stack" onsubmit={(e) => e.preventDefault()}>
			<Field id="pseudo" label="Prénom ou pseudo" required hint="Mémorisé sur ce téléphone.">
				<input id="pseudo" name="pseudo" bind:value={pseudo} autocomplete="nickname" />
			</Field>
			<RatingInput name="beaute" label="Beauté" bind:value={beaute} />
			<TerraceInput bind:value={terrasse} />
			<RatingInput name="soiree" label="La soirée" required bind:value={soiree} error="Note au moins la soirée : c’est le seul critère obligatoire." />
			<AmbiancePicker bind:value={ambiances} />
			<MoodPicker bind:value={humeur} />
			<div class="row">
				<Button type="button" onclick={() => (celebrate = true)}>Enregistrer mon passage</Button>
				<Button variant="secondary" type="button">Annuler</Button>
				<Button variant="ghost" type="button">Changer de bar</Button>
				<Button variant="danger" type="button">Supprimer</Button>
				<Button type="button" busy>Envoi</Button>
			</div>
			<p class="muted">beaute={beaute} terrasse={terrasse} soiree={soiree} humeur={humeur} ambiances={ambiances.join(',')}</p>
		</form>
	</Card>

	<section class="stack">
		<h2>Carte</h2>
		<div class="map">
			<MapView
				{markers}
				center={{ lat: 47.2129, lon: -1.5561 }}
				zoom={16.5}
				selectedId={selected}
				onmarkerclick={(m) => (selected = m.id)}
				onmapclick={() => (selected = null)}
				bind:pin
			/>
		</div>
		<p class="muted">Sélection : {selected ?? 'aucune'} ; épingle : {pin?.lat.toFixed(5)}, {pin?.lon.toFixed(5)}</p>
	</section>
</div>

<PintCelebration open={celebrate} score={3.7} ondone={() => setTimeout(() => (celebrate = false), 1500)}>
	<Button type="button" onclick={() => (celebrate = false)}>Voir la fiche du bar</Button>
</PintCelebration>

<style>
	.page {
		padding-block: var(--space-5);
		--stack-gap: var(--space-5);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.map {
		height: 360px;
		border-radius: var(--radius-l);
		overflow: hidden;
	}
</style>
