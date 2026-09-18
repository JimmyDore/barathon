/**
 * Position du téléphone pour « Autour de moi » et l'épingle du bar ajouté à la main.
 * Petite couche autour de `navigator.geolocation` : promesse + erreurs typées + messages en français.
 */
import type { LatLon } from '$lib/geo/distance';

export type GeoErrorKind = 'unsupported' | 'denied' | 'unavailable' | 'timeout';

export class GeoError extends Error {
	constructor(readonly kind: GeoErrorKind) {
		super(`geolocation: ${kind}`);
		this.name = 'GeoError';
	}
}

type GeolocationLike = Pick<Geolocation, 'getCurrentPosition'>;
type PermissionsLike = Pick<Permissions, 'query'>;

export const POSITION_OPTIONS: PositionOptions = {
	enableHighAccuracy: true,
	timeout: 12_000,
	maximumAge: 60_000
};

/** Position actuelle. Rejette avec une `GeoError`. */
export function getPosition(
	options: PositionOptions = POSITION_OPTIONS,
	geo: GeolocationLike | undefined = globalThis.navigator?.geolocation
): Promise<LatLon> {
	return new Promise((resolve, reject) => {
		if (!geo) {
			reject(new GeoError('unsupported'));
			return;
		}
		try {
			geo.getCurrentPosition(
				(p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
				// 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
				(e) => reject(new GeoError(e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'unavailable')),
				options
			);
		} catch {
			reject(new GeoError('unavailable'));
		}
	});
}

export type GeoPermission = 'granted' | 'denied' | 'prompt' | 'unknown';

/**
 * État de la permission sans rien demander à l'utilisateur
 * ('unknown' si le navigateur ne sait pas le dire, ex. vieux Safari).
 */
export async function geoPermission(
	perms: PermissionsLike | undefined = globalThis.navigator?.permissions
): Promise<GeoPermission> {
	if (!perms?.query) return 'unknown';
	try {
		const status = await perms.query({ name: 'geolocation' });
		return status.state === 'granted' || status.state === 'denied' || status.state === 'prompt'
			? status.state
			: 'unknown';
	} catch {
		return 'unknown';
	}
}

/** Ce qu'on dit quand la position ne vient pas. */
export function geoErrorMessage(kind: GeoErrorKind): string {
	switch (kind) {
		case 'denied':
			return 'Position refusée, pas de souci : cherche le bar par son nom. (Pour la réactiver, ça se passe dans les réglages du navigateur.)';
		case 'unsupported':
			return 'Ton navigateur ne donne pas ta position. Cherche le bar par son nom.';
		case 'timeout':
			return 'Ta position met trop de temps à arriver. Réessaie, ou cherche le bar par son nom.';
		default:
			return 'Impossible de te situer pour l’instant. Réessaie, ou cherche le bar par son nom.';
	}
}

/** Réessayer a-t-il un sens ? (Pas si c'est refusé ou impossible.) */
export function canRetry(kind: GeoErrorKind): boolean {
	return kind === 'timeout' || kind === 'unavailable';
}
