/**
 * Formatage pour l'affichage (français). Aucune dépendance serveur : utilisable partout.
 */

const decimal1 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const euros = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' });
const km = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const kmWhole = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const dayMonthYear = new Intl.DateTimeFormat('fr-FR', {
	day: 'numeric',
	month: 'short',
	year: 'numeric',
	timeZone: 'UTC'
});

/** 4.25 → « 4,3 » ; null → « – ». */
export function formatScore(score: number | null | undefined): string {
	if (score === null || score === undefined || !Number.isFinite(score)) return '–';
	return decimal1.format(Math.round(score * 10) / 10);
}

/** 650 → « 6,50 € » ; null → « – ». */
export function formatPrice(cents: number | null | undefined): string {
	if (cents === null || cents === undefined) return '–';
	return euros.format(cents / 100);
}

/** Centimes → valeur de champ de formulaire (« 6,50 »), vide si null. */
export function priceToInput(cents: number | null | undefined): string {
	if (cents === null || cents === undefined) return '';
	return (cents / 100).toFixed(2).replace('.', ',');
}

/** « 2026-09-12 » → « 12 sept. 2026 ». */
export function formatDate(iso: string): string {
	const [y, m, d] = iso.split('-').map(Number);
	if (!y || !m || !d) return iso;
	return dayMonthYear.format(new Date(Date.UTC(y, m - 1, d)));
}

/** 42 → « 40 m » ; 1234 → « 1,2 km » ; 274 812 → « 275 km ». */
export function formatDistance(meters: number | null | undefined): string {
	if (meters === null || meters === undefined || !Number.isFinite(meters)) return '';
	const m = Math.max(10, Math.round(meters / 10) * 10);
	if (m < 1000) return `${m} m`;
	// Au-delà de 10 km, la décimale n'apporte rien (« 274,8 km »).
	return `${meters < 9950 ? km.format(meters / 1000) : kmWhole.format(meters / 1000)} km`;
}

/** « 1 passage », « 3 passages ». */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
	return `${n} ${n > 1 ? pluralForm : singular}`;
}

/* ---------- Couleur par note ---------- */

/** Rampe brique → ambre → blonde, de 1 à 5. */
const SCORE_STOPS: readonly [number, [number, number, number]][] = [
	[1, [180, 71, 59]],
	[2, [207, 106, 54]],
	[3, [227, 154, 52]],
	[4, [240, 193, 75]],
	[5, [247, 226, 127]]
];

export interface ScoreColor {
	/** Couleur de fond de la pastille. */
	bg: string;
	/** Couleur du texte lisible sur `bg`. */
	fg: string;
}

const NO_SCORE: ScoreColor = { bg: '#5d6b6f', fg: '#eef0ea' };

/** Couleur d'une pastille selon la note (interpolée entre les paliers). */
export function scoreColor(score: number | null | undefined): ScoreColor {
	if (score === null || score === undefined || !Number.isFinite(score)) return NO_SCORE;
	const s = Math.min(5, Math.max(1, score));
	let i = 0;
	while (i < SCORE_STOPS.length - 2 && s > SCORE_STOPS[i + 1][0]) i++;
	const [s0, c0] = SCORE_STOPS[i];
	const [s1, c1] = SCORE_STOPS[i + 1];
	const t = (s - s0) / (s1 - s0);
	const rgb = c0.map((v, k) => Math.round(v + (c1[k] - v) * t));
	return { bg: `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`, fg: readableInk(rgb) };
}

const LIGHT_INK = '#fff6e8';
const DARK_INK = '#231a0e';

function luminance([r, g, b]: number[]): number {
	const lin = (c: number) => {
		const v = c / 255;
		return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Encre (claire ou foncée) qui contraste le mieux avec un fond RGB. */
function readableInk(rgb: number[]): string {
	const l = luminance(rgb);
	const withLight = (0.93 + 0.05) / (l + 0.05);
	const withDark = (l + 0.05) / (0.011 + 0.05);
	return withDark >= withLight ? DARK_INK : LIGHT_INK;
}
