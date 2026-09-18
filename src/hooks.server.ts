import type { Handle, ServerInit } from '@sveltejs/kit';
import { isAdmin } from '$lib/server/admin';
import { adminPassword } from '$lib/server/config';
import { getStore } from '$lib/server/db';

/** Au démarrage : vérifie la config et ouvre/migre la base (échoue tôt si quelque chose cloche). */
export const init: ServerInit = () => {
	adminPassword(); // lève en production si ADMIN_PASSWORD manque
	getStore();
};

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.admin = isAdmin(event.cookies);

	const response = await resolve(event);

	// Site entre potes : jamais indexé.
	response.headers.set('X-Robots-Tag', 'noindex, nofollow');
	response.headers.set('X-Content-Type-Options', 'nosniff');
	response.headers.set('Referrer-Policy', 'same-origin');
	return response;
};
