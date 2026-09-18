/**
 * Base SQLite (better-sqlite3) : schéma, migrations et couche d'accès aux données.
 *
 * - Fichier : `${DATA_DIR}/barathon.db`, mode WAL, clés étrangères actives.
 * - Migrations : tableau `MIGRATIONS`, version courante dans `PRAGMA user_version`.
 *   On AJOUTE une migration à la fin, on ne modifie jamais une migration existante.
 * - Accès : `getStore()` (singleton de l'app) ou `createStore(openDatabase(':memory:'))` en test.
 *
 * Les IP ne sont jamais stockées. Le jeton d'auteur n'est stocké que haché (SHA-256).
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { PLACE_CATEGORIES, type AmbianceSlug, type PlaceCategory } from '$lib/constants';
import { haversine } from '$lib/geo/distance';
import { pseudoKey } from '$lib/pseudo';
import { scoreVisit } from '$lib/scoring';
import { compareBarsByScore, rankPeople, ratingsOf, summarizeVisits } from '$lib/stats';
import { foldText } from '$lib/text';
import type { Bar, BarNearby, BarSummary, Person, Visit, VisitWithBar } from '$lib/types';
import type { BarChoice, VisitInput } from '$lib/validation';
import { dbPath } from './config';
import { generateToken, verifyToken } from './tokens';

export type DB = Database.Database;

/* ------------------------------------------------------------------ */
/* Schéma & migrations                                                */
/* ------------------------------------------------------------------ */

export const MIGRATIONS: readonly string[] = [
	// 1 — schéma initial
	`
	CREATE TABLE bars (
		id          INTEGER PRIMARY KEY,
		name        TEXT    NOT NULL,
		address     TEXT,
		lat         REAL    NOT NULL,
		lon         REAL    NOT NULL,
		source      TEXT    NOT NULL CHECK (source IN ('osm', 'manual')),
		source_id   TEXT,
		category    TEXT,
		created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
	);
	CREATE UNIQUE INDEX bars_source_uid ON bars (source, source_id) WHERE source_id IS NOT NULL;
	CREATE INDEX bars_lat ON bars (lat);

	CREATE TABLE visits (
		id                INTEGER PRIMARY KEY,
		bar_id            INTEGER NOT NULL REFERENCES bars (id) ON DELETE CASCADE,
		pseudo            TEXT    NOT NULL,
		pseudo_key        TEXT    NOT NULL,
		visit_date        TEXT    NOT NULL,
		beaute            INTEGER CHECK (beaute BETWEEN 1 AND 5),
		emplacement       INTEGER CHECK (emplacement BETWEEN 1 AND 5),
		terrasse          INTEGER CHECK (terrasse BETWEEN 0 AND 5),
		choix_bieres      INTEGER CHECK (choix_bieres BETWEEN 1 AND 5),
		qualite_biere     INTEGER CHECK (qualite_biere BETWEEN 1 AND 5),
		soiree            INTEGER NOT NULL CHECK (soiree BETWEEN 1 AND 5),
		ambiances         TEXT    NOT NULL DEFAULT '[]',
		humeur            INTEGER CHECK (humeur BETWEEN 1 AND 5),
		prix_pinte_cents  INTEGER CHECK (prix_pinte_cents > 0),
		commentaire       TEXT,
		token_hash        TEXT    NOT NULL,
		created_at        TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
		updated_at        TEXT
	);
	CREATE INDEX visits_bar ON visits (bar_id);
	CREATE INDEX visits_pseudo_key ON visits (pseudo_key);
	`
];

/** Applique les migrations manquantes. Renvoie la version finale du schéma. */
export function migrate(db: DB): number {
	const current = db.pragma('user_version', { simple: true }) as number;
	for (let i = current; i < MIGRATIONS.length; i++) {
		db.transaction(() => {
			db.exec(MIGRATIONS[i]);
			db.pragma(`user_version = ${i + 1}`);
		})();
	}
	return MIGRATIONS.length;
}

/** Ouvre (et crée si besoin) une base, règle les pragmas et migre. `':memory:'` pour les tests. */
export function openDatabase(file: string): DB {
	if (file !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
	const db = new Database(file);
	db.pragma('journal_mode = WAL');
	db.pragma('synchronous = NORMAL');
	db.pragma('foreign_keys = ON');
	db.pragma('busy_timeout = 5000');
	migrate(db);
	return db;
}

/* ------------------------------------------------------------------ */
/* Lignes SQL → objets                                                */
/* ------------------------------------------------------------------ */

interface BarRow {
	id: number;
	name: string;
	address: string | null;
	lat: number;
	lon: number;
	source: 'osm' | 'manual';
	source_id: string | null;
	category: string | null;
	created_at: string;
}

interface VisitRow {
	id: number;
	bar_id: number;
	pseudo: string;
	pseudo_key: string;
	visit_date: string;
	beaute: number | null;
	emplacement: number | null;
	terrasse: number | null;
	choix_bieres: number | null;
	qualite_biere: number | null;
	soiree: number;
	ambiances: string;
	humeur: number | null;
	prix_pinte_cents: number | null;
	commentaire: string | null;
	token_hash: string;
	created_at: string;
	updated_at: string | null;
}

function toBar(r: BarRow): Bar {
	return {
		id: r.id,
		name: r.name,
		address: r.address,
		lat: r.lat,
		lon: r.lon,
		source: r.source,
		sourceId: r.source_id,
		category: (PLACE_CATEGORIES as readonly string[]).includes(r.category ?? '')
			? (r.category as PlaceCategory)
			: null,
		createdAt: r.created_at
	};
}

function parseAmbiances(json: string): AmbianceSlug[] {
	try {
		const v = JSON.parse(json);
		return Array.isArray(v) ? v.filter((x): x is AmbianceSlug => typeof x === 'string') : [];
	} catch {
		return [];
	}
}

function toVisit(r: VisitRow): Visit {
	const input: VisitInput = {
		pseudo: r.pseudo,
		date: r.visit_date,
		beaute: r.beaute,
		emplacement: r.emplacement,
		terrasse: r.terrasse,
		choixBieres: r.choix_bieres,
		qualiteBiere: r.qualite_biere,
		soiree: r.soiree,
		ambiances: parseAmbiances(r.ambiances),
		humeur: r.humeur,
		prixCents: r.prix_pinte_cents,
		commentaire: r.commentaire
	};
	return {
		...input,
		id: r.id,
		barId: r.bar_id,
		pseudoKey: r.pseudo_key,
		createdAt: r.created_at,
		updatedAt: r.updated_at,
		score: scoreVisit(ratingsOf(input)).overall
	};
}

function visitParams(input: VisitInput) {
	return {
		pseudo: input.pseudo,
		pseudo_key: pseudoKey(input.pseudo),
		visit_date: input.date,
		beaute: input.beaute,
		emplacement: input.emplacement,
		terrasse: input.terrasse,
		choix_bieres: input.choixBieres,
		qualite_biere: input.qualiteBiere,
		soiree: input.soiree,
		ambiances: JSON.stringify(input.ambiances),
		humeur: input.humeur,
		prix_pinte_cents: input.prixCents,
		commentaire: input.commentaire
	};
}

function summarize(bar: Bar, visits: Visit[]): BarSummary {
	return { ...bar, ...summarizeVisits(visits) };
}

/* ------------------------------------------------------------------ */
/* Store                                                              */
/* ------------------------------------------------------------------ */

/** Qui demande à modifier/supprimer un passage : l'admin, ou l'auteur avec son jeton. */
export type VisitAuth = { admin: true } | { token: string | null | undefined };

export type VisitAccess = 'ok' | 'not_found' | 'forbidden';

export type NewBar = Exclude<BarChoice, { kind: 'existing' }>;

export type CreateVisitResult =
	| { ok: true; visit: Visit; bar: Bar; token: string }
	| { ok: false; reason: 'bar_not_found' };

export type UpdateVisitResult = { ok: true; visit: Visit } | { ok: false; reason: 'not_found' | 'forbidden' };

export type DeleteVisitResult =
	| { ok: true; barId: number; barDeleted: boolean }
	| { ok: false; reason: 'not_found' | 'forbidden' };

export type MergeBarsResult =
	| { ok: true; bar: Bar; movedVisits: number }
	| { ok: false; reason: 'same_bar' | 'not_found' };

const VISIT_ORDER = 'ORDER BY v.visit_date DESC, v.id DESC';

export function createStore(db: DB) {
	const q = {
		barById: db.prepare<[number], BarRow>('SELECT * FROM bars WHERE id = ?'),
		barBySource: db.prepare<[string, string], BarRow>(
			'SELECT * FROM bars WHERE source = ? AND source_id = ?'
		),
		allBars: db.prepare<[], BarRow>('SELECT * FROM bars'),
		barsInLatBand: db.prepare<[number, number], BarRow>('SELECT * FROM bars WHERE lat BETWEEN ? AND ?'),
		insertBar: db.prepare(
			`INSERT INTO bars (name, address, lat, lon, source, source_id, category)
			 VALUES (@name, @address, @lat, @lon, @source, @source_id, @category)`
		),
		renameBar: db.prepare('UPDATE bars SET name = ?, address = ? WHERE id = ?'),
		moveBar: db.prepare('UPDATE bars SET lat = ?, lon = ? WHERE id = ?'),
		deleteBar: db.prepare('DELETE FROM bars WHERE id = ?'),
		setBarSource: db.prepare('UPDATE bars SET source = ?, source_id = ?, category = COALESCE(category, ?) WHERE id = ?'),

		visitById: db.prepare<[number], VisitRow>('SELECT * FROM visits WHERE id = ?'),
		allVisits: db.prepare<[], VisitRow>('SELECT * FROM visits v ' + VISIT_ORDER),
		visitsByBar: db.prepare<[number], VisitRow>(`SELECT * FROM visits v WHERE bar_id = ? ${VISIT_ORDER}`),
		visitsByPerson: db.prepare<[string], VisitRow & { bar_name: string }>(
			`SELECT v.*, b.name AS bar_name FROM visits v JOIN bars b ON b.id = v.bar_id
			 WHERE v.pseudo_key = ? ${VISIT_ORDER}`
		),
		recentVisits: db.prepare<[number], VisitRow & { bar_name: string }>(
			`SELECT v.*, b.name AS bar_name FROM visits v JOIN bars b ON b.id = v.bar_id
			 ORDER BY v.created_at DESC, v.id DESC LIMIT ?`
		),
		peopleRows: db.prepare<
			[],
			{ pseudo: string; pseudo_key: string; bar_id: number; visit_date: string; created_at: string }
		>('SELECT pseudo, pseudo_key, bar_id, visit_date, created_at FROM visits'),
		insertVisit: db.prepare(
			`INSERT INTO visits (bar_id, pseudo, pseudo_key, visit_date, beaute, emplacement, terrasse,
			   choix_bieres, qualite_biere, soiree, ambiances, humeur, prix_pinte_cents, commentaire, token_hash)
			 VALUES (@bar_id, @pseudo, @pseudo_key, @visit_date, @beaute, @emplacement, @terrasse,
			   @choix_bieres, @qualite_biere, @soiree, @ambiances, @humeur, @prix_pinte_cents, @commentaire, @token_hash)`
		),
		updateVisit: db.prepare(
			`UPDATE visits SET pseudo = @pseudo, pseudo_key = @pseudo_key, visit_date = @visit_date,
			   beaute = @beaute, emplacement = @emplacement, terrasse = @terrasse,
			   choix_bieres = @choix_bieres, qualite_biere = @qualite_biere, soiree = @soiree,
			   ambiances = @ambiances, humeur = @humeur, prix_pinte_cents = @prix_pinte_cents,
			   commentaire = @commentaire, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
			 WHERE id = @id`
		),
		deleteVisit: db.prepare('DELETE FROM visits WHERE id = ?'),
		countVisitsOfBar: db.prepare<[number], { n: number }>('SELECT COUNT(*) AS n FROM visits WHERE bar_id = ?'),
		moveVisits: db.prepare('UPDATE visits SET bar_id = ? WHERE bar_id = ?')
	};

	/** Charge les passages d'une liste de bars, groupés par bar. */
	function visitsGroupedByBar(barIds: number[] | 'all'): Map<number, Visit[]> {
		const out = new Map<number, Visit[]>();
		let rows: VisitRow[];
		if (barIds === 'all') rows = q.allVisits.all();
		else if (barIds.length === 0) rows = [];
		else
			rows = db
				.prepare<number[], VisitRow>(
					`SELECT * FROM visits v WHERE bar_id IN (${barIds.map(() => '?').join(',')}) ${VISIT_ORDER}`
				)
				.all(...barIds);
		for (const r of rows) {
			const list = out.get(r.bar_id) ?? [];
			list.push(toVisit(r));
			out.set(r.bar_id, list);
		}
		return out;
	}

	function summariesOf(bars: Bar[]): BarSummary[] {
		const grouped = visitsGroupedByBar(bars.map((b) => b.id));
		return bars.map((b) => summarize(b, grouped.get(b.id) ?? []));
	}

	function checkAccess(row: VisitRow | undefined, auth: VisitAuth): VisitAccess {
		if (!row) return 'not_found';
		if ('admin' in auth && auth.admin === true) return 'ok';
		if ('token' in auth && verifyToken(auth.token, row.token_hash)) return 'ok';
		return 'forbidden';
	}

	const store = {
		db,

		/* ---------------- Bars ---------------- */

		getBar(id: number): Bar | null {
			const r = q.barById.get(id);
			return r ? toBar(r) : null;
		},

		/** Bar OSM déjà en base pour cet identifiant (`node/123`). */
		findBarBySourceId(sourceId: string): Bar | null {
			const r = q.barBySource.get('osm', sourceId);
			return r ? toBar(r) : null;
		},

		/** Résumés des bars OSM déjà en base parmi ces identifiants. */
		getBarSummariesBySourceIds(sourceIds: string[]): BarSummary[] {
			const bars = sourceIds
				.map((id) => q.barBySource.get('osm', id))
				.filter((r): r is BarRow => !!r)
				.map(toBar);
			return summariesOf(bars);
		},

		/**
		 * Crée un bar. Pour un bar OSM déjà connu (même `sourceId`), renvoie l'existant
		 * au lieu d'en créer un doublon.
		 */
		createBar(place: NewBar): Bar {
			if (place.kind === 'osm') {
				const existing = q.barBySource.get('osm', place.sourceId);
				if (existing) return toBar(existing);
			}
			const info = q.insertBar.run({
				name: place.name,
				address: place.address,
				lat: place.lat,
				lon: place.lon,
				source: place.kind,
				source_id: place.kind === 'osm' ? place.sourceId : null,
				category: place.kind === 'osm' ? place.category : null
			});
			return toBar(q.barById.get(Number(info.lastInsertRowid))!);
		},

		/** Bar existant (par id) ou nouveau bar (osm/manuel) à partir du choix du formulaire. */
		resolveBar(choice: BarChoice): Bar | null {
			if (choice.kind === 'existing') return store.getBar(choice.barId);
			return store.createBar(choice);
		},

		getBarSummary(id: number): BarSummary | null {
			const bar = store.getBar(id);
			return bar ? summariesOf([bar])[0] : null;
		},

		/** Tous les bars avec leurs agrégats, triés par note (non notés à la fin). */
		listBarSummaries(): BarSummary[] {
			const bars = q.allBars.all().map(toBar);
			const grouped = visitsGroupedByBar('all');
			return bars.map((b) => summarize(b, grouped.get(b.id) ?? [])).sort(compareBarsByScore);
		},

		/** Nos bars dans un rayon (mètres) autour d'un point, du plus proche au plus loin. */
		barsNearby(lat: number, lon: number, radiusM: number): BarNearby[] {
			const dLat = radiusM / 111_320 + 1e-6;
			const candidates = q.barsInLatBand
				.all(lat - dLat, lat + dLat)
				.map(toBar)
				.map((b) => ({ bar: b, distance: haversine({ lat, lon }, b) }))
				.filter((x) => x.distance <= radiusM)
				.sort((a, b) => a.distance - b.distance);
			const summaries = summariesOf(candidates.map((c) => c.bar));
			return summaries.map((s, i) => ({ ...s, distance: candidates[i].distance }));
		},

		/**
		 * Recherche dans nos bars (nom ou adresse, sans tenir compte de la casse ni des accents).
		 * Les noms qui commencent par la requête passent devant.
		 */
		searchBars(query: string, limit = 10): BarSummary[] {
			const needle = foldText(query.trim());
			if (needle === '') return [];
			const hits = q.allBars
				.all()
				.map(toBar)
				.map((b) => {
					const name = foldText(b.name);
					const rank = name.startsWith(needle)
						? 0
						: name.includes(needle)
							? 1
							: foldText(b.address ?? '').includes(needle)
								? 2
								: -1;
					return { b, rank };
				})
				.filter((x) => x.rank >= 0)
				.sort((a, z) => a.rank - z.rank || a.b.name.localeCompare(z.b.name, 'fr'))
				.slice(0, limit)
				.map((x) => x.b);
			return summariesOf(hits);
		},

		/** Renomme un bar (et change son adresse si `address` est fourni). */
		renameBar(id: number, name: string, address?: string | null): Bar | null {
			const bar = store.getBar(id);
			if (!bar) return null;
			q.renameBar.run(name, address === undefined ? bar.address : address, id);
			return store.getBar(id);
		},

		moveBar(id: number, lat: number, lon: number): Bar | null {
			const info = q.moveBar.run(lat, lon, id);
			return info.changes ? store.getBar(id) : null;
		},

		/** Supprime un bar et tous ses passages. */
		deleteBar(id: number): boolean {
			return q.deleteBar.run(id).changes > 0;
		},

		/**
		 * Fusionne A dans B : les passages de A passent sur B, A est supprimé.
		 * Si B n'a pas d'identifiant OSM et que A en a un, B le récupère.
		 */
		mergeBars(fromId: number, intoId: number): MergeBarsResult {
			if (fromId === intoId) return { ok: false, reason: 'same_bar' };
			return db.transaction((): MergeBarsResult => {
				const from = store.getBar(fromId);
				const into = store.getBar(intoId);
				if (!from || !into) return { ok: false, reason: 'not_found' };
				const moved = q.moveVisits.run(intoId, fromId).changes;
				q.deleteBar.run(fromId);
				if (into.sourceId === null && from.sourceId !== null) {
					q.setBarSource.run(from.source, from.sourceId, from.category, intoId);
				}
				return { ok: true, bar: store.getBar(intoId)!, movedVisits: moved };
			})();
		},

		/* ---------------- Passages ---------------- */

		/**
		 * Crée un passage (et le bar si besoin, dans la même transaction).
		 * Renvoie le jeton d'auteur EN CLAIR : à renvoyer au navigateur, jamais stocké.
		 */
		createVisit(choice: BarChoice, input: VisitInput): CreateVisitResult {
			return db.transaction((): CreateVisitResult => {
				const bar = store.resolveBar(choice);
				if (!bar) return { ok: false, reason: 'bar_not_found' };
				const { token, hash } = generateToken();
				const info = q.insertVisit.run({ ...visitParams(input), bar_id: bar.id, token_hash: hash });
				const visit = toVisit(q.visitById.get(Number(info.lastInsertRowid))!);
				return { ok: true, visit, bar, token };
			})();
		},

		getVisit(id: number): Visit | null {
			const r = q.visitById.get(id);
			return r ? toVisit(r) : null;
		},

		/** L'admin ou le détenteur du jeton peut-il modifier ce passage ? */
		checkVisitAccess(id: number, auth: VisitAuth): VisitAccess {
			return checkAccess(q.visitById.get(id), auth);
		},

		updateVisit(id: number, input: VisitInput, auth: VisitAuth): UpdateVisitResult {
			const access = checkAccess(q.visitById.get(id), auth);
			if (access !== 'ok') return { ok: false, reason: access };
			q.updateVisit.run({ ...visitParams(input), id });
			return { ok: true, visit: store.getVisit(id)! };
		},

		/** Supprime un passage. Un bar qui n'a plus aucun passage est supprimé aussi. */
		deleteVisit(id: number, auth: VisitAuth): DeleteVisitResult {
			return db.transaction((): DeleteVisitResult => {
				const row = q.visitById.get(id);
				const access = checkAccess(row, auth);
				if (access !== 'ok') return { ok: false, reason: access };
				q.deleteVisit.run(id);
				const barId = row!.bar_id;
				const left = q.countVisitsOfBar.get(barId)!.n;
				if (left === 0) q.deleteBar.run(barId);
				return { ok: true, barId, barDeleted: left === 0 };
			})();
		},

		/** Passages d'un bar, du plus récent au plus ancien. */
		listVisitsByBar(barId: number): Visit[] {
			return q.visitsByBar.all(barId).map(toVisit);
		},

		/** Passages d'un barathonien (clé `pseudoKey`), du plus récent au plus ancien. */
		listVisitsByPerson(key: string): VisitWithBar[] {
			return q.visitsByPerson.all(key).map((r) => ({ ...toVisit(r), barName: r.bar_name }));
		},

		/** Derniers passages créés (admin). */
		listRecentVisits(limit = 50): VisitWithBar[] {
			return q.recentVisits.all(limit).map((r) => ({ ...toVisit(r), barName: r.bar_name }));
		},

		/* ---------------- Barathoniens ---------------- */

		/** Classement : nb de bars distincts, puis nb de passages. */
		listPeople(): Person[] {
			return rankPeople(
				q.peopleRows.all().map((r) => ({
					pseudo: r.pseudo,
					pseudoKey: r.pseudo_key,
					barId: r.bar_id,
					date: r.visit_date,
					createdAt: r.created_at
				}))
			);
		},

		getPerson(key: string): Person | null {
			return store.listPeople().find((p) => p.key === key) ?? null;
		}
	};

	return store;
}

export type Store = ReturnType<typeof createStore>;

/* ------------------------------------------------------------------ */
/* Singleton de l'application                                         */
/* ------------------------------------------------------------------ */

let singleton: Store | null = null;

/** Store de l'app (ouvre `${DATA_DIR}/barathon.db` et migre au premier appel). */
export function getStore(): Store {
	if (!singleton) singleton = createStore(openDatabase(dbPath()));
	return singleton;
}

export function closeStore(): void {
	singleton?.db.close();
	singleton = null;
}
