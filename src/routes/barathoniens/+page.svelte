<!-- Classement des barathoniens : bars différents, puis passages. -->
<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import { plural } from '$lib/format';
	import Tally from './Tally.svelte';
	import { competitionRanks, isTied } from './ranking';

	let { data } = $props();

	const people = $derived(data.people);
	const ranks = $derived(competitionRanks(people));
	const totalVisits = $derived(people.reduce((n, p) => n + p.visitCount, 0));
</script>

<svelte:head>
	<title>Barathoniens · Barathon</title>
</svelte:head>

<div class="container page">
	<header class="head">
		<h1>Barathoniens</h1>
		<p class="muted">
			Qui a écumé le plus de bars&nbsp;? On compte les bars différents, et à égalité, les passages.
		</p>
	</header>

	{#if people.length === 0}
		<div class="empty">
			<p>Personne n’a encore noté de bar. Le classement t’attend.</p>
			<Button href="/noter" size="lg">Noter un bar</Button>
		</div>
	{:else}
		<p class="total">
			{plural(people.length, 'barathonien')}, {plural(totalVisits, 'passage')} au compteur.
		</p>

		<ol class="ranking">
			{#each people as p, i (p.key)}
				<li class="row" class:first={ranks[i] === 1}>
					<span class="rank">
						<span class="rank-num">{ranks[i]}</span>
						{#if isTied(ranks, i)}<span class="tie">ex æquo</span>{/if}
					</span>
					<div class="who">
						<a class="name" href="/barathoniens/{encodeURIComponent(p.key)}">{p.name}</a>
						<Tally count={p.barCount} />
					</div>
					<p class="counts">
						<span class="bars"><strong>{p.barCount}</strong> {p.barCount > 1 ? 'bars' : 'bar'}</span>
						<span class="visits">{plural(p.visitCount, 'passage')}</span>
					</p>
				</li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		padding-block: var(--space-5) var(--space-6);
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h1 {
		font-size: clamp(var(--display-md), 12vw, var(--display-lg));
		font-weight: 900;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-4);
		padding-block: var(--space-5);
	}
	.total {
		color: var(--ink-dim);
		font-size: var(--text-sm);
	}

	.ranking {
		margin: 0;
		padding: 0;
		list-style: none;
		counter-reset: none;
	}
	.row {
		position: relative;
		display: grid;
		grid-template-columns: 2.75rem minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-2) var(--space-3) 0;
		border-top: 1.5px dashed var(--line);
	}
	.row:last-child {
		border-bottom: 1.5px dashed var(--line);
	}
	.row:has(.name:hover) {
		background: linear-gradient(to right, transparent, var(--accent-soft));
	}

	.rank {
		display: flex;
		flex-direction: column;
		align-items: center;
		line-height: 1;
	}
	.rank-num {
		font-family: var(--font-display);
		font-weight: 900;
		font-size: var(--display-sm);
		color: var(--ink-faint);
		font-variant-numeric: tabular-nums;
	}
	.tie {
		font-size: 0.6875rem;
		color: var(--ink-faint);
		white-space: nowrap;
	}
	.first .rank-num {
		font-size: var(--display-md);
		color: var(--accent-text);
	}

	.who {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-1);
		min-width: 0;
	}
	.name {
		font-weight: 700;
		font-size: var(--text-lg);
		line-height: 1.2;
		color: var(--ink);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	/* toute la ligne est cliquable */
	.name::after {
		content: '';
		position: absolute;
		inset: 0;
	}
	.name:focus-visible {
		outline: none;
	}
	.row:has(.name:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
		border-radius: var(--radius-s);
	}
	.first .name {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: var(--display-sm);
		line-height: 1;
	}

	.counts {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		text-align: right;
		white-space: nowrap;
	}
	.bars {
		font-size: var(--text-sm);
		color: var(--ink-dim);
	}
	.bars strong {
		font-family: var(--font-display);
		font-weight: 800;
		font-size: var(--display-sm);
		line-height: 1;
		color: var(--ink);
		font-variant-numeric: tabular-nums;
	}
	.visits {
		font-size: var(--text-xs);
		color: var(--ink-faint);
	}
</style>
