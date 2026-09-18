<!--
  Bouton ou lien-bouton. Avec `href`, rend un <a>, sinon un <button>
  (type HTML par défaut : submit dans un formulaire ; passe type="button" sinon).
  Variantes : primary (ambre, l'action principale), secondary (contour), ghost (texte), danger.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes, HTMLButtonAttributes } from 'svelte/elements';

	type Common = {
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		size?: 'md' | 'lg';
		/** Pleine largeur. */
		full?: boolean;
		/** Affiche un indicateur de chargement et désactive le bouton. */
		busy?: boolean;
		children: Snippet;
		class?: string;
	};
	type Props =
		| (Common & HTMLAnchorAttributes & { href: string })
		| (Common & HTMLButtonAttributes & { href?: undefined });

	let {
		variant = 'primary',
		size = 'md',
		full = false,
		busy = false,
		children,
		class: className = '',
		...rest
	}: Props = $props();
</script>

{#if rest.href !== undefined}
	<a class="btn {variant} {size} {className}" class:full {...rest as HTMLAnchorAttributes}>
		{@render children()}
	</a>
{:else}
	<button
		class="btn {variant} {size} {className}"
		class:full
		class:busy
		aria-busy={busy || undefined}
		{...rest as HTMLButtonAttributes}
		disabled={(rest as HTMLButtonAttributes).disabled || busy}
	>
		{@render children()}
	</button>
{/if}

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--tap);
		padding: 0 var(--space-5);
		border: 2px solid transparent;
		border-radius: var(--radius-pill);
		font-family: var(--font-body);
		font-size: var(--text-md);
		font-weight: 700;
		line-height: 1.1;
		text-align: center;
		text-decoration: none;
		cursor: pointer;
		user-select: none;
		transition:
			background-color 120ms,
			border-color 120ms,
			transform 80ms var(--ease-out);
	}
	.btn:active:not(:disabled) {
		transform: scale(0.97);
	}
	.btn:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}
	.lg {
		min-height: var(--tap-lg);
		padding: 0 var(--space-6);
		font-size: var(--text-lg);
	}
	.full {
		width: 100%;
	}

	.primary {
		background: var(--accent);
		color: var(--accent-ink);
		box-shadow: 0 -3px 0 rgb(0 0 0 / 0.14) inset;
	}
	.primary:hover:not(:disabled) {
		background: var(--accent-strong);
	}

	.secondary {
		background: transparent;
		border-color: var(--line-strong);
		color: var(--ink);
	}
	.secondary:hover:not(:disabled) {
		border-color: var(--ink-dim);
	}

	.ghost {
		background: transparent;
		color: var(--accent-text);
		padding-inline: var(--space-3);
	}
	.ghost:hover:not(:disabled) {
		background: var(--accent-soft);
	}

	.danger {
		background: transparent;
		border-color: var(--danger);
		color: var(--danger);
	}
	.danger:hover:not(:disabled) {
		background: var(--danger-soft);
	}

	.busy::after {
		content: '';
		width: 1em;
		height: 1em;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 700ms linear infinite;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
