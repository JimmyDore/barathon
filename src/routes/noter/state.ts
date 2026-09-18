/**
 * Étapes de /noter en « shallow routing » (pushState) : le bouton retour du téléphone
 * ramène à l'étape précédente au lieu de quitter la page.
 */
import type { PlaceOption } from '$lib/geo/merge';

export interface NoterPageState {
	/** Écran « Bar introuvable ? » ouvert. */
	noterManual?: boolean;
	/** Bar choisi à l'étape 1 (on est à l'étape 2). */
	noterChoice?: PlaceOption;
}

/** `page.state` vu depuis /noter. */
export function noterState(state: App.PageState): NoterPageState {
	return state as NoterPageState;
}
