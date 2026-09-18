<!--
  Fusion d'un doublon : on choisit le bon bar (voisins proches ou recherche par nom
  dans nos bars), on relit ce qui va se passer, on confirme. Les passages du bar
  courant passent sur le bar choisi, puis le bar courant est supprimé.
-->
<script lang="ts">
	import { enhance } from '$app/forms';
	import { tick } from 'svelte';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Button from '$lib/components/Button.svelte';
	import ScoreBadge from '$lib/components/ScoreBadge.svelte';
	import { formatDistance, plural } from '$lib/format';
	import { haversine } from '$lib/geo/distance';

	interface Candidate {
		id: number;
		name: string;
		address: string | null;
		overall: number | null;
		visitCount: number;
		distance: number | null;
	}

	interface Props {
		bar: { id: number; name: string; lat: number; lon: number; visitCount: number };
		nearby: Candidate[];
		radiusM: number;
		error?: string | null;
	}

	let { bar, nearby, radiusM, error = null }: Props = $props();

	let query = $state('');
	let results = $state<Candidate[]>([]);
	let searching = $state(false);
	let searchFailed = $state(false);
	let selected = $state<Candidate | null>(null);
	let pending = $state(false);
	let confirmEl = $state<HTMLElement | null>(null);

	const trimmed = $derived(query.trim());

	$effect(() => {
		const q = trimmed;
		if (q.length < 2) {
			results = [];
			searching = false;
			searchFailed = false;
			return;
		}
		searching = true;
		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const res = await fetch(`/api/bars/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
				if (!res.ok) throw new Error(String(res.status));
				const body = (await res.json()) as {
					bars: { id: number; name: string; address: string | null; lat: number; lon: number; overall: number | null; visitCount: number }[];
				};
				results = body.bars
					.filter((b) => b.id !== bar.id)
					.map((b) => ({
						id: b.id,
						name: b.name,
						address: b.address,
						overall: b.overall,
						visitCount: b.visitCount,
						distance: haversine(bar, b)
					}));
				searchFailed = false;
			} catch {
				if (ctrl.signal.aborted) return;
				results = [];
				searchFailed = true;
			} finally {
				if (!ctrl.signal.aborted) searching = false;
			}
		}, 250);
		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	});

	async function choose(c: Candidate) {
		selected = c;
		await tick();
		confirmEl?.focus();
	}

	const submit: SubmitFunction = () => {
		pending = true;
		return async ({ update }) => {
			await update();
			pending = false;
		};
	};
</script>

{#snippet candidateList(list: Candidate[], label: string)}
	<ul class="candidates" aria-label={label}>
		{#each list as c (c.id)}
			<li>
				<label class="candidate" class:on={selected?.id === c.id}>
					<input
						class="visually-hidden"
						type="radio"
						name="merge-candidate"
						value={c.id}
						checked={selected?.id === c.id}
						onchange={() => choose(c)}
					/>
					<span class="c-body">
						<span class="c-name">{c.name}</span>
						<span class="c-meta">
							{plural(c.visitCount, 'passage')}{#if c.distance !== null}, à {formatDistance(c.distance)}{/if}{#if c.address}, {c.address}{/if}
						</span>
					</span>
					<ScoreBadge score={c.overall} size="sm" />
				</label>
			</li>
		{/each}
	</ul>
{/snippet}

<div class="merge">
	<div class="group">
		<h3>Juste à côté</h3>
		{#if nearby.length}
			{@render candidateList(nearby, 'Bars à moins de ' + formatDistance(radiusM))}
		{:else}
			<p class="muted small">Aucun autre de nos bars à moins de {formatDistance(radiusM)}.</p>
		{/if}
	</div>

	<div class="group">
		<label class="h3" for="merge-search">Ou cherche parmi nos bars</label>
		<input id="merge-search" type="search" placeholder="Nom ou adresse" autocomplete="off" bind:value={query} />
		{#if trimmed.length >= 2}
			<p class="muted small" aria-live="polite">
				{#if searching}
					Recherche…
				{:else if searchFailed}
					La recherche ne répond pas. Réessaie.
				{:else if results.length === 0}
					Aucun autre bar ne s’appelle comme ça.
				{/if}
			</p>
			{#if results.length}{@render candidateList(results, 'Résultats de la recherche')}{/if}
		{/if}
	</div>

	{#if error}<p class="field-error" role="alert">{error}</p>{/if}

	{#if selected}
		<form method="POST" action="?/merge" class="confirm" use:enhance={submit}>
			<input type="hidden" name="into" value={selected.id} />
			<div class="confirm-text" tabindex="-1" bind:this={confirmEl}>
				<p><strong>Fusionner «&nbsp;{bar.name}&nbsp;» dans «&nbsp;{selected.name}&nbsp;»&nbsp;?</strong></p>
				<p>
					{#if bar.visitCount === 0}
						«&nbsp;{bar.name}&nbsp;» n’a aucun passage&nbsp;: il est simplement supprimé.
					{:else}
						{bar.visitCount > 1 ? `Ses ${bar.visitCount} passages passent` : 'Son passage passe'} sur «&nbsp;{selected.name}&nbsp;»,
						puis «&nbsp;{bar.name}&nbsp;» est supprimé.
					{/if}
					Pas de retour en arrière.
				</p>
			</div>
			<div class="actions">
				<Button type="submit" busy={pending}>Fusionner</Button>
				<Button type="button" variant="ghost" onclick={() => (selected = null)}>Annuler</Button>
			</div>
		</form>
	{/if}
</div>

<style>
	.merge {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h3,
	.h3 {
		font-family: var(--font-body);
		font-size: var(--text-md);
		font-weight: 700;
	}
	.small {
		font-size: var(--text-sm);
	}

	.candidates {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.candidate {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--tap-lg);
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-m);
		background: var(--bg);
		box-shadow: inset 0 0 0 1.5px var(--line);
		cursor: pointer;
		transition:
			box-shadow 120ms,
			background-color 120ms;
	}
	.candidate:hover {
		box-shadow: inset 0 0 0 1.5px var(--line-strong);
	}
	.candidate.on {
		background: var(--accent-soft);
		box-shadow: inset 0 0 0 2.5px var(--accent);
	}
	.candidate:has(input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}
	.c-body {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}
	.c-name {
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.c-meta {
		font-size: var(--text-sm);
		color: var(--ink-dim);
		overflow-wrap: anywhere;
	}

	.confirm {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		border-radius: var(--radius-m);
		background: var(--accent-soft);
		box-shadow: inset 3px 0 0 var(--accent);
	}
	.confirm-text {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		overflow-wrap: anywhere;
	}
	.confirm-text:focus-visible {
		outline-offset: 6px;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
