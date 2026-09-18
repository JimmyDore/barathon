/**
 * Chaque page pose son propre <title>, et le layout n'en pose pas.
 *
 * En SSR, Svelte ne garde qu'un <title> : celui qui est « le plus loin » dans
 * l'arbre. Une page qui fait un `bind:` sur un composant enfant est rendue dans
 * une copie hors de l'arbre, donc un <title> dans le layout l'emporte et la page
 * s'affiche « Barathon » tant que le JS n'est pas chargé. D'où la règle.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROUTES = path.resolve(import.meta.dirname);

function routeFiles(pattern: RegExp): string[] {
	return readdirSync(ROUTES, { recursive: true, encoding: 'utf8' })
		.filter((f) => pattern.test(path.basename(f)))
		.sort();
}

/** Source sans les commentaires HTML. */
function source(file: string): string {
	return readFileSync(path.join(ROUTES, file), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
}

function hasOwnTitle(file: string): boolean {
	const src = source(file);
	return /<svelte:head>[\s\S]*<title>[\s\S]*<\/title>[\s\S]*<\/svelte:head>/.test(src);
}

describe('titres des pages', () => {
	const pages = routeFiles(/^\+(page|error)\.svelte$/);

	it('trouve les pages', () => {
		expect(pages).toContain('+page.svelte');
		expect(pages).toContain('+error.svelte');
	});

	it.each(pages)('%s pose son <title>', (file) => {
		expect(hasOwnTitle(file)).toBe(true);
	});

	it.each(routeFiles(/^\+layout\.svelte$/))('%s ne pose pas de <title>', (file) => {
		expect(source(file)).not.toMatch(/<title>/);
	});
});
