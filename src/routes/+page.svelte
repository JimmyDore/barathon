<!-- Accueil provisoire : la carte plein écran + classement arrive (voir ARCHITECTURE.md). -->
<script lang="ts">
	import Button from '$lib/components/Button.svelte';
</script>

<div class="container placeholder stack">
	<h1>La carte arrive.</h1>
	<p class="muted">En attendant, tu peux déjà noter un bar.</p>
	<Button href="/noter" size="lg">Noter un bar</Button>
</div>

<style>
	.placeholder {
		padding-block: var(--space-7);
	}
</style>
