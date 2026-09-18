<!--
  Modifier ou supprimer un passage : l'auteur (jeton gardé sur son téléphone) ou l'admin.
-->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import Button from '$lib/components/Button.svelte';
	import VisitFields, { focusFirstError } from '$lib/components/VisitFields.svelte';
	import { forgetVisitToken, getVisitToken } from '$lib/client/storage';
	import { todayInParis } from '$lib/dates';
	import { formatDate } from '$lib/format';
	import { parseVisitForm, type FieldErrors } from '$lib/validation';
	import { visitStateFromValues } from '$lib/visit-form';

	let { data, form } = $props();

	const NETWORK_ERROR = 'Ça n’est pas parti : vérifie ta connexion et réessaie.';

	// Sans JS, après un échec, la page revient avec ce qui a été saisi.
	function initialState() {
		const updateFailed = form && 'values' in form ? form : null;
		const deleteFailed = form && 'deleteFailed' in form ? form : null;
		return {
			values: visitStateFromValues(updateFailed?.values ?? data.values, { today: data.today }),
			errors: (updateFailed?.errors ?? {}) as FieldErrors,
			deleteError: deleteFailed?.errors.form ?? null
		};
	}
	const init = initialState();
	let values = $state(init.values);
	let errors = $state<FieldErrors>(init.errors);
	let deleteError = $state<string | null>(init.deleteError);
	let confirmOpen = $state(init.deleteError !== null);

	/** Jeton d'auteur gardé par ce navigateur (lu après le montage : le serveur ne voit pas localStorage). */
	let token = $state<string | null>(null);
	let ready = $state(false);
	const canEdit = $derived(data.admin || token !== null);
	const mine = $derived(token !== null);

	let saving = $state(false);
	let deleting = $state(false);
	let deleted = $state<{ href: string } | null>(null);
	let formEl = $state<HTMLFormElement>();

	const lastVisitOfBar = $derived(data.bar.visitCount <= 1);
	const fieldErrorCount = $derived(Object.keys(errors).filter((k) => k !== 'form').length);

	onMount(() => {
		token = getVisitToken(data.visitId);
		ready = true;
	});

	async function showErrors() {
		await tick();
		focusFirstError(formEl);
	}

	const update: SubmitFunction = ({ formData, cancel }) => {
		const now = todayInParis();
		const parsed = parseVisitForm(formData, { today: now > data.today ? now : data.today });
		if (!parsed.ok) {
			errors = parsed.errors;
			cancel();
			showErrors();
			return;
		}
		errors = {};
		saving = true;
		return async ({ result }) => {
			saving = false;
			if (result.type === 'redirect') {
				await goto(result.location, { invalidateAll: true });
			} else if (result.type === 'failure') {
				errors = (result.data?.errors as FieldErrors | undefined) ?? { form: 'Ça n’a pas marché. Réessaie.' };
				showErrors();
			} else if (result.type === 'error') {
				errors = { form: NETWORK_ERROR };
				showErrors();
			}
		};
	};

	const remove: SubmitFunction = () => {
		deleting = true;
		deleteError = null;
		return async ({ result }) => {
			deleting = false;
			if (result.type === 'redirect') {
				forgetVisitToken(data.visitId);
				deleted = { href: result.location };
				window.scrollTo({ top: 0 });
			} else if (result.type === 'failure') {
				deleteError = (result.data?.errors as FieldErrors | undefined)?.form ?? 'Ça n’a pas marché. Réessaie.';
			} else if (result.type === 'error') {
				deleteError = NETWORK_ERROR;
			}
		};
	};
</script>

<svelte:head>
	<title>Modifier un passage · {data.bar.name} · Barathon</title>
</svelte:head>

<div class="container page">
	{#if deleted}
		<div class="done" role="status">
			<h1>Passage supprimé.</h1>
			<p class="muted">
				{#if deleted.href === '/'}
					C’était le seul passage noté pour ce bar, alors « {data.bar.name} » quitte la carte aussi.
				{:else}
					Il n’apparaît plus sur la fiche du bar.
				{/if}
			</p>
			<Button href={deleted.href} size="lg">
				{deleted.href === '/' ? 'Retour à la carte' : 'Voir la fiche du bar'}
			</Button>
		</div>
	{:else}
		<header class="head">
			<a class="bar-link" href="/bars/{data.bar.id}">{data.bar.name}</a>
			<h1>
				{mine ? 'Modifier mon passage' : data.admin ? `Modifier le passage de ${data.pseudo}` : 'Modifier un passage'}
			</h1>
			<p class="muted">
				{#if mine}
					Passage du {formatDate(data.date)}.
				{:else}
					Noté par {data.pseudo} le {formatDate(data.date)}{#if data.admin}, et tu es en mode admin{/if}.
				{/if}
			</p>
		</header>

		{#if !canEdit && !ready}
			<p class="muted checking">Je vérifie que c’est bien ton passage…</p>
			<noscript>
				<p class="muted">Il faut JavaScript pour retrouver tes passages sur ce téléphone.</p>
			</noscript>
		{:else if !canEdit}
			<div class="denied">
				<h2>Ce passage n’a pas été noté ici</h2>
				<p>
					Tu ne peux modifier que tes propres passages, depuis le téléphone (et le navigateur) qui les a notés. Si
					tu as changé de téléphone ou vidé les données du navigateur, c’est perdu de ce côté-là.
				</p>
				<p class="muted">Une faute à corriger quand même ? Demande à l’admin.</p>
				<div><Button href="/bars/{data.bar.id}" variant="secondary">Retour à la fiche du bar</Button></div>
			</div>
		{:else}
			<form method="POST" action="?/update" novalidate use:enhance={update} bind:this={formEl}>
				<input type="hidden" name={data.tokenField} value={token ?? ''} />
				<VisitFields bind:values bind:errors today={data.today} />

				<div class="submit">
					{#if errors.form}
						<p class="field-error form-error" role="alert">{errors.form}</p>
					{:else if fieldErrorCount > 0}
						<p class="field-error" role="alert">
							{fieldErrorCount > 1 ? 'Il y a des soucis' : 'Il y a un souci'} plus haut : regarde en rouge.
						</p>
					{/if}
					<Button size="lg" full busy={saving}>Enregistrer les changements</Button>
					<Button href="/bars/{data.bar.id}" variant="secondary" full>Annuler</Button>
				</div>
			</form>

			<section class="danger-zone" aria-labelledby="delete-title">
				<h2 id="delete-title" class="visually-hidden">Supprimer ce passage</h2>
				<details bind:open={confirmOpen}>
					<summary>Supprimer ce passage</summary>
					<form method="POST" action="?/delete" use:enhance={remove} class="confirm">
						<input type="hidden" name={data.tokenField} value={token ?? ''} />
						<p class="question">
							Supprimer ce passage du <span class="nowrap">{formatDate(data.date)}</span> ? C’est définitif.
						</p>
						{#if lastVisitOfBar}
							<p class="muted">C’est le seul passage de ce bar : le bar disparaîtra aussi de la carte.</p>
						{/if}
						{#if deleteError}<p class="field-error" role="alert">{deleteError}</p>{/if}
						<div class="actions">
							<Button variant="danger" full busy={deleting}>Oui, supprimer</Button>
							<Button type="button" variant="secondary" full onclick={() => (confirmOpen = false)}>
								Non, je garde
							</Button>
						</div>
					</form>
				</details>
			</section>
		{/if}
	{/if}
</div>

<style>
	.page {
		padding-block: var(--space-5) var(--space-6);
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding-bottom: var(--space-5);
		margin-bottom: var(--space-5);
		border-bottom: 2px dotted var(--line-strong);
	}
	.bar-link {
		align-self: flex-start;
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.head h1 {
		overflow-wrap: anywhere;
	}

	.checking {
		padding-block: var(--space-5);
	}

	.denied {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}

	.submit {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding-top: var(--space-5);
		border-top: 2px dotted var(--line-strong);
	}

	.danger-zone {
		margin-top: var(--space-7);
		padding-top: var(--space-5);
		border-top: 1px solid var(--line);
	}
	summary {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap);
		padding: 0 var(--space-5);
		border: 2px solid var(--danger);
		border-radius: var(--radius-pill);
		color: var(--danger);
		font-weight: 700;
		list-style: none;
		cursor: pointer;
		user-select: none;
		transition: background-color 120ms;
	}
	summary::-webkit-details-marker {
		display: none;
	}
	summary:hover {
		background: var(--danger-soft);
	}
	details[open] summary {
		border-color: var(--line-strong);
		color: var(--ink-dim);
	}

	.confirm {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-top: var(--space-4);
		padding: var(--space-4);
		border-radius: var(--radius-l);
		background: var(--danger-soft);
		box-shadow: inset 0 0 0 1.5px var(--danger);
	}
	.question {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: var(--display-sm);
		line-height: 1.1;
		text-wrap: balance;
	}
	.nowrap {
		white-space: nowrap;
	}
	.actions {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		margin-top: var(--space-2);
	}

	.done {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-4);
		padding-block: var(--space-6);
	}
</style>
