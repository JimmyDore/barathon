/**
 * Configuration serveur lue dans l'environnement (au runtime, pas au build).
 */
import path from 'node:path';
import { dev } from '$app/environment';

/** Dossier des données (défaut : ./data). */
export function dataDir(): string {
	return process.env.DATA_DIR?.trim() || './data';
}

/** Chemin de la base SQLite : `${DATA_DIR}/barathon.db`. */
export function dbPath(): string {
	return path.join(dataDir(), 'barathon.db');
}

let warned = false;

/**
 * Mot de passe admin. Obligatoire en production ; en dev, repli sur « dev » avec un avertissement.
 */
export function adminPassword(): string {
	const p = process.env.ADMIN_PASSWORD?.trim();
	if (p) return p;
	if (dev) {
		if (!warned) {
			console.warn('[barathon] ADMIN_PASSWORD absent : mot de passe admin de dev = « dev ».');
			warned = true;
		}
		return 'dev';
	}
	throw new Error('ADMIN_PASSWORD est obligatoire en production.');
}
