#!/usr/bin/env node
/**
 * Snapshot cohérent de la base, même pendant que le site tourne (API de backup SQLite).
 *
 *   node scripts/backup.mjs <destination>
 *   docker exec barathon-web node scripts/backup.mjs /data/snapshot.db
 *
 * Source : ${DATA_DIR:-./data}/barathon.db. Le fichier produit est autonome (journal DELETE,
 * pas de -wal à côté), vérifié (integrity_check) puis renommé atomiquement à la destination.
 * Code de sortie : 0 = OK, 1 = échec, 2 = mauvais usage.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dest = process.argv[2];
if (!dest) {
	console.error('Usage : node scripts/backup.mjs <fichier de destination>');
	process.exit(2);
}

const dataDir = process.env.DATA_DIR?.trim() || './data';
const source = path.resolve(dataDir, 'barathon.db');
const target = path.resolve(dest);

if (!fs.existsSync(source)) {
	console.error(`[backup] Base introuvable : ${source}`);
	process.exit(1);
}
if (target === source) {
	console.error('[backup] La destination doit être différente de la base.');
	process.exit(2);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
const tmp = `${target}.tmp-${process.pid}`;

try {
	const db = new Database(source, { fileMustExist: true });
	try {
		await db.backup(tmp);
	} finally {
		db.close();
	}

	const copy = new Database(tmp);
	let summary;
	try {
		copy.pragma('journal_mode = DELETE');
		const integrity = copy.pragma('integrity_check', { simple: true });
		if (integrity !== 'ok') throw new Error(`integrity_check : ${integrity}`);
		const count = (table) => {
			try {
				return copy.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
			} catch {
				return 0;
			}
		};
		summary = `${count('bars')} bars, ${count('visits')} passages`;
	} finally {
		copy.close();
	}

	fs.renameSync(tmp, target);
	const size = fs.statSync(target).size;
	console.log(`[backup] OK : ${target} (${size} octets, ${summary})`);
} catch (err) {
	fs.rmSync(tmp, { force: true });
	console.error(`[backup] Échec : ${err instanceof Error ? err.message : err}`);
	process.exit(1);
}
