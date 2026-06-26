import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = process.env.DB_DIR ?? path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'umbulan.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS sesi (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      titik      TEXT    NOT NULL,
      kode_titik TEXT,
      lat        REAL,
      lng        REAL,
      petugas    TEXT,
      jenis      TEXT    NOT NULL CHECK(jenis IN ('kualitas','kualitas_debit')),
      waktu_mulai   TEXT NOT NULL,
      waktu_selesai TEXT,
      muka_air_awal_cm  REAL,
      muka_air_akhir_cm REAL,
      catatan    TEXT,
      status     TEXT NOT NULL DEFAULT 'aktif' CHECK(status IN ('aktif','selesai'))
    );

    CREATE TABLE IF NOT EXISTS snapshot (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      sesi_id  INTEGER NOT NULL REFERENCES sesi(id) ON DELETE CASCADE,
      waktu    TEXT    NOT NULL,
      temperature   REAL,
      ph            REAL,
      turbidity     REAL,
      do_estimated  REAL,
      water_level_cm REAL,
      discharge_m3s  REAL
    );

    CREATE INDEX IF NOT EXISTS idx_snapshot_sesi ON snapshot(sesi_id);
    CREATE INDEX IF NOT EXISTS idx_sesi_status   ON sesi(status);
    CREATE INDEX IF NOT EXISTS idx_sesi_mulai    ON sesi(waktu_mulai DESC);
  `);

  return _db;
}
