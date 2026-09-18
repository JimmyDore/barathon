<!--
  Note affichée avec sa couleur (rampe brique → ambre → blonde, cf. `scoreColor`).
  - variant="pill" : pastille colorée (listes, cartes, marqueurs) ;
  - variant="numeral" : gros chiffre condensé (en-tête de fiche bar).
-->
<script lang="ts">
	import { formatScore, scoreColor } from '$lib/format';

	interface Props {
		score: number | null;
		variant?: 'pill' | 'numeral';
		size?: 'sm' | 'md' | 'lg';
		/** Affiche « /5 » après la note. */
		outOf?: boolean;
		class?: string;
	}

	let { score, variant = 'pill', size = 'md', outOf = false, class: className = '' }: Props = $props();

	const color = $derived(scoreColor(score));
	const text = $derived(formatScore(score));
	const label = $derived(score === null ? 'Pas encore noté' : `Note ${text} sur 5`);
</script>

{#if variant === 'pill'}
	<span
		class="pill {size} {className}"
		class:empty={score === null}
		style:--pill-bg={color.bg}
		style:--pill-fg={color.fg}
		role="img"
		aria-label={label}
	>
		{text}{#if outOf}<small>/5</small>{/if}
	</span>
{:else}
	<span class="numeral {size} {className}" style:--num-color={color.bg} role="img" aria-label={label}>
		<span class="value">{text}</span>{#if outOf}<span class="max">/5</span>{/if}
	</span>
{/if}

<style>
	.pill {
		display: inline-flex;
		align-items: baseline;
		justify-content: center;
		gap: 1px;
		min-width: 2.6em;
		padding: 0.18em 0.5em 0.12em;
		border-radius: var(--radius-pill);
		background: var(--pill-bg);
		color: var(--pill-fg);
		font-family: var(--font-display);
		font-weight: 800;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.pill.empty {
		background: transparent;
		color: var(--ink-faint);
		box-shadow: inset 0 0 0 1.5px var(--line-strong);
	}
	.pill small {
		font-size: 0.62em;
		opacity: 0.75;
	}
	.pill.sm {
		font-size: 1rem;
	}
	.pill.md {
		font-size: 1.25rem;
	}
	.pill.lg {
		font-size: 1.75rem;
	}

	.numeral {
		display: inline-flex;
		align-items: baseline;
		font-family: var(--font-display);
		font-weight: 900;
		line-height: 0.85;
		color: var(--num-color);
		font-variant-numeric: tabular-nums;
	}
	.numeral.sm {
		font-size: var(--display-md);
	}
	.numeral.md {
		font-size: var(--display-lg);
	}
	.numeral.lg {
		font-size: var(--display-xl);
	}
	.max {
		margin-left: 0.08em;
		font-size: 0.34em;
		font-weight: 700;
		color: var(--ink-dim);
	}
	@media (prefers-color-scheme: light) {
		/* les tons clairs de la rampe manquent de contraste sur fond clair */
		.numeral {
			color: color-mix(in srgb, var(--num-color) 62%, #3a2408);
		}
	}
</style>
