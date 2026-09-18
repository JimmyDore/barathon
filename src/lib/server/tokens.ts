/**
 * Jetons d'auteur : à la création d'un passage, le serveur renvoie un jeton secret
 * (gardé par le navigateur) et ne stocke que son hash SHA-256.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/** Nouveau jeton (256 bits, base64url) et son hash à stocker. */
export function generateToken(): { token: string; hash: string } {
	const token = randomBytes(32).toString('base64url');
	return { token, hash: hashToken(token) };
}

/** Hash SHA-256 hexadécimal d'un jeton. */
export function hashToken(token: string): string {
	return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Compare un jeton fourni au hash stocké, en temps constant. */
export function verifyToken(token: string | null | undefined, storedHash: string | null | undefined): boolean {
	if (!token || !storedHash) return false;
	const a = Buffer.from(hashToken(token), 'hex');
	const b = Buffer.from(storedHash, 'hex');
	return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}
