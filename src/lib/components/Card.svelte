<!--
  Surface posée sur l'ardoise. À utiliser avec parcimonie : pour un groupe
  d'infos qui va ensemble (pas pour chaque ligne d'une liste).
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** Élément HTML rendu (section, article, li, div…). */
		as?: string;
		/** raised = fond relevé ; outline = simple contour ; sunk = creux. */
		tone?: 'raised' | 'outline' | 'sunk';
		/** Marges internes (défaut : oui). */
		padded?: boolean;
		class?: string;
		children: Snippet;
		[key: string]: unknown;
	}

	let { as = 'section', tone = 'raised', padded = true, class: className = '', children, ...rest }: Props =
		$props();
</script>

<svelte:element this={as} class="card {tone} {className}" class:padded {...rest}>
	{@render children()}
</svelte:element>

<style>
	.card {
		border-radius: var(--radius-l);
		min-width: 0;
	}
	.padded {
		padding: var(--space-4);
	}
	.raised {
		background: var(--bg-raised);
		box-shadow: var(--shadow);
	}
	.outline {
		border: 1.5px solid var(--line);
	}
	.sunk {
		background: var(--bg-sunk);
	}
</style>
