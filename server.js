import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { db } from './lib/db.js';
import {
  SESSION_COOKIE,
  createSession,
  createUser,
  destroySession,
  getUserByToken,
  getUserById,
  publicUser,
  validateCredentials,
  verifyLogin,
} from './lib/auth.js';
import { BACKGROUNDS, backgroundIds, findBackground } from './lib/backgrounds.js';
import { finishRun, leaderboard, startRun } from './lib/gameStore.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));

const parseCookies = (header = '') =>
  Object.fromEntries(
    header.split(';').map((part) => {
      const index = part.indexOf('=');
      return index === -1
        ? [part.trim(), '']
        : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
    })
  );

/** Attaches req.user for protected routes, otherwise replies 401. */
function requireUser(req, res, next) {
  const token = parseCookies(req.headers.cookie ?? '')[SESSION_COOKIE];
  const user = getUserByToken(token);
  if (!user) return res.status(401).json({ error: 'Silakan sign in terlebih dahulu.' });
  req.user = user;
  req.sessionToken = token;
  return next();
}

function sendSession(res, { token, maxAgeMs }) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}`
  );
}

const ownedIds = (userId) =>
  db
    .prepare('SELECT background_id AS id FROM user_backgrounds WHERE user_id = ?')
    .all(userId)
    .map((row) => row.id);

const profile = (user) => ({
  ...publicUser(user),
  ownedBackgrounds: ownedIds(user.id),
  backgrounds: BACKGROUNDS,
});

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.get('/api/backgrounds', (_req, res) => res.json({ backgrounds: BACKGROUNDS }));

app.post('/api/auth/signup', (req, res) => {
  const username = String(req.body?.username ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const invalid = validateCredentials(username, password);
  if (invalid) return res.status(400).json({ error: invalid });
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'Username sudah dipakai, coba nama lain.' });
  }
  const user = createUser(username, password);
  sendSession(res, createSession(user.id));
  res.status(201).json({ user: profile(user) });
});

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body?.username ?? '').trim().toLowerCase();
  const password = String(req.body?.password ?? '');
  const user = verifyLogin(username, password);
  if (!user) return res.status(401).json({ error: 'Username atau password salah.' });
  sendSession(res, createSession(user.id));
  res.json({ user: profile(user) });
});

app.post('/api/auth/logout', requireUser, (req, res) => {
  destroySession(req.sessionToken);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
  res.json({ ok: true });
});

app.get('/api/me', requireUser, (req, res) => res.json({ user: profile(req.user) }));

app.post('/api/backgrounds/buy', requireUser, (req, res) => {
  const id = String(req.body?.id ?? '');
  const item = findBackground(id);
  if (!item) return res.status(400).json({ error: 'Background tidak ditemukan.' });
  if (ownedIds(req.user.id).includes(id)) {
    return res.status(409).json({ error: 'Background sudah kamu miliki.' });
  }
  if (req.user.points < item.cost) {
    return res.status(400).json({ error: `Poin kurang ${item.cost - req.user.points}.` });
  }
  db.transaction(() => {
    const spent = db
      .prepare('UPDATE users SET points = points - ? WHERE id = ? AND points >= ?')
      .run(item.cost, req.user.id, item.cost);
    if (spent.changes === 0) throw new Error('Poin tidak cukup.');
    db.prepare(
      'INSERT INTO user_backgrounds (user_id, background_id, purchased_at) VALUES (?, ?, ?)'
    ).run(req.user.id, id, Date.now());
  })();
  res.json({ user: profile(getUserById(req.user.id)) });
});

app.post('/api/backgrounds/select', requireUser, (req, res) => {
  const id = String(req.body?.id ?? '');
  if (!backgroundIds.has(id)) return res.status(400).json({ error: 'Background tidak ditemukan.' });
  if (!ownedIds(req.user.id).includes(id)) {
    return res.status(403).json({ error: 'Beli background ini terlebih dahulu.' });
  }
  db.prepare('UPDATE users SET active_background = ? WHERE id = ?').run(id, req.user.id);
  res.json({ user: profile(getUserById(req.user.id)) });
});

app.get('/api/leaderboard', (_req, res) => res.json({ rows: leaderboard() }));

app.post('/api/game/start', requireUser, (req, res) => {
  res.json(startRun(req.user.id));
});

app.post('/api/game/finish', requireUser, (req, res) => {
  const body = req.body ?? {};
  const result = finishRun({
    userId: req.user.id,
    runId: String(body.runId ?? ''),
    score: Number(body.score),
    correct: Number(body.correct),
    wrong: Number(body.wrong),
    missed: Number(body.missed),
  });
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({
    awarded: result.awarded,
    capped: result.capped,
    user: profile(getUserById(req.user.id)),
  });
});


app.use(express.static(path.join(root, 'public'), { extensions: ['html'] }));

app.use((req, res) => {
  res.status(404);
  if (req.path.startsWith('/api/')) return res.json({ error: 'Endpoint tidak ditemukan.' });
  res.sendFile(path.join(root, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Cyber Trash Sorter siap di http://localhost:${PORT}`);
});
