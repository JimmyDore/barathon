<script lang="ts">
	import '@fontsource/big-shoulders-display/700';
	import '@fontsource/big-shoulders-display/800';
	import '@fontsource/big-shoulders-display/900';
	import '@fontsource/atkinson-hyperlegible/400';
	import '@fontsource/atkinson-hyperlegible/400-italic';
	import '@fontsource/atkinson-hyperlegible/700';
	import '../app.css';
	import { page } from '$app/state';

	let { children } = $props();

	const path = $derived(page.url.pathname);
	/** La carte d'accueil occupe tout l'écran : pas de pied de page. */
	const fullBleed = $derived(page.route.id === '/');

	function current(prefix: string): 'page' | undefined {
		return path === prefix || path.startsWith(`${prefix}/`) ? 'page' : undefined;
	}
</script>

<!--
  Pas de <title> ici : chaque page (et chaque +error.svelte) pose le sien.
  En SSR, Svelte garde un seul <title> choisi par position dans l'arbre, et une
  page qui fait un bind: sur un composant enfant est rendue dans une copie hors
  de l'arbre : le <title> du layout gagnait alors, et la page s'affichait
  « Barathon » jusqu'au chargement du JS.
-->
<a class="skip" href="#contenu">Aller au contenu</a>

<header class="site-header">
	<a class="wordmark" href="/" aria-current={path === '/' ? 'page' : undefined}>Barathon</a>
	<nav aria-label="Navigation principale">
		<a class="nav-link" href="/barathoniens" aria-current={current('/barathoniens')}>Barathoniens</a>
		<a class="nav-cta" href="/noter" aria-current={current('/noter')}>
			<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
			Noter
		</a>
	</nav>
</header>

<main id="contenu" class:full-bleed={fullBleed}>
	{@render children()}
</main>

{#if !fullBleed}
	<footer class="site-footer">
		<p>Noté entre potes. Données carto © OpenStreetMap contributors.</p>
		<a href="/admin">admin</a>
	</footer>
{/if}

<style>
	.skip {
		position: absolute;
		left: var(--space-2);
		top: -100px;
		z-index: 100;
		padding: var(--space-2) var(--space-4);
		background: var(--accent);
		color: var(--accent-ink);
		border-radius: var(--radius-m);
		font-weight: 700;
	}
	.skip:focus {
		top: var(--space-2);
	}

	.site-header {
		position: sticky;
		top: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-3);
		height: var(--header-h);
		padding: 0 var(--gutter);
		padding-top: env(safe-area-inset-top);
		box-sizing: content-box;
		background: color-mix(in srgb, var(--bg) 92%, transparent);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border-bottom: 1px solid var(--line);
	}

	.wordmark {
		font-family: var(--font-display);
		font-weight: 900;
		font-size: 1.875rem;
		line-height: 1;
		letter-spacing: 0.01em;
		color: var(--ink);
		text-decoration: none;
		/* petite ligne de mousse sous la marque */
		background: linear-gradient(var(--accent), var(--accent)) 0 100% / 1.1em 3px no-repeat;
		padding-bottom: 4px;
	}

	nav {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}

	.nav-link {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		padding: 0 var(--space-2);
		color: var(--ink-dim);
		font-weight: 700;
		font-size: var(--text-sm);
		text-decoration: none;
	}
	.nav-link:hover,
	.nav-link[aria-current='page'] {
		color: var(--ink);
	}
	.nav-link[aria-current='page'] {
		text-decoration: underline;
		text-decoration-color: var(--accent);
		text-decoration-thickness: 2px;
		text-underline-offset: 0.35em;
	}

	.nav-cta {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		min-height: 44px;
		padding: 0 var(--space-4) 0 var(--space-3);
		border-radius: var(--radius-pill);
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 700;
		font-size: var(--text-sm);
		text-decoration: none;
	}
	.nav-cta:hover {
		background: var(--accent-strong);
	}
	.nav-cta svg {
		width: 16px;
		height: 16px;
		stroke: currentColor;
		stroke-width: 2.6;
		stroke-linecap: round;
	}

	main {
		min-height: calc(100dvh - var(--header-h) - 5rem);
	}
	main.full-bleed {
		min-height: 0;
	}

	.site-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		max-width: var(--content-max);
		margin: var(--space-7) auto 0;
		padding: var(--space-4) var(--gutter) calc(var(--space-4) + env(safe-area-inset-bottom));
		border-top: 1px solid var(--line);
		color: var(--ink-faint);
		font-size: var(--text-xs);
	}
	.site-footer a {
		display: inline-flex;
		align-items: center;
		min-height: 44px;
		color: var(--ink-faint);
	}
</style>
