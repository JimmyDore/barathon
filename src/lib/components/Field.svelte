<!--
  Libellé + champ + aide + erreur. Le champ est passé en enfant et doit porter l'`id` donné.
  Ex. : <Field id="pseudo" label="Prénom ou pseudo" error={errors.pseudo}>
          <input id="pseudo" name="pseudo" aria-invalid={!!errors.pseudo} … />
        </Field>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		id: string;
		label: string;
		hint?: string;
		error?: string | null;
		/** Ajoute « obligatoire » à côté du libellé. */
		required?: boolean;
		children: Snippet;
	}

	let { id, label, hint, error = null, required = false, children }: Props = $props();
</script>

<div class="field">
	<label for={id}>
		<span class="label">{label}</span>
		{#if required}<span class="req">obligatoire</span>{/if}
	</label>
	{#if hint}<p class="hint" id="{id}-hint">{hint}</p>{/if}
	{@render children()}
	{#if error}<p class="field-error" id="{id}-error" role="alert">{error}</p>{/if}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}
	label {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		font-weight: 700;
	}
	.req {
		font-weight: 400;
		font-size: var(--text-xs);
		color: var(--accent-text);
	}
	.hint {
		margin-top: calc(-1 * var(--space-1));
		font-size: var(--text-sm);
		color: var(--ink-dim);
	}
</style>
