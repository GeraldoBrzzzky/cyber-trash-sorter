import crypto from 'node:crypto';
import { db } from './db.js';
import { publicUser, getUserById } from './auth.js';

const insertRun = db.prepare('INSERT INTO runs (id, user_id, started_at) VALUES (?, ?, ?)');
const selectOpenRun = db.prepare(
  'SELECT id, started_at FROM runs WHERE id = ? AND user_id = ? AND finished = 0'
);
const consumeRun = db.prepare('UPDATE runs SET finished = 1, score = ? WHERE id = ?');
const creditResult = db.prepare(
  `UPDATE users
     SET points = points + ?,
         lifetime_points = lifetime_points + ?,
         best_score = MAX(best_score, ?),
         games_played = games_played + 1,
         correct_count = correct_count + ?,
         wrong_count = wrong_count + ?,
         missed_count = missed_count + ?
   WHERE id = ?`
);

export function startRun(userId) {
  const id = crypto.randomUUID();
  insertRun.run(id, userId, Date.now());
  return { runId: id };
}

// A skilled player clears roughly one bin per second at max combo. Anything
// much faster than that is a forged result, so the award gets capped.
const MAX_POINTS_PER_SECOND = 80;
const MAX_RUN_MS = 2 * 60 * 60 * 1000;

export function finishRun({ userId, runId, score, correct, wrong, missed }) {
  const run = selectOpenRun.get(runId, userId);
  if (!run) return { error: 'invalid_run', status: 400 };

  const elapsedMs = Math.max(Date.now() - run.started_at, 1000);
  if (elapsedMs > MAX_RUN_MS) return { error: 'run_expired', status: 400 };

  const claimed = Math.max(0, Math.min(Math.trunc(score) || 0, 5_000_000));
  const awarded = Math.min(claimed, Math.trunc((elapsedMs / 1000) * MAX_POINTS_PER_SECOND));

  consumeRun.run(claimed, runId);
  creditResult.run(
    awarded,
    awarded,
    claimed,
    Math.max(0, Math.trunc(correct) || 0),
    Math.max(0, Math.trunc(wrong) || 0),
    Math.max(0, Math.trunc(missed) || 0),
    userId
  );

  const user = getUserById(userId);
  return { status: 200, awarded, capped: awarded < claimed, user: publicUser(user) };
}

const leaderboardStmt = db.prepare(
  'SELECT username, best_score, lifetime_points FROM users ORDER BY best_score DESC, lifetime_points DESC LIMIT 10'
);

export function leaderboard() {
  return leaderboardStmt.all();
}
