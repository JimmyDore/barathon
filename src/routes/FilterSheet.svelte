<!--
  Filtres de l'accueil dans un panneau qui monte du bas (<dialog> modale).
  Chaque changement s'applique tout de suite (carte et classement derrière) ;
  le bouton du bas ferme le panneau en annonçant le nombre de bars trouvés.
  Ouverture : `sheet.open()` via bind:this.
-->
<script lang="ts">
	import AmbiancePicker from '$lib/components/AmbiancePicker.svelte';
	import Button from '$lib/components/Button.svelte';
	import { formatPrice, plural } from '$lib/format';
	import {
		countActiveFilters,
		normalizeAmbiances,
		priceToSlider,
		sliderToPrice,
		type HomeFilters,
		type PriceRange
	} from './home';

	interface Props {
		filters: HomeFilters;
		/** Bornes du curseur de prix (null : aucun prix renseigné). */
		range: PriceRange | null;
		/** Nombre de bars qui passent les filtres. */
		count: number;
		/** Applique des filtres (`commit: false` pendant qu'on fait glisser le curseur). */
		onchange: (next: HomeFilters, opts?: { commit?: boolean }) => void;
		onclear: () => void;
	}

	let { filters, range, count, onchange, onclear }: Props = $props();

	const uid = $props.id();
	let dialog = $state<HTMLDialogElement>();

	export function open() {
		dialog?.showModal();
	}

	function close() {
		dialog?.close();
	}

	const priceLabel = $derived(filters.maxPriceCents === null ? 'Peu importe' : formatPrice(filters.maxPriceCents));

	function onPrice(e: Event & { currentTarget: HTMLInputElement }, commit: boolean) {
		if (!range) return;
		onchange({ ...filters, maxPriceCents: sliderToPrice(Number(e.currentTarget.value), range) }, { commit });
	}
</script>

<dialog
	bind:this={dialog}
	class="sheet"
	aria-labelledby="{uid}-title"
	onclick={(e) => {
		// clic sur le fond (hors du panneau)
		if (e.target === dialog) close();
	}}
>
	<div class="panel">
		<header class="top">
			<h2 id="{uid}-title">Filtres</h2>
			<button class="close" type="button" aria-label="Fermer les filtres" onclick={close}>
				<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
			</button>
		</header>

		<div class="body">
			<div class="group">
				<span class="label">Terrasse</span>
				<label class="chip" class:on={filters.terrace}>
					<input
						class="visually-hidden"
						type="checkbox"
						checked={filters.terrace}
						onchange={(e) => onchange({ ...filters, terrace: e.currentTarget.checked })}
					/>
					<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M2.5 10a7.5 7.5 0 0 1 15 0zM10 10v7.5M7 17.5h6" /></svg>
					Avec terrasse
				</label>
			</div>

			<div class="group ambiances">
				<AmbiancePicker
					name=""
					label="Ambiances"
					bind:value={
						() => filters.ambiances,
						(v) => onchange({ ...filters, ambiances: normalizeAmbiances(v) })
					}
				/>
				<p class="hint">Les bars cités avec toutes les ambiances choisies.</p>
			</div>

			<div class="group">
				<div class="price-head">
					<label class="label" for="{uid}-price">Prix max de la pinte</label>
					<output class="price-value" for="{uid}-price" class:any={filters.maxPriceCents === null}>
						{priceLabel}
					</output>
				</div>
				{#if range}
					<input
						id="{uid}-price"
						class="slider"
						type="range"
						min={range.min}
						max={range.max + range.step}
						step={range.step}
						value={priceToSlider(filters.maxPriceCents, range)}
						aria-valuetext={priceLabel}
						oninput={(e) => onPrice(e, false)}
						onchange={(e) => onPrice(e, true)}
					/>
				{:else}
					<p class="hint">Personne n’a encore noté le prix de la pinte.</p>
				{/if}
			</div>
		</div>

		<footer class="bottom">
			<Button variant="ghost" type="button" disabled={countActiveFilters(filters) === 0} onclick={onclear}>
				Tout effacer
			</Button>
			<Button type="button" onclick={close}>
				{count === 0 ? 'Aucun bar' : `Voir ${plural(count, 'bar')}`}
			</Button>
		</footer>
	</div>
</dialog>

<style>
	.sheet {
		width: 100%;
		max-width: var(--content-max);
		max-height: min(88dvh, 44rem);
		margin: auto auto 0;
		padding: 0;
		border: 0;
		border-radius: var(--radius-l) var(--radius-l) 0 0;
		background: var(--bg);
		color: var(--ink);
		box-shadow: 0 -12px 40px -12px rgb(0 0 0 / 0.5);
		overscroll-behavior: contain;
	}
	.sheet[open] {
		display: flex;
		animation: sheet-in 260ms var(--ease-pour);
	}
	.sheet::backdrop {
		background: rgb(12 17 19 / 0.55);
	}
	@keyframes sheet-in {
		from {
			transform: translateY(40%);
			opacity: 0;
		}
	}

	.panel {
		display: flex;
		flex-direction: column;
		width: 100%;
		min-height: 0;
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--space-3) var(--space-3) var(--space-2) var(--space-4);
	}
	/* poignée du panneau */
	.top::before {
		content: '';
		position: absolute;
		top: 6px;
		left: 50%;
		width: 40px;
		height: 4px;
		border-radius: var(--radius-pill);
		background: var(--line-strong);
		transform: translateX(-50%);
	}
	.close {
		display: grid;
		place-items: center;
		width: var(--tap);
		height: var(--tap);
		padding: 0;
		border: 0;
		border-radius: var(--radius-pill);
		background: transparent;
		color: var(--ink-dim);
		cursor: pointer;
	}
	.close:hover {
		background: var(--bg-raised);
		color: var(--ink);
	}
	.close svg {
		width: 20px;
		height: 20px;
		stroke: currentColor;
		stroke-width: 2.2;
		stroke-linecap: round;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		padding: var(--space-2) var(--space-4) var(--space-5);
		overflow-y: auto;
		min-height: 0;
	}
	.group {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
	}
	.ambiances {
		align-items: stretch;
	}
	/* « facultatif » n'a pas de sens pour un filtre */
	.ambiances :global(.status) {
		display: none;
	}
	.label {
		font-weight: 700;
	}
	.hint {
		color: var(--ink-faint);
		font-size: var(--text-sm);
	}

	/* même allure que les puces d'ambiance */
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap);
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
	.chip svg {
		width: 18px;
		height: 18px;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.price-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--space-3);
		width: 100%;
	}
	.price-value {
		font-family: var(--font-display);
		font-size: var(--display-sm);
		font-weight: 800;
		line-height: 1;
		color: var(--accent-text);
		font-variant-numeric: tabular-nums;
	}
	.price-value.any {
		font-size: var(--text-lg);
		color: var(--ink-dim);
	}

	.slider {
		width: 100%;
		height: var(--tap);
		margin: 0;
		background: transparent;
		accent-color: var(--accent);
		cursor: pointer;
		-webkit-appearance: none;
		appearance: none;
	}
	.slider::-webkit-slider-runnable-track {
		height: 8px;
		border-radius: var(--radius-pill);
		background: var(--bg-sunk);
		box-shadow: inset 0 0 0 1px var(--line);
	}
	.slider::-moz-range-track {
		height: 8px;
		border-radius: var(--radius-pill);
		background: var(--bg-sunk);
		box-shadow: inset 0 0 0 1px var(--line);
	}
	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 30px;
		height: 30px;
		margin-top: -11px;
		border: 3px solid var(--bg);
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 2px 6px rgb(0 0 0 / 0.35);
	}
	.slider::-moz-range-thumb {
		width: 24px;
		height: 24px;
		border: 3px solid var(--bg);
		border-radius: 50%;
		background: var(--accent);
		box-shadow: 0 2px 6px rgb(0 0 0 / 0.35);
	}
	.slider:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}

	.bottom {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4) calc(var(--space-3) + env(safe-area-inset-bottom));
		border-top: 1px solid var(--line);
	}
	.bottom :global(button:last-child) {
		flex: 1;
		max-width: 16rem;
	}
</style>
