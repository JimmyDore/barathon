<!-- Fiche admin d'un bar : renommer, déplacer, fusionner, supprimer. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Field from '$lib/components/Field.svelte';
	import MapView from '$lib/components/MapView.svelte';
	import { LIMITS } from '$lib/constants';
	import { formatDistance, formatScore, plural } from '$lib/format';
	import { haversine, type LatLon } from '$lib/geo/distance';
	import { MERGE_RADIUS_M } from '../../admin-forms';
	import MergePanel from './MergePanel.svelte';

	let { data, form } = $props();

	const bar = $derived(data.bar);

	/* ---------- Envoi des formulaires (sans vider les champs) ---------- */

	let busy = $state<'rename' | 'move' | 'delete' | null>(null);
	function submitting(action: 'rename' | 'move' | 'delete'): SubmitFunction {
		return () => {
			busy = action;
			return async ({ update }) => {
				await update({ reset: false });
				busy = null;
			};
		};
	}

	const errorFor = (action: string) => (form?.action === action ? (form.error ?? null) : null);
	const successFor = (action: string) => (form?.action === action ? (form.success ?? null) : null);

	/* ---------- Position ---------- */

	/** Épingle : suit la position enregistrée, déplaçable (bind). */
	let pin = $derived<LatLon | null>({ lat: bar.lat, lon: bar.lon });
	const moveDistance = $derived(pin ? haversine(pin, bar) : 0);
	const moved = $derived(moveDistance >= 1);

	/* ---------- Suppression ---------- */

	let confirmingDelete = $state(false);
	let deleteConfirmEl = $state<HTMLElement | null>(null);

	async function askDelete() {
		confirmingDelete = true;
		await tick();
		deleteConfirmEl?.focus();
	}
</script>

<svelte:head>
	<title>{bar.name} · Admin · Barathon</title>
</svelte:head>

{#key bar.id}
	<div class="container page">
		<a class="back" href="/admin#bars"><span class="chev" aria-hidden="true">‹</span><span class="back-label">Admin</span></a>

		<header class="head">
			<h1>{bar.name}</h1>
			<p class="meta">
				{plural(bar.visitCount, 'passage')}, note {formatScore(bar.overall)},
				{bar.source === 'osm' ? `OpenStreetMap ${bar.sourceId ?? ''}` : 'ajouté à la main'}.
				<a href="/bars/{bar.id}">Voir la fiche publique</a>
			</p>
		</header>

		<!-- Après une autre action (renommer, déplacer…), le bandeau de fusion n'a plus lieu d'être. -->
		{#if data.merged && !form}
			<p class="notice" role="status">
				Fusion faite&nbsp;: {plural(data.merged.count, 'passage')} de «&nbsp;{data.merged.from}&nbsp;»
				{data.merged.count > 1 ? 'sont passés' : 'est passé'} ici, et «&nbsp;{data.merged.from}&nbsp;» est supprimé.
			</p>
		{/if}

		<Card>
			<form method="POST" action="?/rename" class="stack" use:enhance={submitting('rename')}>
				<h2>Nom et adresse</h2>
				<Field id="name" label="Nom" error={errorFor('rename')}>
					<input
						id="name"
						name="name"
						type="text"
						value={bar.name}
						maxlength={LIMITS.barNameMax}
						required
						autocomplete="off"
						aria-invalid={errorFor('rename') ? true : undefined}
						aria-describedby={errorFor('rename') ? 'name-error' : undefined}
					/>
				</Field>
				<Field id="address" label="Adresse" hint="Laisse vide si tu ne la connais pas.">
					<input
						id="address"
						name="address"
						type="text"
						value={bar.address ?? ''}
						maxlength={LIMITS.addressMax}
						autocomplete="off"
						aria-describedby="address-hint"
					/>
				</Field>
				<div class="actions">
					<Button type="submit" variant="secondary" busy={busy === 'rename'}>Enregistrer</Button>
					{#if successFor('rename')}<p class="ok" role="status">{successFor('rename')}</p>{/if}
				</div>
			</form>
		</Card>

		<Card>
			<form method="POST" action="?/move" class="stack" use:enhance={submitting('move')}>
				<div class="stack tight">
					<h2>Position</h2>
					<p class="muted small">Fais glisser l’épingle pile sur le bar, ou touche la carte au bon endroit.</p>
				</div>
				<div class="map">
					<MapView
						center={{ lat: bar.lat, lon: bar.lon }}
						zoom={17}
						bind:pin
						onmapclick={(pos) => (pin = pos)}
						label="Position de {bar.name}"
					/>
				</div>
				<input type="hidden" name="lat" value={pin?.lat ?? ''} />
				<input type="hidden" name="lon" value={pin?.lon ?? ''} />
				{#if errorFor('move')}<p class="field-error" role="alert">{errorFor('move')}</p>{/if}
				<p class="moved" aria-live="polite">
					{#if moved}Épingle déplacée de {formatDistance(moveDistance)}.{/if}
				</p>
				<div class="actions">
					<Button type="submit" variant={moved ? 'primary' : 'secondary'} disabled={!moved} busy={busy === 'move'}>
						Enregistrer la position
					</Button>
					{#if moved}
						<Button type="button" variant="ghost" onclick={() => (pin = { lat: bar.lat, lon: bar.lon })}>
							Remettre
						</Button>
					{:else if successFor('move')}
						<p class="ok" role="status">{successFor('move')}</p>
					{/if}
				</div>
			</form>
		</Card>

		<Card>
			<div class="stack">
				<div class="stack tight">
					<h2>Fusionner un doublon</h2>
					<p class="muted small">
						Si «&nbsp;{bar.name}&nbsp;» existe en double, choisis le bon bar&nbsp;: ses passages y passent, puis celui-ci est
						supprimé.
					</p>
				</div>
				<MergePanel {bar} nearby={data.nearby} radiusM={MERGE_RADIUS_M} error={errorFor('merge')} />
			</div>
		</Card>

		<Card tone="outline" class="danger-zone">
			<div class="stack">
				<div class="stack tight">
					<h2>Supprimer ce bar</h2>
					<p class="muted small">Le bar disparaît de la carte avec {plural(bar.visitCount, 'passage')}.</p>
				</div>
				{#if errorFor('delete')}<p class="field-error" role="alert">{errorFor('delete')}</p>{/if}
				{#if !confirmingDelete}
					<div class="actions">
						<Button type="button" variant="danger" onclick={askDelete}>Supprimer ce bar</Button>
					</div>
				{:else}
					<form method="POST" action="?/delete" class="confirm" use:enhance={submitting('delete')}>
						<p class="confirm-text" tabindex="-1" bind:this={deleteConfirmEl}>
							<strong>Supprimer «&nbsp;{bar.name}&nbsp;» et {bar.visitCount > 1 ? `ses ${bar.visitCount} passages` : 'son passage'}&nbsp;?</strong>
							C’est définitif.
						</p>
						<div class="actions">
							<Button type="submit" variant="danger" busy={busy === 'delete'}>Oui, supprimer</Button>
							<Button type="button" variant="secondary" onclick={() => (confirmingDelete = false)}>Annuler</Button>
						</div>
					</form>
				{/if}
			</div>
		</Card>
	</div>
{/key}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		padding-block: var(--space-3) var(--space-6);
	}
	.back {
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
		min-height: var(--tap);
		gap: var(--space-1);
		font-size: var(--text-sm);
		font-weight: 700;
		text-decoration: none;
	}
	.chev {
		font-size: 1.3em;
		line-height: 1;
	}
	.back-label {
		text-decoration: underline;
		text-decoration-thickness: 1px;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: calc(-1 * var(--space-3));
	}
	h1 {
		font-size: clamp(var(--display-md), 10vw, var(--display-lg));
		font-weight: 900;
		line-height: 0.95;
		overflow-wrap: anywhere;
	}
	.meta {
		color: var(--ink-dim);
		font-size: var(--text-sm);
		overflow-wrap: anywhere;
	}
	h2 {
		font-size: var(--display-sm);
	}
	.tight {
		--stack-gap: var(--space-1);
	}
	.small {
		font-size: var(--text-sm);
	}

	.notice {
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-m);
		background: var(--accent-soft);
		box-shadow: inset 3px 0 0 var(--accent);
		font-weight: 700;
		overflow-wrap: anywhere;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}
	.ok {
		color: var(--success);
		font-weight: 700;
		font-size: var(--text-sm);
	}
	.moved {
		font-size: var(--text-sm);
		font-weight: 700;
		color: var(--accent-text);
	}
	.moved:empty {
		display: none;
	}

	.map {
		height: 280px;
		margin-inline: calc(-1 * var(--space-4));
		overflow: hidden;
	}

	.page :global(.danger-zone) {
		border-color: color-mix(in srgb, var(--danger) 45%, var(--line));
	}
	.confirm {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		border-radius: var(--radius-m);
		background: var(--danger-soft);
		box-shadow: inset 3px 0 0 var(--danger);
	}
	.confirm-text {
		overflow-wrap: anywhere;
	}
	.confirm-text:focus-visible {
		outline-offset: 6px;
	}
</style>
