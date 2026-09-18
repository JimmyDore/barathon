<!--
  Liste de bars à choisir d'un tap, façon ardoise de menu : « Les Berthom ······ 40 m ».
  Nos bars déjà notés affichent leur note.
-->
<script lang="ts">
	import ScoreBadge from '$lib/components/ScoreBadge.svelte';
	import { PLACE_CATEGORY_LABELS } from '$lib/constants';
	import { formatDistance, plural } from '$lib/format';
	import type { PlaceOption } from '$lib/geo/merge';

	interface Props {
		options: PlaceOption[];
		onpick: (option: PlaceOption) => void;
		/** Afficher la distance (seulement si elle est calculée depuis la vraie position). */
		showDistance?: boolean;
		label: string;
	}

	let { options, onpick, showDistance = true, label }: Props = $props();

	function details(o: PlaceOption): string {
		const category = o.category ? PLACE_CATEGORY_LABELS[o.category] : o.source === 'manual' ? 'ajouté à la main' : '';
		return [category, o.address].filter(Boolean).join(', ');
	}
</script>

<ul class="places" aria-label={label}>
	{#each options as o (o.key)}
		<li>
			<button type="button" class="place" onclick={() => onpick(o)}>
				<span class="leader line">
					<span class="name">{o.name}</span>
					<span class="dist">{showDistance && o.distance !== null ? formatDistance(o.distance) : ''}</span>
				</span>
				<span class="details">{details(o)}</span>
				{#if o.barId !== null && o.visitCount > 0}
					<span class="known">
						<ScoreBadge score={o.overall} size="sm" />
						<span class="visits">{plural(o.visitCount, 'passage')}</span>
					</span>
				{/if}
			</button>
		</li>
	{/each}
</ul>

<style>
	.places {
		list-style: none;
		margin: 0;
		padding: 0;
		border-top: 1px solid var(--line);
	}
	li {
		border-bottom: 1px solid var(--line);
	}

	.place {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		column-gap: var(--space-3);
		row-gap: 2px;
		width: 100%;
		min-height: var(--tap-lg);
		padding: var(--space-3) var(--space-2);
		border: 0;
		background: none;
		text-align: left;
		cursor: pointer;
		transition: background-color 120ms;
	}
	.place:hover {
		background: var(--accent-soft);
	}
	.place:active {
		background: color-mix(in srgb, var(--accent-soft) 100%, var(--accent) 12%);
	}
	.place:focus-visible {
		outline-offset: -3px;
	}

	.line {
		grid-column: 1 / -1;
		min-width: 0;
	}
	.name {
		min-width: 0;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.375rem;
		line-height: 1.1;
		overflow-wrap: anywhere;
	}
	.dist {
		flex: none;
		color: var(--accent-text);
		font-weight: 700;
		font-size: var(--text-sm);
		font-variant-numeric: tabular-nums;
	}
	.dist:empty {
		display: none;
	}
	/* pas de pointillés sans distance au bout */
	.line:has(.dist:empty)::after {
		display: none;
	}

	.details {
		min-width: 0;
		color: var(--ink-dim);
		font-size: var(--text-sm);
		line-height: 1.35;
	}
	.known {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		justify-self: end;
	}
	.visits {
		color: var(--ink-faint);
		font-size: var(--text-xs);
		white-space: nowrap;
	}
</style>
