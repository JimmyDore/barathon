<!--
  Note de 1 à 5 en « jauge » : cinq grosses cases qui se remplissent comme une pinte.
  - Toucher une case choisit la note ; retoucher la même case revient à « pas testé » (null).
  - Envoie le champ `name` (radio natif) : '1'..'5', rien si pas testé.
  - `noneLabel` ajoute une option « aucun » (valeur 0, envoyée 'none') : c'est ce que fait TerraceInput.
  Usage : <RatingInput name="beaute" label="Beauté" bind:value={beaute} />
-->
<script lang="ts">
	import { RATING_WORDS, TERRASSE_NONE, TERRASSE_NONE_FORM_VALUE } from '$lib/constants';

	interface Props {
		/** Nom du champ de formulaire (ex. 'beaute', 'choix_bieres', 'soiree'). */
		name: string;
		label: string;
		/** 1–5, null = pas testé, 0 = option « aucun » (si `noneLabel`). Bindable. */
		value?: number | null;
		/** Affiche « obligatoire » (la vérification reste côté serveur). */
		required?: boolean;
		hint?: string;
		error?: string | null;
		/** Libellé de l'option « aucun » (valeur 0), ex. « Pas de terrasse ». */
		noneLabel?: string;
		onchange?: (value: number | null) => void;
	}

	let {
		name,
		label,
		value = $bindable(null),
		required = false,
		hint,
		error = null,
		noneLabel,
		onchange
	}: Props = $props();

	const uid = $props.id();
	const levels = [1, 2, 3, 4, 5];

	const isNone = $derived(noneLabel !== undefined && value === TERRASSE_NONE);
	const level = $derived(value !== null && value >= 1 && value <= 5 ? value : 0);
	const status = $derived(
		value === null ? 'pas testé' : isNone ? (noneLabel ?? '').toLowerCase() : RATING_WORDS[level]
	);

	function set(next: number | null) {
		value = next;
		onchange?.(next);
	}

	function pick(n: number) {
		set(value === n ? null : n);
	}
</script>

<div class="rating" class:invalid={!!error}>
	<div class="head">
		<span class="label" id="{uid}-label">{label}</span>
		{#if required}<span class="req">obligatoire</span>{/if}
		<span class="status" class:set={value !== null} aria-live="polite">{status}</span>
		{#if value !== null}
			<button type="button" class="clear" onclick={() => set(null)} aria-label="Effacer la note {label}">
				effacer
			</button>
		{/if}
	</div>
	{#if hint}<p class="hint" id="{uid}-hint">{hint}</p>{/if}

	<div
		class="gauge"
		class:none={isNone}
		role="radiogroup"
		aria-labelledby="{uid}-label"
		aria-required={required}
		aria-invalid={!!error}
		aria-describedby={error ? `${uid}-error` : hint ? `${uid}-hint` : undefined}
	>
		{#each levels as n (n)}
			<label class="cell" class:filled={n <= level} class:top={n === level} style:--i={n}>
				<input
					class="visually-hidden"
					type="radio"
					{name}
					value={String(n)}
					checked={value === n}
					onclick={() => pick(n)}
				/>
				<span class="num" aria-hidden="true">{n}</span>
				<span class="visually-hidden">{n} sur 5, {RATING_WORDS[n]}</span>
			</label>
		{/each}
	</div>

	{#if noneLabel}
		<label class="none-chip" class:on={isNone}>
			<input
				class="visually-hidden"
				type="radio"
				{name}
				value={TERRASSE_NONE_FORM_VALUE}
				checked={isNone}
				onclick={() => pick(TERRASSE_NONE)}
			/>
			<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 4l12 12M16 4L4 16" /></svg>
			{noneLabel}
		</label>
	{/if}

	{#if error}<p class="field-error" id="{uid}-error">{error}</p>{/if}
</div>

<style>
	.rating {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
		min-height: 1.5rem;
	}
	.label {
		font-weight: 700;
	}
	.req {
		font-size: var(--text-xs);
		color: var(--accent-text);
	}
	.status {
		margin-left: auto;
		font-size: var(--text-sm);
		color: var(--ink-faint);
		font-style: italic;
	}
	.status.set {
		color: var(--accent-text);
		font-style: normal;
		font-weight: 700;
	}
	.clear {
		position: relative;
		border: 0;
		background: none;
		padding: 0;
		font-size: var(--text-xs);
		color: var(--ink-dim);
		text-decoration: underline;
		text-underline-offset: 0.2em;
		cursor: pointer;
	}
	.clear::before {
		/* zone tactile élargie */
		content: '';
		position: absolute;
		inset: -14px -10px;
	}
	.hint {
		font-size: var(--text-sm);
		color: var(--ink-dim);
	}

	/* ---------- La jauge ---------- */

	.gauge {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 3px;
		padding: 3px;
		border-radius: calc(var(--radius-m) + 3px);
		background: var(--bg-sunk);
		box-shadow: inset 0 0 0 1.5px var(--line);
	}
	.invalid .gauge {
		box-shadow: inset 0 0 0 2px var(--danger);
	}

	.cell {
		position: relative;
		display: grid;
		place-items: center;
		height: var(--tap-lg);
		border-radius: 4px;
		background: var(--bg-raised);
		overflow: hidden;
		cursor: pointer;
		isolation: isolate;
	}
	.cell:first-child {
		border-radius: var(--radius-m) 4px 4px var(--radius-m);
	}
	.cell:last-child {
		border-radius: 4px var(--radius-m) var(--radius-m) 4px;
	}

	/* la bière : monte du fond de chaque case, case après case */
	.cell::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: -1;
		background: linear-gradient(to top, #d9811a, var(--accent) 70%, #f7c35e);
		transform: scaleY(0);
		transform-origin: bottom;
		transition: transform 180ms var(--ease-pour);
	}
	.cell.filled::before {
		transform: scaleY(1);
		transition-delay: calc((var(--i) - 1) * 45ms);
	}

	/* la mousse : sur la dernière case remplie (bande + bord festonné) */
	.cell::after {
		content: '';
		position: absolute;
		inset: 0 0 auto;
		height: 13px;
		z-index: -1;
		background:
			radial-gradient(circle at 50% 7px, var(--foam) 4.5px, transparent 5px) 0 0 / 10px 13px repeat-x,
			linear-gradient(var(--foam), var(--foam)) 0 0 / 100% 7px no-repeat;
		transform: translateY(-100%);
		transition: transform 160ms var(--ease-out);
	}
	.cell.top::after {
		transform: translateY(0);
		transition-delay: calc((var(--i) - 1) * 45ms + 140ms);
	}

	.num {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: 1.5rem;
		line-height: 1;
		color: var(--ink-dim);
		transition: color 120ms;
	}
	.cell.filled .num {
		color: var(--accent-ink);
		transition-delay: calc((var(--i) - 1) * 45ms);
	}
	.cell.top .num {
		transform: translateY(3px);
	}

	.cell:hover:not(.filled) {
		background: color-mix(in srgb, var(--bg-raised) 80%, var(--accent));
	}
	.cell:has(input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: -3px;
	}

	.gauge.none .cell {
		background: repeating-linear-gradient(
			-45deg,
			var(--bg-raised) 0 6px,
			var(--bg-sunk) 6px 12px
		);
	}
	.gauge.none .num {
		color: var(--ink-faint);
	}

	/* ---------- Option « aucun » ---------- */

	.none-chip {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 44px;
		padding: 0 var(--space-4);
		border-radius: var(--radius-pill);
		border: 1.5px solid var(--line-strong);
		color: var(--ink-dim);
		font-size: var(--text-sm);
		font-weight: 700;
		cursor: pointer;
		transition:
			background-color 120ms,
			color 120ms,
			border-color 120ms;
	}
	.none-chip svg {
		width: 14px;
		height: 14px;
		stroke: currentColor;
		stroke-width: 2.5;
		stroke-linecap: round;
		fill: none;
	}
	.none-chip.on {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--bg);
	}
	.none-chip:has(input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
</style>
