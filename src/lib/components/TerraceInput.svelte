<!--
  Terrasse : « pas de terrasse » OU une note de 1 à 5, ou rien (pas testé).
  Valeur : null | 0 (pas de terrasse) | 1–5. Envoie `terrasse` = 'none' | '1'..'5'.
  Usage : <TerraceInput bind:value={terrasse} error={errors.terrasse} />
-->
<script lang="ts">
	import RatingInput from './RatingInput.svelte';

	interface Props {
		name?: string;
		label?: string;
		value?: number | null;
		error?: string | null;
		onchange?: (value: number | null) => void;
	}

	let { name = 'terrasse', label = 'Terrasse', value = $bindable(null), error = null, onchange }: Props =
		$props();
</script>

<RatingInput {name} {label} bind:value {error} {onchange} noneLabel="Pas de terrasse" />
