import { dev } from '$app/environment';
import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** Vitrine des composants : seulement en `npm run dev`. */
export const load: PageLoad = () => {
	if (!dev) error(404, 'Page introuvable');
};
