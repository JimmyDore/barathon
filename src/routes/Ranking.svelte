<!--
  Classement des bars façon ardoise de bistrot : rang, nom, pointillés, note.
  Dessous : notes par bloc, terrasse, prix de la pinte. Chaque ligne mène à la fiche du bar.
-->
<script lang="ts">
	import ScoreBadge from '$lib/components/ScoreBadge.svelte';
	import { BLOCKS } from '$lib/constants';
	import { formatScore } from '$lib/format';
	import BarFacts from './BarFacts.svelte';
	import type { HomeBar } from './home';

	let { bars }: { bars: HomeBar[] } = $props();
</script>

<ol class="ranking">
	{#each bars as bar, i (bar.id)}
		<li>
			<a class="row" href="/bars/{bar.id}">
				<span class="rank" class:podium={i < 3 && bar.overall !== null} aria-hidden="true">
					{bar.overall === null ? '' : i + 1}
				</span>
				<span class="body">
					<span class="leader title">
						<span class="name">{bar.name}</span>
						<ScoreBadge score={bar.overall} />
					</span>
					<span class="blocks">
						{#each BLOCKS as block (block.key)}
							<span class="block">
								{block.label}
								<b class:none={bar.blocks[block.key] === null}>{formatScore(bar.blocks[block.key])}</b>
							</span>
						{/each}
					</span>
					<BarFacts {bar} />
				</span>
			</a>
		</li>
	{/each}
</ol>

<style>
	.ranking {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li + li {
		border-top: 1px solid var(--line);
	}

	/* le rang s'aligne sur le titre ; le fond au survol déborde un peu de la colonne */
	.row {
		display: grid;
		grid-template-columns: 1.75rem minmax(0, 1fr);
		gap: var(--space-2);
		margin-inline: calc(-1 * var(--space-2));
		padding: var(--space-4) var(--space-2);
		color: inherit;
		text-decoration: none;
		border-radius: var(--radius-m);
		transition: background-color 120ms;
	}
	.row:hover {
		background: color-mix(in srgb, var(--bg-raised) 70%, transparent);
	}
	.row:active {
		background: var(--bg-raised);
	}

	.rank {
		padding-top: 0.1rem;
		font-family: var(--font-display);
		font-size: var(--display-sm);
		font-weight: 800;
		line-height: 1;
		color: var(--ink-faint);
		font-variant-numeric: tabular-nums;
	}
	.rank.podium {
		color: var(--accent-text);
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}

	.name {
		min-width: 0;
		font-family: var(--font-display);
		font-size: var(--text-lg);
		font-weight: 800;
		line-height: 1.1;
		overflow-wrap: anywhere;
	}

	.blocks {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1) var(--space-4);
		font-size: var(--text-sm);
		color: var(--ink-dim);
	}
	.block b {
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.block b.none {
		color: var(--ink-faint);
		font-weight: 400;
	}
</style>
