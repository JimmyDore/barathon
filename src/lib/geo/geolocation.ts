/**
 * Position du téléphone : « Autour de moi », l'épingle du bar ajouté à la main, le « Me localiser » de la carte.
 * Petite couche autour de `navigator.geolocation` : promesse + erreurs typées + messages en français.
 *
 * Seul un vrai `getCurrentPosition` dit si la position est refusée. `navigator.permissions` n'est
 * qu'un indice : sur iPhone, Chrome (et les autres navigateurs tiers) répondent `denied` avant même
 * d'avoir posé la question. On ne s'en sert donc que pour localiser sans attendre un tap quand
 * c'est déjà `granted`, jamais pour renoncer à demander.
 */
import type { LatLon } from './distance';

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
 * Pas fiable quand il dit `denied` (cf. en-tête) : voir `initialGeoStep`.
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

/**
 * Que faire en arrivant sur la page, avant tout tap ?
 * - `locate` : c'est déjà autorisé, on cherche la position tout de suite ;
 * - `ask` : on affiche le bouton, le tap lancera le vrai `getCurrentPosition`
 *   (aussi quand la permission dit `denied` : iOS le dit avant d'avoir demandé) ;
 * - `unsupported` : le navigateur n'a pas de géolocalisation du tout.
 */
export function initialGeoStep(perm: GeoPermission, supported: boolean): 'locate' | 'ask' | 'unsupported' {
	if (!supported) return 'unsupported';
	return perm === 'granted' ? 'locate' : 'ask';
}

/** Ce qu'on dit quand la position ne vient pas. */
export function geoErrorMessage(kind: GeoErrorKind): string {
	switch (kind) {
		case 'denied':
			return 'Position refusée. Sur iPhone : Réglages › Apps › Chrome (ou Safari) › Position › « Lorsque l’app est active », puis autorise le site. En attendant, cherche le bar par son nom.';
		case 'unsupported':
			return 'Ton navigateur ne donne pas ta position. Cherche le bar par son nom.';
		case 'timeout':
			return 'Ta position met trop de temps à arriver. Réessaie, ou cherche le bar par son nom.';
		default:
			return 'Impossible de te situer pour l’instant. Réessaie, ou cherche le bar par son nom.';
	}
}

/**
 * Réessayer a-t-il un sens ? Oui, même après un refus : la personne vient peut-être
 * de changer ses réglages. Pas si le navigateur n'a pas de géolocalisation.
 */
export function canRetry(kind: GeoErrorKind): boolean {
	return kind !== 'unsupported';
}

/**
 * Faut-il arrêter de demander la position sans qu'on nous le demande (ex. en ouvrant
 * « Ajouter un bar ») ? Oui après un vrai refus, pour ne pas harceler ; le bouton
 * « Réessayer » reste là pour qui a changé d'avis.
 */
export function stopAsking(kind: GeoErrorKind): boolean {
	return kind === 'denied' || kind === 'unsupported';
}
