<!-- Petite carte du bar touché sur la carte : nom, note, infos clés, liens vers la fiche et la notation. -->
<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import ScoreBadge from '$lib/components/ScoreBadge.svelte';
	import { ambianceLabel } from '$lib/constants';
	import BarFacts from './BarFacts.svelte';
	import type { HomeBar } from './home';

	let { bar, onclose }: { bar: HomeBar; onclose: () => void } = $props();

	const uid = $props.id();
</script>

<section class="peek" aria-labelledby="{uid}-name">
	<div class="head">
		<div class="id">
			<h2 id="{uid}-name"><a href="/bars/{bar.id}">{bar.name}</a></h2>
			{#if bar.address}<p class="address">{bar.address}</p>{/if}
		</div>
		<ScoreBadge score={bar.overall} size="lg" />
		<button class="close" type="button" aria-label="Fermer" onclick={onclose}>
			<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
		</button>
	</div>

	<BarFacts {bar} />

	{#if bar.ambiances.length}
		<ul class="tags" aria-label="Ambiances">
			{#each bar.ambiances.slice(0, 3) as slug (slug)}
				<li>{ambianceLabel(slug)}</li>
			{/each}
		</ul>
	{/if}

	<div class="actions">
		<Button href="/bars/{bar.id}">Voir la fiche</Button>
		<Button href="/noter?bar={bar.id}" variant="secondary">Noter ce bar</Button>
	</div>
</section>

<style>
	.peek {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		border-radius: var(--radius-l);
		background: var(--bg-raised);
		box-shadow:
			0 0 0 1px var(--line),
			var(--shadow);
	}

	.head {
		display: flex;
		align-items: flex-start;
		gap: var(--space-3);
	}
	.id {
		flex: 1;
		min-width: 0;
	}
	h2 {
		font-size: var(--display-sm);
		overflow-wrap: anywhere;
	}
	h2 a {
		color: var(--ink);
		text-decoration: none;
	}
	h2 a:hover {
		text-decoration: underline;
		text-decoration-color: var(--accent);
	}
	.address {
		margin-top: var(--space-1);
		color: var(--ink-dim);
		font-size: var(--text-sm);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.close {
		display: grid;
		place-items: center;
		flex: none;
		width: 44px;
		height: 44px;
		margin: calc(-1 * var(--space-2)) calc(-1 * var(--space-2)) 0 0;
		padding: 0;
		border: 0;
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--ink-dim);
		cursor: pointer;
	}
	.close:hover {
		background: var(--bg-sunk);
		color: var(--ink);
	}
	.close svg {
		width: 18px;
		height: 18px;
		stroke: currentColor;
		stroke-width: 2.2;
		stroke-linecap: round;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tags li {
		padding: 0.1rem var(--space-3);
		border-radius: var(--radius-pill);
		box-shadow: inset 0 0 0 1.5px var(--line-strong);
		color: var(--ink-dim);
		font-size: var(--text-xs);
		font-weight: 700;
	}

	.actions {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}
	.actions :global(a.btn) {
		padding-inline: var(--space-3);
	}
</style>
