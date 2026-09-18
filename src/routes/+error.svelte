<!--
  Erreur générique (page inconnue, passage disparu…). Les sections qui ont leur
  propre +error.svelte (bars, barathoniens, admin) ne passent pas par ici.
-->
<script lang="ts">
	import { page } from '$app/state';
	import Button from '$lib/components/Button.svelte';

	const notFound = $derived(page.status === 404);
	/** SvelteKit dit « Not Found » pour une URL inconnue : on garde nos messages en français. */
	const message = $derived.by(() => {
		if (!notFound) return 'Réessaie dans un instant.';
		const m = page.error?.message;
		return m && m !== 'Not Found' ? m : 'Cette page n’existe pas, ou plus.';
	});
</script>

<svelte:head>
	<title>{notFound ? 'Page introuvable' : 'Oups'} · Barathon</title>
</svelte:head>

<div class="container oops">
	<p class="code" aria-hidden="true">{page.status}</p>
	<h1>{notFound ? 'Rien par ici' : 'Ça a coincé'}</h1>
	<p class="muted">{message}</p>
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
