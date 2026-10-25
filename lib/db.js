import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, '..', 'data');
fs.mkdirSync(dataDir, { recursive: true });

export const db = new Database(path.join(dataDir, 'game.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    username        TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    password_salt   TEXT NOT NULL,
    points          INTEGER NOT NULL DEFAULT 0,
    lifetime_points INTEGER NOT NULL DEFAULT 0,
    best_score      INTEGER NOT NULL DEFAULT 0,
    games_played    INTEGER NOT NULL DEFAULT 0,
    correct_count   INTEGER NOT NULL DEFAULT 0,
    wrong_count     INTEGER NOT NULL DEFAULT 0,
    missed_count    INTEGER NOT NULL DEFAULT 0,
    active_background TEXT NOT NULL DEFAULT 'neon-alley',
    created_at      INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_backgrounds (
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    background_id TEXT NOT NULL,
    purchased_at  INTEGER NOT NULL,
    PRIMARY KEY (user_id, background_id)
  );

  CREATE TABLE IF NOT EXISTS runs (
    id         TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at INTEGER NOT NULL,
    score      INTEGER NOT NULL DEFAULT 0,
    finished   INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id);
`);

// Runs are single-use tickets; drop anything older than a day.
db.prepare('DELETE FROM runs WHERE started_at < ?').run(Date.now() - 86400000);
db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
