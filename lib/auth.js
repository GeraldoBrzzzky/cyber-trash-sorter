import crypto from 'node:crypto';
import { db } from './db.js';
import { FREE_STARTER } from './backgrounds.js';

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = 'cts_session';

const insertSession = db.prepare(
  'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
);
const selectSession = db.prepare(
  'SELECT user_id, expires_at FROM sessions WHERE token_hash = ?'
);
const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?');

const hashPassword = (password, salt) =>
  crypto.scryptSync(password, salt, 64).toString('hex');

const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');

export function createUser(username, password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const now = Date.now();
  const insertUser = db.prepare(
    `INSERT INTO users (username, password_hash, password_salt, active_background, created_at)
     VALUES (?, ?, ?, 'neon-alley', ?)`
  );
  const own = db.prepare(
    'INSERT INTO user_backgrounds (user_id, background_id, purchased_at) VALUES (?, ?, ?)'
  );
  const id = db.transaction(() => {
    const info = insertUser.run(username, hashPassword(password, salt), salt, now);
    for (const backgroundId of FREE_STARTER) own.run(info.lastInsertRowid, backgroundId, now);
    return info.lastInsertRowid;
  })();
  return getUserById(id);
}

export function verifyLogin(username, password) {
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) return null;
  const candidate = Buffer.from(hashPassword(password, user.password_salt), 'hex');
  const stored = Buffer.from(user.password_hash, 'hex');
  if (candidate.length !== stored.length || !crypto.timingSafeEqual(candidate, stored)) {
    return null;
  }
  return user;
}

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  insertSession.run(tokenHash(token), userId, Date.now(), Date.now() + SESSION_TTL_MS);
  return { token, maxAgeMs: SESSION_TTL_MS };
}

export function destroySession(token) {
  if (token) deleteSession.run(tokenHash(token));
}

export function getUserByToken(token) {
  if (!token) return null;
  const row = selectSession.get(tokenHash(token));
  if (!row || row.expires_at < Date.now()) return null;
  return getUserById(row.user_id);
}

export function getUserById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) ?? null;
}

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export function validateCredentials(username, password) {
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) {
    return 'Username 3-20 karakter: huruf kecil, angka, atau underscore.';
  }
  if (typeof password !== 'string' || password.length < 6 || password.length > 72) {
    return 'Password minimal 6 karakter.';
  }
  return null;
}

/** Public shape of a user row — never leak hash/salt to the client. */
export function publicUser(user) {
  return {
    username: user.username,
    points: user.points,
    lifetimePoints: user.lifetime_points,
    bestScore: user.best_score,
    gamesPlayed: user.games_played,
    correctCount: user.correct_count,
    wrongCount: user.wrong_count,
    missedCount: user.missed_count,
    activeBackground: user.active_background,
  };
}
