/** Minuscules, sans accents : pour comparer des noms (« Café » ≈ « cafe »). */
export function foldText(s: string): string {
	return s
		.normalize('NFD')
		.replace(/\p{Diacritic}/gu, '')
		.toLowerCase();
}
