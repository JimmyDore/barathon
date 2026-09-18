<!--
  /noter : étape 1 choisir le bar (JS), étape 2 noter le passage (marche aussi sans JS avec ?bar=<id>).
-->
<script lang="ts">
	import { tick, onMount } from 'svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { enhance } from '$app/forms';
	import { goto, pushState } from '$app/navigation';
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';
	import PintCelebration from '$lib/components/PintCelebration.svelte';
	import ScoreBadge from '$lib/components/ScoreBadge.svelte';
	import VisitFields, { focusFirstError } from '$lib/components/VisitFields.svelte';
	import { getSavedPseudo, savePseudo, saveVisitToken } from '$lib/client/storage';
	import { PLACE_CATEGORY_LABELS } from '$lib/constants';
	import { todayInParis } from '$lib/dates';
	import { plural } from '$lib/format';
	import { barToOption, optionToFormFields, type PlaceOption } from '$lib/geo/merge';
	import { HONEYPOT_FIELD, parseBarChoice, parseVisitForm, type FieldErrors } from '$lib/validation';
	import { visitStateFromValues } from '$lib/visit-form';
	import BarPicker from './BarPicker.svelte';
	import { noterState } from './state';

	let { data, form } = $props();

	type Saved = { ok: true; visitId: number; barId: number; token: string; score: number | null };

	/* ---------- Étapes ---------- */

	const chosen = $derived(noterState(page.state).noterChoice ?? (data.bar ? barToOption(data.bar) : null));
	const hiddenFields = $derived(chosen ? Object.entries(optionToFormFields(chosen)) : []);
	const chosenDetails = $derived.by(() => {
		if (!chosen) return '';
		const category = chosen.category
			? PLACE_CATEGORY_LABELS[chosen.category]
			: chosen.barId === null && chosen.source === 'manual'
				? 'nouveau bar'
				: '';
		return [category, chosen.address].filter(Boolean).join(', ');
	});

	/** On garde l'étape 1 montée une fois vue : le retour y retrouve la recherche. */
	let pickerSeen = $state(false);
	$effect.pre(() => {
		if (!chosen) pickerSeen = true;
	});
	const showPicker = $derived(!chosen || pickerSeen);

	let titleEl = $state<HTMLElement>();

	async function pick(option: PlaceOption) {
		// L'option vient souvent d'un $state (proxy) : l'historique veut un objet clonable.
		pushState('', $state.snapshot({ ...page.state, noterChoice: option }));
		await tick();
		window.scrollTo({ top: 0 });
		titleEl?.focus({ preventScroll: true });
	}

	function changeBar() {
		if (noterState(page.state).noterChoice) history.back();
		else goto('/noter');
	}

	/* ---------- Formulaire ---------- */

	// Sans JS, après un échec, la page revient avec ce qui a été saisi.
	function initialState() {
		const failed = form && 'errors' in form ? form : null;
		return {
			values: visitStateFromValues(failed?.values ?? {}, { today: data.today }),
			errors: (failed?.errors ?? {}) as FieldErrors
		};
	}
	const init = initialState();
	let values = $state(init.values);
	let errors = $state<FieldErrors>(init.errors);
	let submitting = $state(false);
	let celebration = $state<{ score: number | null; href: string } | null>(null);
	let formEl = $state<HTMLFormElement>();

	/** Succès sans JS (avec JS, on part directement vers la fiche du bar). */
	const savedWithoutJs = $derived(form && 'token' in form ? (form as Saved) : null);
	const fieldErrorCount = $derived(Object.keys(errors).filter((k) => k !== 'form').length);

	onMount(() => {
		if (!values.pseudo) values.pseudo = getSavedPseudo();
	});

	async function showErrors() {
		await tick();
		focusFirstError(formEl);
	}

	const submit: SubmitFunction = ({ formData, cancel }) => {
		// Même vérification que le serveur, tout de suite (et sans consommer la limite anti-spam).
		const now = todayInParis();
		const today = now > data.today ? now : data.today;
		const bar = parseBarChoice(formData);
		const visit = parseVisitForm(formData, { today });
		if (!bar.ok || !visit.ok) {
			errors = { ...(visit.ok ? {} : visit.errors), ...(bar.ok ? {} : { form: bar.error }) };
			cancel();
			showErrors();
			return;
		}
		errors = {};
		submitting = true;

		return async ({ result }) => {
			submitting = false;
			if (result.type === 'success' && result.data && 'token' in result.data) {
				const saved = result.data as Saved;
				if (saved.visitId > 0) saveVisitToken(saved.visitId, saved.token);
				savePseudo(values.pseudo);
				celebration = { score: saved.score, href: saved.barId > 0 ? `/bars/${saved.barId}` : '/' };
			} else if (result.type === 'failure') {
				errors = (result.data?.errors as FieldErrors | undefined) ?? { form: 'Ça n’a pas marché. Réessaie.' };
				showErrors();
			} else if (result.type === 'redirect') {
				goto(result.location);
			} else {
				errors = { form: 'Ça n’est pas parti : vérifie ta connexion et réessaie. Tes notes sont toujours là.' };
				showErrors();
			}
		};
	};

	function afterCelebration() {
		const href = celebration?.href ?? '/';
		// Laisse le temps de lire « Santé ! » avant de partir.
		setTimeout(() => goto(href), 700);
	}
</script>

<svelte:head>
	<title>{chosen ? `Noter ${chosen.name}` : 'Noter un bar'} · Barathon</title>
</svelte:head>

<div class="container page">
	{#if savedWithoutJs}
		<div class="done">
			<h1>Santé !</h1>
			<p>Ton passage est enregistré.</p>
			<Button href={savedWithoutJs.barId > 0 ? `/bars/${savedWithoutJs.barId}` : '/'} size="lg">
				Voir la fiche du bar
			</Button>
		</div>
	{:else}
		{#if showPicker}
			<div hidden={!!chosen}>
				<BarPicker
					onpick={pick}
					notice={data.missingBar ? 'Ce bar n’existe pas (ou plus). Choisis-en un autre.' : null}
				/>
				<noscript>
					<p class="noscript">
						Pour choisir le bar, il faut JavaScript. Sinon, passe par la fiche du bar et son bouton « Noter ce bar ».
					</p>
				</noscript>
			</div>
		{/if}

		{#if chosen}
			<header class="bar-head">
				<h1 tabindex="-1" bind:this={titleEl}>{chosen.name}</h1>
				{#if chosenDetails}<p class="muted">{chosenDetails}</p>{/if}
				<div class="bar-meta">
					{#if chosen.barId !== null && chosen.visitCount > 0}
						<span class="known">
							<ScoreBadge score={chosen.overall} size="sm" />
							<span class="muted">{plural(chosen.visitCount, 'passage')}</span>
						</span>
					{/if}
					<Button type="button" variant="ghost" onclick={changeBar}>Changer de bar</Button>
				</div>
			</header>

			<form method="POST" novalidate use:enhance={submit} bind:this={formEl} class="visit-form">
				{#each hiddenFields as [name, value] (name)}
					<input type="hidden" {name} {value} />
				{/each}
				<div class="honeypot" aria-hidden="true">
					<label>Ne pas remplir <input name={HONEYPOT_FIELD} tabindex="-1" autocomplete="off" /></label>
				</div>

				<VisitFields
					bind:values
					bind:errors
					today={data.today}
					pseudoHint="Gardé sur ce téléphone pour la prochaine fois."
				/>

				<div class="submit">
					{#if errors.form}
						<p class="field-error form-error" role="alert">{errors.form}</p>
					{:else if fieldErrorCount > 0}
						<p class="field-error" role="alert">
							{fieldErrorCount > 1 ? 'Il y a des soucis' : 'Il y a un souci'} plus haut : regarde en rouge.
						</p>
					{/if}
					<Button size="lg" full busy={submitting}>Enregistrer mon passage</Button>
				</div>
			</form>
		{/if}
	{/if}
</div>

<PintCelebration open={celebration !== null} score={celebration?.score ?? null} ondone={afterCelebration} />

<style>
	.page {
		padding-block: var(--space-5) var(--space-6);
	}

	.bar-head {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-bottom: var(--space-5);
		margin-bottom: var(--space-5);
		border-bottom: 2px dotted var(--line-strong);
	}
	.bar-head h1 {
		font-size: var(--display-md);
		overflow-wrap: anywhere;
	}
	.bar-head h1:focus {
		outline: none;
	}
	.bar-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-4);
	}
	/* le bouton « fantôme » a une marge interne : on aligne son texte sur le bord du contenu */
	.bar-meta > :global(.btn:first-child) {
		margin-left: calc(-1 * var(--space-3));
	}
	.bar-meta > :global(.btn:not(:first-child)) {
		margin-right: calc(-1 * var(--space-3));
	}
	.known {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
	}

	.submit {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-top: var(--space-5);
		border-top: 2px dotted var(--line-strong);
	}

	.done {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-4);
		padding-block: var(--space-7);
	}
	.done h1 {
		font-size: var(--display-lg);
	}

	.noscript {
		margin-top: var(--space-5);
		color: var(--ink-dim);
	}
</style>
