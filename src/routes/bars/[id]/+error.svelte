<script lang="ts">
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';

	const notFound = $derived(page.status === 404);
</script>

<svelte:head>
	<title>{notFound ? 'Bar introuvable' : 'Oups'} · Barathon</title>
</svelte:head>

<div class="container oops">
	<p class="code" aria-hidden="true">{page.status}</p>
	<h1>{notFound ? 'Bar introuvable' : 'Ça a coincé'}</h1>
	<p class="muted">{page.error?.message ?? 'Réessaie dans un instant.'}</p>
	<div class="actions">
		<Button href="/">Voir la carte des bars</Button>
		<Button href="/noter" variant="secondary">Noter un bar</Button>
	</div>
</div>

<style>
	.oops {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		padding-block: var(--space-7);
	}
	.code {
		font-family: var(--font-display);
		font-weight: 900;
		font-size: var(--display-xl);
		line-height: 0.85;
		color: var(--line-strong);
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		margin-top: var(--space-2);
	}
</style>
