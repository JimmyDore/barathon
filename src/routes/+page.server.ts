import { getStore } from '$lib/server/db';
import type { PageServerLoad } from './$types';
import { toHomeBar } from './home';

/**
 * Tous les bars (résumés allégés). Vue et filtres vivent dans l'URL mais sont
 * appliqués côté client : on ne lit pas `url` ici, pour que changer un filtre
 * ne relance pas ce chargement.
 */
export const load: PageServerLoad = () => {
	return { bars: getStore().listBarSummaries().map(toHomeBar) };
};
