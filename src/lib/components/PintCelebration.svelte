<!--
  Célébration après l'enregistrement d'une note : une pinte se remplit, la mousse déborde, « Santé ! ».
  ~1,6 s puis `ondone()` (tout de suite si l'utilisateur préfère moins d'animations).
  Usage :
    <PintCelebration open={saved} score={visitScore} ondone={() => goto(`/bars/${barId}`)}>
      <Button href="/bars/{barId}">Voir la fiche du bar</Button>
    </PintCelebration>
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fade } from 'svelte/transition';
	import ScoreBadge from './ScoreBadge.svelte';

	interface Props {
		open: boolean;
		/** Note du passage à afficher (facultatif). */
		score?: number | null;
		title?: string;
		message?: string;
		/** Appelé une fois l'animation terminée. */
		ondone?: () => void;
		/** Actions sous le message (ex. bouton vers la fiche du bar). */
		children?: Snippet;
	}

	let {
		open,
		score = undefined,
		title = 'Santé !',
		message = 'Ton passage est enregistré.',
		ondone,
		children
	}: Props = $props();

	const uid = $props.id();

	$effect(() => {
		if (!open) return;
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const t = setTimeout(() => ondone?.(), reduced ? 500 : 1700);
		return () => clearTimeout(t);
	});
</script>

{#if open}
	<div class="celebration" role="status" aria-live="polite" transition:fade={{ duration: 160 }}>
		<svg class="pint" viewBox="0 0 120 170" aria-hidden="true">
			<defs>
				<clipPath id="{uid}-glass">
					<path d="M16 16H104L92.6 152.6Q92.2 157 87.8 157H32.2Q27.8 157 27.4 152.6Z" />
				</clipPath>
				<linearGradient id="{uid}-beer" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stop-color="#f8c25a" />
					<stop offset="0.45" stop-color="#f0a331" />
					<stop offset="1" stop-color="#c9730f" />
				</linearGradient>
			</defs>

			<g clip-path="url(#{uid}-glass)">
				<g class="liquid">
					<rect x="0" y="0" width="120" height="180" fill="url(#{uid}-beer)" />
					<g class="bubbles">
						<circle cx="40" cy="120" r="2.2" />
						<circle cx="58" cy="135" r="1.6" />
						<circle cx="74" cy="110" r="2" />
						<circle cx="84" cy="140" r="1.4" />
						<circle cx="50" cy="95" r="1.5" />
					</g>
					<g class="foam-line">
						<rect x="0" y="-9" width="120" height="13" />
						<circle cx="14" cy="-9" r="6" /><circle cx="26" cy="-11" r="7" /><circle cx="39" cy="-9" r="6" />
						<circle cx="52" cy="-11" r="7.5" /><circle cx="66" cy="-9" r="6" /><circle cx="79" cy="-11" r="7" />
						<circle cx="92" cy="-9" r="6" /><circle cx="105" cy="-10" r="6.5" />
					</g>
				</g>
			</g>

			<!-- la mousse qui déborde du verre -->
			<g class="head">
				<path d="M13 18C6 18 5 8 13 7c1-6 10-7 13-2 3-5 12-5 15 0 3-5 12-5 15 0 3-5 12-5 15 0 3-5 12-5 15 0 3-4 11-3 12 3 7 1 7 10 0 10z" />
			</g>

			<path class="glass" d="M12 12H108L96.2 155.4Q95.6 162 89 162H31Q24.4 162 23.8 155.4Z" />
			<path class="shine" d="M24 26L31 140" />
		</svg>

		<p class="title">{title}</p>
		<p class="message">{message}</p>
		{#if score !== undefined}
			<div class="score"><ScoreBadge {score} size="lg" outOf /></div>
		{/if}
		{#if children}<div class="actions">{@render children()}</div>{/if}
	</div>
{/if}

<style>
	.celebration {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-3);
		padding: var(--space-5) var(--gutter);
		background: var(--overlay);
		backdrop-filter: blur(6px);
		-webkit-backdrop-filter: blur(6px);
		text-align: center;
	}

	.pint {
		width: 132px;
		height: auto;
		overflow: visible;
		margin-bottom: var(--space-3);
	}

	.glass {
		fill: rgb(255 255 255 / 0.04);
		stroke: var(--ink);
		stroke-width: 3;
		stroke-linejoin: round;
	}
	.shine {
		stroke: rgb(255 255 255 / 0.35);
		stroke-width: 3;
		stroke-linecap: round;
		fill: none;
	}

	/* 1. la bière monte */
	.liquid {
		transform: translateY(166px);
		animation: pour 950ms var(--ease-pour) 120ms forwards;
	}
	@keyframes pour {
		to {
			transform: translateY(30px);
		}
	}

	.foam-line {
		fill: var(--foam);
	}

	.bubbles circle {
		fill: rgb(255 246 220 / 0.75);
		animation: rise 1100ms ease-in infinite;
	}
	.bubbles circle:nth-child(2) {
		animation-delay: 250ms;
	}
	.bubbles circle:nth-child(3) {
		animation-delay: 500ms;
	}
	.bubbles circle:nth-child(4) {
		animation-delay: 150ms;
	}
	.bubbles circle:nth-child(5) {
		animation-delay: 700ms;
	}
	@keyframes rise {
		from {
			transform: translateY(0);
			opacity: 0;
		}
		20% {
			opacity: 1;
		}
		to {
			transform: translateY(-70px);
			opacity: 0;
		}
	}

	/* 2. la mousse déborde */
	.head path {
		fill: var(--foam);
	}
	.head {
		transform-box: fill-box;
		transform-origin: 50% 100%;
		transform: scaleY(0);
		animation: head 420ms var(--ease-out) 950ms forwards;
	}
	@keyframes head {
		0% {
			transform: scaleY(0);
		}
		70% {
			transform: scaleY(1.25);
		}
		100% {
			transform: scaleY(1);
		}
	}

	/* 3. santé ! */
	.title,
	.message,
	.score,
	.actions {
		opacity: 0;
		animation: appear 300ms var(--ease-out) forwards;
	}
	.title {
		font-family: var(--font-display);
		font-weight: 900;
		font-size: var(--display-lg);
		line-height: 1;
		color: var(--ink);
		animation-delay: 1050ms;
	}
	.message {
		color: var(--ink-dim);
		animation-delay: 1150ms;
	}
	.score {
		animation-delay: 1200ms;
	}
	.actions {
		margin-top: var(--space-3);
		animation-delay: 1250ms;
	}
	@keyframes appear {
		from {
			opacity: 0;
			transform: translateY(6px) scale(0.96);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.liquid {
			transform: translateY(30px);
		}
		.head {
			transform: none;
		}
		.bubbles {
			display: none;
		}
	}
</style>
