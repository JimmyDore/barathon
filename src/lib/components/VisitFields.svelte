<!--
  Les champs d'un passage (création sur /noter, modification sur /passages/[id]/modifier).
  À poser dans un <form novalidate> : la vérification se fait avec `parseVisitForm` (et le serveur).
  Usage : <VisitFields bind:values {errors} today={data.today} />
  `values` : cf. `VisitFormState` ($lib/visit-form) ; `errors` : `FieldErrors` ($lib/validation).
  `focusFirstError(form)` (après `await tick()`) amène l'utilisateur sur la première erreur.
-->
<script lang="ts" module>
	/** Fait défiler jusqu'au premier champ en erreur (ou au message général) et le met au focus. */
	export function focusFirstError(root: HTMLElement | null | undefined): void {
		const target =
			root?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? root?.querySelector<HTMLElement>('.form-error');
		if (!target) return;
		target.scrollIntoView({ behavior: 'smooth', block: 'center' });
		const focusable = target.matches('input, textarea') ? target : target.querySelector<HTMLElement>('input');
		focusable?.focus({ preventScroll: true });
	}
</script>

<script lang="ts">
	import { LIMITS } from '$lib/constants';
	import type { FieldErrors, VisitField } from '$lib/validation';
	import type { VisitFormState } from '$lib/visit-form';
	import AmbiancePicker from './AmbiancePicker.svelte';
	import Field from './Field.svelte';
	import MoodPicker from './MoodPicker.svelte';
	import RatingInput from './RatingInput.svelte';
	import TerraceInput from './TerraceInput.svelte';

	interface Props {
		values: VisitFormState;
		/** Erreurs par champ. Bindable : l'erreur d'un champ s'efface dès qu'on le corrige. */
		errors?: FieldErrors;
		/** Date du jour à Paris (borne max du champ date). */
		today: string;
		/** Aide sous le pseudo (ex. « Gardé sur ce téléphone pour la prochaine fois. »). */
		pseudoHint?: string;
	}

	let { values = $bindable(), errors = $bindable({}), today, pseudoHint }: Props = $props();

	const commentLeft = $derived(LIMITS.commentMax - values.commentaire.length);

	/** On retouche un champ en erreur : l'erreur disparaît (le serveur revérifiera tout). */
	function fixed(field: VisitField) {
		if (!errors[field]) return;
		const next = { ...errors };
		delete next[field];
		errors = next;
	}

	function describedBy(id: VisitField, hasHint: boolean): string | undefined {
		const ids = [hasHint ? `${id}-hint` : '', errors[id] ? `${id}-error` : ''].filter(Boolean).join(' ');
		return ids || undefined;
	}
</script>

<div class="visit-fields">
	<fieldset>
		<legend>Moment</legend>
		<RatingInput
			name="soiree"
			label="La soirée"
			required
			hint="La seule note obligatoire. Le reste, si t’as pas testé, laisse vide."
			bind:value={values.soiree}
			error={errors.soiree}
			onchange={() => fixed('soiree')}
		/>
	</fieldset>

	<fieldset>
		<legend>Lieu</legend>
		<RatingInput
			name="beaute"
			label="Beauté"
			bind:value={values.beaute}
			error={errors.beaute}
			onchange={() => fixed('beaute')}
		/>
		<RatingInput
			name="emplacement"
			label="Emplacement"
			bind:value={values.emplacement}
			error={errors.emplacement}
			onchange={() => fixed('emplacement')}
		/>
		<TerraceInput bind:value={values.terrasse} error={errors.terrasse} onchange={() => fixed('terrasse')} />
	</fieldset>

	<fieldset>
		<legend>Bière</legend>
		<RatingInput
			name="choix_bieres"
			label="Choix de bières"
			bind:value={values.choixBieres}
			error={errors.choix_bieres}
			onchange={() => fixed('choix_bieres')}
		/>
		<RatingInput
			name="qualite_biere"
			label="Qualité de la bière"
			bind:value={values.qualiteBiere}
			error={errors.qualite_biere}
			onchange={() => fixed('qualite_biere')}
		/>
		<Field id="prix" label="Prix de la pinte" hint="Pinte 50 cl, en €." error={errors.prix}>
			<div class="price">
				<input
					id="prix"
					name="prix"
					type="text"
					inputmode="decimal"
					autocomplete="off"
					placeholder="6,50"
					maxlength="10"
					bind:value={values.prix}
					oninput={() => fixed('prix')}
					aria-invalid={!!errors.prix}
					aria-describedby={describedBy('prix', true)}
				/>
				<span class="unit" aria-hidden="true">€</span>
			</div>
		</Field>
	</fieldset>

	<fieldset>
		<legend>Ambiance</legend>
		<AmbiancePicker bind:value={values.ambiances} error={errors.ambiances} onchange={() => fixed('ambiances')} />
		<div class="mood">
			<MoodPicker bind:value={values.humeur} error={errors.humeur} onchange={() => fixed('humeur')} />
			<p class="aside">Juste pour info : ton humeur ne compte pas dans la note.</p>
		</div>
		<Field id="commentaire" label="Commentaire" error={errors.commentaire}>
			<textarea
				id="commentaire"
				name="commentaire"
				rows="3"
				maxlength={LIMITS.commentMax}
				placeholder="Le serveur, la musique, le truc à pas rater…"
				bind:value={values.commentaire}
				oninput={() => fixed('commentaire')}
				aria-invalid={!!errors.commentaire}
				aria-describedby={describedBy('commentaire', false)}
			></textarea>
			<p class="count" class:low={commentLeft <= 20}>
				{commentLeft < 0
					? `${-commentLeft} de trop`
					: `${commentLeft} caractère${commentLeft > 1 ? 's' : ''} restant${commentLeft > 1 ? 's' : ''}`}
			</p>
		</Field>
	</fieldset>

	<fieldset>
		<legend>Qui et quand</legend>
		<Field id="pseudo" label="Prénom ou pseudo" required hint={pseudoHint} error={errors.pseudo}>
			<input
				id="pseudo"
				name="pseudo"
				type="text"
				autocomplete="nickname"
				autocapitalize="words"
				maxlength={LIMITS.pseudoMax}
				bind:value={values.pseudo}
				oninput={() => fixed('pseudo')}
				aria-invalid={!!errors.pseudo}
				aria-describedby={describedBy('pseudo', !!pseudoHint)}
			/>
		</Field>
		<Field id="date" label="Date du passage" error={errors.date}>
			<input
				id="date"
				name="date"
				type="date"
				min="2000-01-01"
				max={today}
				bind:value={values.date}
				oninput={() => fixed('date')}
				aria-invalid={!!errors.date}
				aria-describedby={describedBy('date', false)}
			/>
		</Field>
	</fieldset>
</div>

<style>
	.visit-fields {
		display: flex;
		flex-direction: column;
	}

	fieldset {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		min-width: 0;
		margin: 0;
		padding: var(--space-5) 0 var(--space-6);
		border: 0;
		border-top: 2px dotted var(--line-strong);
	}
	fieldset:first-child {
		border-top: 0;
		padding-top: 0;
	}

	legend {
		/* une légende flottante n'est plus dessinée sur la bordure : elle devient
		   le premier élément de la colonne (et profite du `gap`) */
		float: left;
		width: 100%;
		padding: 0;
		font-family: var(--font-display);
		font-weight: 800;
		font-size: var(--display-sm);
		line-height: 1;
		color: var(--ink);
	}

	.price {
		position: relative;
		max-width: 11rem;
	}
	.price input {
		padding-right: 2.5rem;
		font-variant-numeric: tabular-nums;
	}
	.unit {
		position: absolute;
		right: var(--space-4);
		top: 50%;
		transform: translateY(-50%);
		color: var(--ink-dim);
		font-weight: 700;
		pointer-events: none;
	}

	.mood {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.aside {
		font-size: var(--text-sm);
		color: var(--ink-faint);
	}

	.count {
		align-self: flex-end;
		font-size: var(--text-xs);
		color: var(--ink-faint);
		font-variant-numeric: tabular-nums;
	}
	.count.low {
		color: var(--accent-text);
		font-weight: 700;
	}

	input[type='date'] {
		max-width: 14rem;
	}
</style>
