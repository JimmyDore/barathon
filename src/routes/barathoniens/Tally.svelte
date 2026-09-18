<!--
  Bâtons comptés à la craie, par paquets de 5 (4 traits + 1 en travers).
  Décoratif : le nombre exact est toujours écrit à côté.
-->
<script lang="ts">
	import { tallyGroups } from './ranking';

	interface Props {
		count: number;
		/** Bâtons dessinés au maximum. */
		max?: number;
	}

	let { count, max = 20 }: Props = $props();

	const tally = $derived(tallyGroups(count, max));
	/** Petit tremblé de la main, toujours le même. */
	const X = [5, 12, 19, 26];
	const TILT = [0.7, -0.5, 0.9, -0.8];
</script>

<span class="tally" aria-hidden="true">
	{#each tally.groups as size, g (g)}
		<svg viewBox="0 0 32 24" width="32" height="24">
			{#each X.slice(0, Math.min(size, 4)) as x, i (i)}
				<line x1={x + TILT[(i + g) % 4]} y1="3" x2={x - TILT[(i + g) % 4]} y2="21" />
			{/each}
			{#if size === 5}
				<line class="strike" x1="1" y1="17.5" x2="31" y2="6.5" />
			{/if}
		</svg>
	{/each}
	{#if tally.overflow > 0}<span class="more">+{tally.overflow}</span>{/if}
</span>

<style>
	.tally {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px 6px;
		color: var(--ink-dim);
	}
	svg {
		display: block;
		overflow: visible;
	}
	line {
		stroke: currentColor;
		stroke-width: 2.4;
		stroke-linecap: round;
	}
	.strike {
		stroke: var(--accent-text);
	}
	.more {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: var(--text-md);
		line-height: 1;
	}
</style>
