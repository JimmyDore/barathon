<!-- Fiche bar : notes (globale, blocs, critères), en bref, carte, passages. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import ScoreBadge from '$lib/components/ScoreBadge.svelte';
	import { getVisitTokens } from '$lib/client/storage';
	import { BLOCKS, CRITERIA, MOODS, ambianceLabel } from '$lib/constants';
	import { formatDate, formatPrice, formatScore, plural } from '$lib/format';

	let { data } = $props();

	const bar = $derived(data.bar);
	const visits = $derived(data.visits);

	/** Jetons d'auteur de ce navigateur (localStorage : lus après le montage). */
	let tokens = $state<Record<string, string>>({});
	onMount(() => {
		tokens = getVisitTokens();
	});

	const blocks = $derived(
		BLOCKS.map((b) => ({
			key: b.key,
			label: b.label,
			score: bar.score.blocks[b.key],
			criteria: CRITERIA.filter((c) => c.block === b.key).map((c) => ({
				key: c.key,
				label: c.label,
				score: bar.score.criteria[c.key]
			}))
		}))
	);

	const pricedCount = $derived(visits.filter((v) => v.prixCents !== null).length);
	const topAmbiances = $derived(bar.ambiances.slice(0, 5));
	const terrace = $derived(
		bar.terrace === 'oui' ? 'oui' : bar.terrace === 'non' ? 'non' : 'personne n’a dit'
	);

	function moodOf(value: number | null) {
		return MOODS.find((m) => m.value === value) ?? null;
	}

	function canEdit(id: number): boolean {
		return data.admin || String(id) in tokens;
	}
</script>

<svelte:head>
	<title>{bar.name} · Barathon</title>
</svelte:head>

<article class="container page">
	<header class="head">
		<h1>{bar.name}</h1>
		{#if bar.address}<p class="address">{bar.address}</p>{/if}
	</header>

	<Card class="board" aria-label="Notes">
		<div class="overall">
			<ScoreBadge score={bar.overall} variant="numeral" size="lg" outOf />
			<p class="basis">
				{#if bar.overall === null}
					Pas encore noté
				{:else}
					Moyenne de {plural(bar.visitCount, 'passage')}
				{/if}
			</p>
		</div>

		<div class="blocks">
			{#each blocks as b (b.key)}
				<div class="block">
					<div class="leader block-row">
						<span class="block-name">{b.label}</span>
						<ScoreBadge score={b.score} size="sm" />
					</div>
					{#each b.criteria as c (c.key)}
						<div class="leader crit" class:untested={c.score === null}>
							<span>{c.label}</span>
							<span class="crit-score">{c.score === null ? 'pas testé' : formatScore(c.score)}</span>
						</div>
					{/each}
				</div>
			{/each}
		</div>
	</Card>

	<Button href="/noter?bar={bar.id}" size="lg" full>Noter ce bar</Button>

	<section class="facts" aria-labelledby="facts-title">
		<h2 id="facts-title" class="visually-hidden">En bref</h2>
		<div class="leader fact">
			<span>Terrasse</span>
			<span class="fact-value" class:unknown={bar.terrace === null}>{terrace}</span>
		</div>
		<div class="leader fact">
			<span>Pinte 50 cl</span>
			<span class="fact-value" class:unknown={bar.avgPriceCents === null}>
				{#if bar.avgPriceCents === null}
					pas de prix donné
				{:else}
					{formatPrice(bar.avgPriceCents)}
					<small>en moyenne{pricedCount > 1 ? `, ${pricedCount} prix` : ''}</small>
				{/if}
			</span>
		</div>
		<div class="ambiances">
			<span class="fact-label">Ambiance</span>
			{#if topAmbiances.length}
				<ul class="chips">
					{#each topAmbiances as a (a.slug)}
						<li class="chip">
							{ambianceLabel(a.slug)}
							<span class="count" aria-label="cité {plural(a.count, 'fois', 'fois')}">×{a.count}</span>
						</li>
					{/each}
				</ul>
			{:else}
				<span class="unknown">personne n’a coché d’ambiance</span>
			{/if}
		</div>
	</section>

	<div class="map">
		{#key bar.id}
			<MapView
				center={{ lat: bar.lat, lon: bar.lon }}
				zoom={16}
				markers={[{ id: bar.id, lat: bar.lat, lon: bar.lon, score: bar.overall, title: bar.name }]}
				label="Plan autour de {bar.name}"
			/>
		{/key}
	</div>

	<section class="visits" aria-labelledby="visits-title">
		<h2 id="visits-title">
			Les passages <span class="visits-count">{visits.length}</span>
		</h2>
		{#if visits.length === 0}
			<p class="muted">Personne n’est encore passé par là. Sois le premier !</p>
		{:else}
			<ul class="visit-list">
				{#each visits as v (v.id)}
					{@const mood = moodOf(v.humeur)}
					<li class="visit">
						<ScoreBadge score={v.score} size="sm" />
						<div class="visit-body">
							<p class="visit-who">
								<a href="/barathoniens/{encodeURIComponent(v.pseudoKey)}">{v.pseudo}</a>
								{#if mood}
									<span class="mood" role="img" aria-label="humeur : {mood.label}" title="Humeur : {mood.label}"
										>{mood.emoji}</span
									>
								{/if}
							</p>
							<p class="visit-date"><time datetime={v.date}>{formatDate(v.date)}</time></p>
							{#if v.commentaire}<p class="comment">{v.commentaire}</p>{/if}
						</div>
						{#if canEdit(v.id)}
							<a class="edit" href="/passages/{v.id}/modifier">Modifier</a>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</article>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		padding-block: var(--space-5) var(--space-6);
	}

	/* ---------- En-tête ---------- */

	h1 {
		font-size: clamp(var(--display-md), 11vw, var(--display-lg));
		font-weight: 900;
		line-height: 0.95;
		overflow-wrap: anywhere;
	}
	.address {
		margin-top: var(--space-2);
		color: var(--ink-dim);
	}

	/* ---------- Ardoise des notes ---------- */

	.page :global(.board) {
		display: grid;
		gap: var(--space-5);
		padding: var(--space-5) var(--space-4);
	}
	@media (min-width: 34rem) {
		.page :global(.board) {
			grid-template-columns: auto 1fr;
			align-items: start;
			gap: var(--space-6);
			padding: var(--space-5);
		}
	}

	.overall {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.basis {
		color: var(--ink-dim);
		font-size: var(--text-sm);
	}

	.blocks {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		min-width: 0;
	}
	.block {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.block-row {
		align-items: center;
	}
	.block-row::after {
		transform: none;
	}
	.block-name {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: var(--text-lg);
		line-height: 1.1;
	}
	.crit {
		font-size: var(--text-sm);
		color: var(--ink-dim);
	}
	.crit::after {
		border-bottom-width: 1.5px;
		border-color: var(--line);
	}
	.crit-score {
		font-variant-numeric: tabular-nums;
		font-weight: 700;
		color: var(--ink);
	}
	.crit.untested .crit-score {
		font-weight: 400;
		font-style: italic;
		color: var(--ink-faint);
	}

	/* ---------- En bref ---------- */

	.facts {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.fact > :first-child,
	.fact-label {
		font-weight: 700;
	}
	.fact-value {
		text-align: right;
		font-weight: 700;
	}
	.fact-value small {
		font-weight: 400;
		font-size: var(--text-xs);
		color: var(--ink-dim);
	}
	.unknown {
		font-weight: 400;
		font-style: italic;
		color: var(--ink-faint);
	}
	.ambiances {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.chip {
		display: inline-flex;
		align-items: baseline;
		gap: var(--space-1);
		padding: var(--space-1) var(--space-3);
		border-radius: var(--radius-pill);
		box-shadow: inset 0 0 0 1.5px var(--line);
		font-size: var(--text-sm);
		font-weight: 700;
	}
	.chip:first-child {
		background: var(--accent-soft);
		box-shadow: inset 0 0 0 1.5px var(--accent);
	}
	.count {
		font-weight: 400;
		color: var(--ink-dim);
		font-variant-numeric: tabular-nums;
	}

	/* ---------- Carte ---------- */

	/* MapView impose 200px minimum */
	.map {
		height: 210px;
		border-radius: var(--radius-l);
		overflow: hidden;
		box-shadow: inset 0 0 0 1px var(--line);
	}

	/* ---------- Passages ---------- */

	.visits {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.visits h2 {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
	}
	.visits-count {
		font-size: var(--text-lg);
		color: var(--ink-faint);
	}
	.visit-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.visit {
		display: grid;
		grid-template-columns: 3.4rem minmax(0, 1fr) auto;
		align-items: start;
		gap: var(--space-3);
		padding-block: var(--space-4);
		border-top: 1.5px dashed var(--line);
	}
	.visit :global(.pill) {
		margin-top: 2px;
		justify-self: start;
	}
	.visit-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.visit-who {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.visit-who a {
		color: var(--ink);
		text-decoration-color: var(--line-strong);
	}
	.visit-who a:hover {
		text-decoration-color: var(--accent);
	}
	.mood {
		font-size: 1.2rem;
		line-height: 1;
	}
	.visit-date {
		font-size: var(--text-sm);
		color: var(--ink-dim);
	}
	.comment {
		margin-top: var(--space-2);
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	.edit {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap);
		margin-top: calc(-1 * var(--space-3));
		padding-inline: var(--space-2);
		font-size: var(--text-sm);
		font-weight: 700;
	}
</style>
