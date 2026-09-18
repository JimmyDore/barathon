<!-- Un barathonien : son rang, ses compteurs, ses passages. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import ScoreBadge from '$lib/components/ScoreBadge.svelte';
	import { getVisitTokens } from '$lib/client/storage';
	import { MOODS } from '$lib/constants';
	import { formatDate, plural } from '$lib/format';
	import Tally from '../Tally.svelte';
	import { ordinal } from '../ranking';

	let { data } = $props();

	const person = $derived(data.person);
	const visits = $derived(data.visits);

	let tokens = $state<Record<string, string>>({});
	onMount(() => {
		tokens = getVisitTokens();
	});

	const standing = $derived.by(() => {
		if (data.rank === null) return '';
		if (data.peopleCount === 1) return 'Seul au classement pour l’instant.';
		const where = data.rank === 1 ? 'En tête du classement' : `${ordinal(data.rank)} du classement`;
		return `${where}${data.tied ? ' (ex æquo)' : ''}, sur ${plural(data.peopleCount, 'barathonien')}.`;
	});

	function moodOf(value: number | null) {
		return MOODS.find((m) => m.value === value) ?? null;
	}
</script>

<svelte:head>
	<title>{person.name} · Barathon</title>
</svelte:head>

<article class="container page">
	<a class="back" href="/barathoniens"><span class="chev" aria-hidden="true">‹</span><span class="back-label">Tout le classement</span></a>

	<header class="head">
		<h1>{person.name}</h1>
		{#if standing}<p class="standing" class:top={data.rank === 1}>{standing}</p>{/if}
	</header>

	<div class="tally-line">
		<Tally count={person.barCount} max={30} />
		<p>
			<strong>{person.barCount} {person.barCount > 1 ? 'bars différents' : 'bar'}</strong>,
			{plural(person.visitCount, 'passage')}{#if person.lastVisitDate}. Dernier passage le {formatDate(
					person.lastVisitDate
				)}{/if}.
		</p>
	</div>

	<section class="visits" aria-labelledby="visits-title">
		<h2 id="visits-title">Ses passages</h2>
		<ul class="visit-list">
			{#each visits as v (v.id)}
				{@const mood = moodOf(v.humeur)}
				<li class="visit">
					<ScoreBadge score={v.score} size="sm" />
					<div class="visit-body">
						<p class="visit-bar">
							<a href="/bars/{v.barId}">{v.barName}</a>
							{#if mood}
								<span class="mood" role="img" aria-label="humeur : {mood.label}" title="Humeur : {mood.label}"
									>{mood.emoji}</span
								>
							{/if}
						</p>
						<p class="visit-date"><time datetime={v.date}>{formatDate(v.date)}</time></p>
						{#if v.commentaire}<p class="comment">{v.commentaire}</p>{/if}
					</div>
					{#if String(v.id) in tokens}
						<a class="edit" href="/passages/{v.id}/modifier">Modifier</a>
					{/if}
				</li>
			{/each}
		</ul>
	</section>
</article>

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
		font-size: clamp(var(--display-md), 12vw, var(--display-lg));
		font-weight: 900;
		line-height: 0.95;
		overflow-wrap: anywhere;
	}
	.standing {
		color: var(--ink-dim);
	}
	.standing.top {
		color: var(--accent-text);
		font-weight: 700;
	}

	.tally-line {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-4);
		border-radius: var(--radius-l);
		background: var(--bg-sunk);
	}

	.visits {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.visit-list {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.visit {
		display: grid;
		grid-template-columns: 3.4rem minmax(0, 1fr) auto;
		align-items: start;
		gap: var(--space-3);
		padding-block: var(--space-4);
		border-top: 1.5px dashed var(--line);
	}
	.visit :global(.pill) {
		margin-top: 2px;
		justify-self: start;
	}
	.visit-body {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.visit-bar {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-weight: 700;
		overflow-wrap: anywhere;
	}
	.visit-bar a {
		color: var(--ink);
		text-decoration-color: var(--line-strong);
	}
	.visit-bar a:hover {
		text-decoration-color: var(--accent);
	}
	.mood {
		font-size: 1.2rem;
		line-height: 1;
	}
	.visit-date {
		font-size: var(--text-sm);
		color: var(--ink-dim);
	}
	.comment {
		margin-top: var(--space-2);
		white-space: pre-line;
		overflow-wrap: anywhere;
	}
	.edit {
		display: inline-flex;
		align-items: center;
		min-height: var(--tap);
		margin-top: calc(-1 * var(--space-3));
		padding-inline: var(--space-2);
		font-size: var(--text-sm);
		font-weight: 700;
	}
</style>
