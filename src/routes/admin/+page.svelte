<!-- Admin : connexion, puis derniers passages et liste des bars. -->
<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Field from '$lib/components/Field.svelte';
	import ScoreBadge from '$lib/components/ScoreBadge.svelte';
	import { formatDate, plural } from '$lib/format';
	import { foldText } from '$lib/text';

	let { data, form } = $props();

	let pending = $state(false);
	const withPending: SubmitFunction = () => {
		pending = true;
		return async ({ update }) => {
			await update();
			pending = false;
		};
	};

	let filter = $state('');
	const filteredBars = $derived.by(() => {
		if (!data.admin) return [];
		const needle = foldText(filter.trim());
		if (!needle) return data.bars;
		return data.bars.filter((b) => foldText(`${b.name} ${b.address ?? ''}`).includes(needle));
	});
</script>

<svelte:head>
	<title>Admin · Barathon</title>
</svelte:head>

{#if !data.admin}
	<div class="container login">
		<header class="head">
			<h1>Admin</h1>
			<p class="muted">
				{data.next ? 'Connecte-toi pour continuer.' : 'Réservé à qui a le mot de passe.'}
			</p>
		</header>
		<Card>
			<form method="POST" action="?/login" class="login-form" use:enhance={withPending}>
				<Field id="password" label="Mot de passe" error={form?.error}>
					<input
						id="password"
						name="password"
						type="password"
						autocomplete="current-password"
						required
						aria-invalid={form?.error ? true : undefined}
						aria-describedby={form?.error ? 'password-error' : undefined}
					/>
				</Field>
				<input type="hidden" name="suite" value={data.next ?? ''} />
				<Button type="submit" size="lg" full busy={pending}>Me connecter</Button>
			</form>
		</Card>
	</div>
{:else}
	<div class="container page">
		<header class="head admin-head">
			<h1>Admin</h1>
			<form method="POST" action="?/logout" use:enhance>
				<Button type="submit" variant="secondary">Me déconnecter</Button>
			</form>
		</header>

		{#if data.deleted}
			<p class="notice" role="status">«&nbsp;{data.deleted}&nbsp;» est supprimé, avec tous ses passages.</p>
		{/if}

		<nav class="jump" aria-label="Sections">
			<a href="#passages">Derniers passages</a>
			<a href="#bars">Bars ({data.bars.length})</a>
		</nav>

		<section id="passages" class="section" aria-labelledby="passages-title">
			<div class="section-head">
				<h2 id="passages-title">Derniers passages</h2>
				<p class="muted small">Les plus récents d’abord. «&nbsp;Modifier&nbsp;» ouvre le passage pour le corriger ou le supprimer.</p>
			</div>
			{#if data.visits.length === 0}
				<p class="muted">Aucun passage pour l’instant.</p>
			{:else}
				<ul class="list">
					{#each data.visits as v (v.id)}
						<li class="row visit">
							<ScoreBadge score={v.score} size="sm" />
							<div class="row-body">
								<a class="row-title" href="/admin/bars/{v.barId}">{v.barName}</a>
								<p class="row-meta">{v.pseudo}, le {formatDate(v.date)}</p>
								{#if v.commentaire}<p class="row-comment">{v.commentaire}</p>{/if}
							</div>
							<a class="row-action" href="/passages/{v.id}/modifier">Modifier</a>
						</li>
					{/each}
				</ul>
			{/if}
		</section>

		<section id="bars" class="section" aria-labelledby="bars-title">
			<div class="section-head">
				<h2 id="bars-title">Bars <span class="count">{data.bars.length}</span></h2>
				<p class="muted small">Renommer, déplacer, fusionner un doublon ou supprimer&nbsp;: ouvre le bar.</p>
			</div>
			{#if data.bars.length === 0}
				<p class="muted">Aucun bar en base.</p>
			{:else}
				<label class="visually-hidden" for="bar-filter">Filtrer les bars</label>
				<input id="bar-filter" type="search" placeholder="Filtrer par nom ou adresse" bind:value={filter} autocomplete="off" />
				{#if filteredBars.length === 0}
					<p class="muted">Aucun bar ne correspond à «&nbsp;{filter}&nbsp;».</p>
				{:else}
					<ul class="list">
						{#each filteredBars as b (b.id)}
							<li class="row bar">
								<div class="row-body">
									<a class="row-title stretch" href="/admin/bars/{b.id}">{b.name}</a>
									<p class="row-meta">
										{plural(b.visitCount, 'passage')}{#if b.address}, {b.address}{/if}
									</p>
								</div>
								<ScoreBadge score={b.overall} size="sm" />
							</li>
						{/each}
					</ul>
				{/if}
			{/if}
		</section>
	</div>
{/if}

<style>
	.login {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		max-width: 26rem;
		padding-block: var(--space-6);
	}
	.login-form {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h1 {
		font-size: var(--display-lg);
		font-weight: 900;
	}

	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		padding-block: var(--space-5) var(--space-6);
	}
	.admin-head {
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		flex-wrap: wrap;
		gap: var(--space-3);
	}

	.notice {
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-m);
		background: var(--accent-soft);
		box-shadow: inset 3px 0 0 var(--accent);
		font-weight: 700;
	}

	.jump {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
	}
	.jump a {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap);
		font-weight: 700;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		scroll-margin-top: calc(var(--header-h) + var(--space-4));
	}
	.section-head {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
	}
	.section h2 {
		display: flex;
		align-items: baseline;
		gap: var(--space-2);
	}
	.count {
		font-size: var(--text-lg);
		color: var(--ink-faint);
	}
	.small {
		font-size: var(--text-sm);
	}

	.list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.row {
		position: relative;
		display: grid;
		align-items: center;
		gap: var(--space-3);
		padding-block: var(--space-3);
		border-top: 1.5px dashed var(--line);
	}
	.row.visit {
		grid-template-columns: 3.4rem minmax(0, 1fr) auto;
		align-items: start;
	}
	.row.visit :global(.pill) {
		margin-top: 2px;
		justify-self: start;
	}
	.row.bar {
		grid-template-columns: minmax(0, 1fr) auto;
		min-height: var(--tap-lg);
	}
	.row-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.row-title {
		font-weight: 700;
		color: var(--ink);
		text-decoration-color: var(--line-strong);
		overflow-wrap: anywhere;
	}
	.row-title:hover {
		text-decoration-color: var(--accent);
	}
	/* toute la ligne du bar est cliquable */
	.stretch::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.row-meta {
		font-size: var(--text-sm);
		color: var(--ink-dim);
		overflow-wrap: anywhere;
	}
	.row-comment {
		font-size: var(--text-sm);
		font-style: italic;
		color: var(--ink-dim);
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		overflow-wrap: anywhere;
	}
	.row-action {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap);
		margin-top: calc(-1 * var(--space-2));
		padding-inline: var(--space-2);
		font-size: var(--text-sm);
		font-weight: 700;
	}
</style>
