<!-- Les infos pratiques d'un bar en une ligne : terrasse, prix de la pinte, nombre de passages. -->
<script lang="ts">
	import { formatPrice, plural } from '$lib/format';
	import type { HomeBar } from './home';

	let { bar }: { bar: HomeBar } = $props();
</script>

<ul class="facts">
	{#if bar.terrace === 'oui'}
		<li>
			<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 10a7.5 7.5 0 0 1 15 0zM10 10v7.5M7 17.5h6M10 2.5v-.5" /></svg>
			Terrasse
		</li>
	{:else if bar.terrace === 'non'}
		<li class="faint">Pas de terrasse</li>
	{/if}
	{#if bar.avgPriceCents !== null}
		<li>
			<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2.5h10l-1.4 14.1a1 1 0 0 1-1 .9H7.4a1 1 0 0 1-1-.9zM5.5 7h9" /></svg>
			<span><span class="visually-hidden">Pinte à </span>{formatPrice(bar.avgPriceCents)}</span>
		</li>
	{/if}
	<li class="faint">{plural(bar.visitCount, 'passage')}</li>
</ul>

<style>
	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		margin: 0;
		padding: 0;
		list-style: none;
		font-size: var(--text-sm);
		color: var(--ink);
	}
	li {
		display: inline-flex;
		align-items: center;
		gap: 0.35em;
		white-space: nowrap;
	}
	.faint {
		color: var(--ink-dim);
	}
	svg {
		width: 1.05em;
		height: 1.05em;
		flex: none;
		fill: none;
		stroke: var(--accent-text);
		stroke-width: 1.7;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
</style>
