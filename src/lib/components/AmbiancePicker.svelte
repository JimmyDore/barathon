<!--
  Ambiances (multi-choix dans la liste fixe). Envoie un champ `ambiances` par case cochée.
  Usage : <AmbiancePicker bind:value={ambiances} />   (value : slugs, ex. ['chill', 'cosy'])
  Aussi utilisable comme filtre (sans `name`, rien n'est envoyé).
-->
<script lang="ts">
	import { AMBIANCES } from '$lib/constants';

	interface Props {
		name?: string;
		label?: string;
		value?: string[];
		error?: string | null;
		onchange?: (value: string[]) => void;
	}

	let { name = 'ambiances', label = 'Ambiances', value = $bindable([]), error = null, onchange }: Props =
		$props();

	const uid = $props.id();

	function toggle(slug: string, on: boolean) {
		value = on ? [...value.filter((s) => s !== slug), slug] : value.filter((s) => s !== slug);
		onchange?.(value);
	}
</script>

<div class="ambiances" role="group" aria-labelledby="{uid}-label">
	<div class="head">
		<span class="label" id="{uid}-label">{label}</span>
		<span class="status">{value.length ? `${value.length} choisie${value.length > 1 ? 's' : ''}` : 'facultatif'}</span>
	</div>
	<div class="chips">
		{#each AMBIANCES as a (a.slug)}
			<label class="chip" class:on={value.includes(a.slug)}>
				<input
					class="visually-hidden"
					type="checkbox"
					{name}
					value={a.slug}
					checked={value.includes(a.slug)}
					onchange={(e) => toggle(a.slug, e.currentTarget.checked)}
				/>
				{a.label}
			</label>
		{/each}
	</div>
	{#if error}<p class="field-error">{error}</p>{/if}
</div>

<style>
	.ambiances {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.head {
		display: flex;
		align-items: baseline;
	}
	.label {
		font-weight: 700;
	}
	.status {
		margin-left: auto;
		font-size: var(--text-sm);
		font-style: italic;
		color: var(--ink-faint);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.chip {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 var(--space-4);
		border-radius: var(--radius-pill);
		background: var(--bg-raised);
		box-shadow: inset 0 0 0 1.5px var(--line);
		font-weight: 700;
		font-size: var(--text-sm);
		cursor: pointer;
		user-select: none;
		transition:
			background-color 120ms,
			box-shadow 120ms,
			color 120ms;
	}
	.chip.on {
		background: var(--accent);
		color: var(--accent-ink);
		box-shadow: none;
	}
	.chip:has(input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
</style>
