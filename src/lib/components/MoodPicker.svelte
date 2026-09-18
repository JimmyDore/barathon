<!--
  Humeur du moment : 😫 😕 😐 🙂 🤩 (1–5), facultative, jamais comptée dans les notes.
  Retoucher l'humeur choisie l'efface. Envoie `humeur` = '1'..'5' ou rien.
  Usage : <MoodPicker bind:value={humeur} />
-->
<script lang="ts">
	import { MOODS } from '$lib/constants';

	interface Props {
		name?: string;
		label?: string;
		value?: number | null;
		error?: string | null;
		onchange?: (value: number | null) => void;
	}

	let { name = 'humeur', label = 'Mon humeur', value = $bindable(null), error = null, onchange }: Props =
		$props();

	const uid = $props.id();
	const current = $derived(MOODS.find((m) => m.value === value));

	function pick(v: number) {
		value = value === v ? null : v;
		onchange?.(value);
	}
</script>

<div class="mood">
	<div class="head">
		<span class="label" id="{uid}-label">{label}</span>
		<span class="status" class:set={!!current} aria-live="polite">{current ? current.label : 'facultatif'}</span>
	</div>
	<div class="faces" role="radiogroup" aria-labelledby="{uid}-label">
		{#each MOODS as m (m.value)}
			<label class="face" class:on={value === m.value} class:dim={value !== null && value !== m.value}>
				<input
					class="visually-hidden"
					type="radio"
					{name}
					value={String(m.value)}
					checked={value === m.value}
					onclick={() => pick(m.value)}
				/>
				<span class="emoji" aria-hidden="true">{m.emoji}</span>
				<span class="visually-hidden">{m.label}</span>
			</label>
		{/each}
	</div>
	{#if error}<p class="field-error">{error}</p>{/if}
</div>

<style>
	.mood {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.head {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
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
	.status.set {
		font-style: normal;
		font-weight: 700;
		color: var(--ink-dim);
	}
	.faces {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: var(--space-2);
	}
	.face {
		display: grid;
		place-items: center;
		height: var(--tap-lg);
		border-radius: var(--radius-m);
		background: var(--bg-raised);
		box-shadow: inset 0 0 0 1.5px var(--line);
		cursor: pointer;
		transition:
			box-shadow 120ms,
			opacity 120ms,
			background-color 120ms;
	}
	.emoji {
		font-size: 1.75rem;
		line-height: 1;
		transition: transform 160ms var(--ease-out);
	}
	.face.on {
		background: var(--accent-soft);
		box-shadow: inset 0 0 0 2.5px var(--accent);
	}
	.face.on .emoji {
		transform: scale(1.18);
	}
	.face.dim {
		opacity: 0.5;
	}
	.face:has(input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
</style>
