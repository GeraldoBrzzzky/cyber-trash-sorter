import { api, redirect } from './net.js';
import { Game, LOGICAL, audio } from './game.js';
import { createBackgroundPainter } from './backgrounds.js';
import { CATEGORIES } from './data.js';

const el = (id) => document.getElementById(id);
const stage = el('stage');
const canvas = el('game');
const screens = {
  start: el('start-screen'),
  pause: el('pause-screen'),
  over: el('over-screen'),
};

let me = null;
let runId = null;
let submitting = false;

function showScreen(name) {
  for (const [key, node] of Object.entries(screens)) node.hidden = key !== name;
}

const bgById = new Map();
const activeBackground = () => bgById.get(me?.activeBackground ?? 'neon-alley') ?? [...bgById.values()][0];

const game = new Game(canvas, {
  background: activeBackground() ?? { palette: { sky: ['#080b1a', '#150a2e'], horizon: '#ff2e88', grid: '#2de2ff', glow: '#ff2e88', accent: '#f7d647', haze: 'rgba(0,0,0,0.2)' }, style: 'grid' },
  onHud: renderHud,
  onOver: () => finishSession(),
});

function renderHud(state) {
  el('hud-score').textContent = state.score.toLocaleString('id-ID');
  el('hud-combo').textContent = `×${state.multiplier}`;
  el('hud-level').textContent = state.level;
  const shields = el('hud-shields');
  shields.textContent = state.shields > 0 ? '● '.repeat(state.shields).trim() : '—';
  shields.parentElement.classList.toggle('low', state.shields <= 1);
}

/* ---------- session / wallet ---------- */

function renderProfile(user) {
  me = user;
  for (const bg of user.backgrounds ?? []) bgById.set(bg.id, bg);
  el('user-chip').textContent = `@${user.username}`;
  el('points-chip').textContent = `◈ ${user.points.toLocaleString('id-ID')}`;
  el('shop-points').textContent = user.points.toLocaleString('id-ID');
  el('start-user').textContent = user.username;
}

/* ---------- run lifecycle ---------- */

async function beginSession() {
  try {
    const res = await api('/api/game/start', { method: 'POST' });
    runId = res.runId;
  } catch {
    runId = null;
  }
  game.start();
  showScreen(null);
}

async function finishSession() {
  if (submitting) return;
  submitting = true;
  const summary = game.summary();
  game.running = false;
  game.over = true;
  showScreen('over');
  el('over-score').textContent = summary.score.toLocaleString('id-ID');
  const accuracy = summary.correct + summary.wrong + summary.missed;
  const rate = accuracy ? Math.round((summary.correct / accuracy) * 100) : 0;
  el('over-stats').innerHTML = [
    ['Sampah benar', summary.correct],
    ['Salah bin', summary.wrong],
    ['Lolos', summary.missed],
    ['Kombo terbaik', `×${Math.min(5, 1 + Math.floor(summary.bestCombo / 4))}`],
    ['Level', summary.level],
    ['Akurasi', `${rate}%`],
  ]
    .map(([label, value]) => `<div><span>${label}</span><b>${value}</b></div>`)
    .join('');

  let awardText = 'Menyimpan hasil ke server…';
  el('over-award').textContent = awardText;
  try {
    if (!runId) throw new Error('Sesi tidak dimulai.');
    const res = await api('/api/game/finish', {
      method: 'POST',
      body: { runId, ...summary },
    });
    runId = null;
    renderProfile(res.user);
    const earned = `${res.awarded.toLocaleString('id-ID')} poin`;
    el('over-award').innerHTML = res.capped
      ? `Ditransfer <strong>${earned}</strong> (dibatasi oleh validasi server).`
      : `Ditransfer <strong>${earned}</strong> ke saldomu.`;
    el('over-best').textContent = `Rekor terbaik: ${res.user.bestScore.toLocaleString('id-ID')} · Total dimainkan ${res.user.gamesPlayed} sesi`;
    buildShop();
    audio.buy();
  } catch (error) {
    el('over-award').textContent = `Skor gagal disimpan: ${error.message}`;
  } finally {
    submitting = false;
  }
}

/* ---------- input ---------- */

const toLogicalX = (clientX) => {
  const rect = canvas.getBoundingClientRect();
  return ((clientX - rect.left) / rect.width) * LOGICAL.w;
};

function syncScreens() {
  if (game.paused) return showScreen('pause');
  if (game.over) return showScreen('over');
  return showScreen(game.running ? null : 'start');
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if (['arrowleft', 'arrowright', ' ', 'a', 'd'].includes(key)) event.preventDefault();
  if (key === 'arrowleft' || key === 'a') game.setKey('left', true);
  if (key === 'arrowright' || key === 'd') game.setKey('right', true);
  if ((key === 'p' || key === 'escape') && game.running) game.setPaused(!game.paused);
  if (key === 'enter' && !(event.target instanceof HTMLButtonElement) && !game.running && !game.over) {
    return beginSession();
  }
  syncScreens();
});

window.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  if (key === 'arrowleft' || key === 'a') game.setKey('left', false);
  if (key === 'arrowright' || key === 'd') game.setKey('right', false);
});

canvas.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'mouse' && !game.running) return;
  game.handlePointer(toLogicalX(event.clientX));
});
canvas.addEventListener('pointerdown', (event) => {
  canvas.setPointerCapture?.(event.pointerId);
  game.handlePointer(toLogicalX(event.clientX));
});
canvas.addEventListener('pointerleave', () => game.clearPointer());

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.running) {
    game.setPaused(true);
    showScreen('pause');
  }
});

window.addEventListener('resize', () => game.resize());

/* ---------- buttons ---------- */

el('play-btn').addEventListener('click', beginSession);
el('again-btn').addEventListener('click', beginSession);
el('resume-btn').addEventListener('click', () => {
  game.setPaused(false);
  showScreen(null);
});
el('quit-btn').addEventListener('click', () => {
  game.setPaused(false);
  finishSession();
});
el('logout-btn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' }).catch(() => {});
  redirect('/');
});
el('help-btn').addEventListener('click', () => el('help').hidden = false);
el('shop-btn').addEventListener('click', () => el('shop').hidden = false);
el('over-shop-btn').addEventListener('click', () => el('shop').hidden = false);

document.querySelectorAll('[data-close]').forEach((node) => {
  node.addEventListener('click', () => {
    node.closest('.overlay').hidden = true;
  });
});
document.querySelectorAll('.overlay').forEach((overlay) => {
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.hidden = true;
  });
});

/* ---------- shop ---------- */

function preview(node, bg) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = node.clientWidth || 232;
  const h = 116;
  node.width = w * dpr;
  node.height = h * dpr;
  const ctx = node.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  createBackgroundPainter(bg, { w, h }).draw(ctx, w, h, 2.2, 0.45);
}

function buildShop() {
  const grid = el('shop-grid');
  grid.innerHTML = me.backgrounds
    .map((bg) => {
      const owned = me.ownedBackgrounds.includes(bg.id);
      const equipped = me.activeBackground === bg.id;
      const affordable = me.points >= bg.cost;
      let action;
      if (equipped) action = `<button class="equipped-btn" disabled>Terpasang</button>`;
      else if (owned) action = `<button class="owned" data-use="${bg.id}">Pasang</button>`;
      else if (bg.cost === 0) action = `<button class="owned" data-use="${bg.id}">Pasang</button>`;
      else action = `<button class="locked" data-buy="${bg.id}" ${affordable ? '' : 'disabled'}>Beli ◈ ${bg.cost}</button>`;
      return `
        <article class="item ${equipped ? 'equipped' : ''}" data-id="${bg.id}">
          <canvas data-preview="${bg.id}" width="232" height="116"></canvas>
          <div class="item-body">
            <h3>${bg.name}</h3>
            <p>${bg.tagline}</p>
            ${owned || bg.cost === 0 ? '' : `<span class="price">◈ ${bg.cost} poin</span>`}
            ${action}
          </div>
        </article>`;
    })
    .join('');

  grid.querySelectorAll('canvas[data-preview]').forEach((node) => {
    preview(node, bgById.get(node.dataset.preview));
  });
}

async function refresh() {
  const { user } = await api('/api/me');
  renderProfile(user);
  buildShop();
  return user;
}

el('shop-grid').addEventListener('click', async (event) => {
  const buy = event.target.closest('[data-buy]')?.dataset.buy;
  const use = event.target.closest('[data-use]')?.dataset.use;
  if (!buy && !use) return;
  const message = el('shop-msg');
  message.textContent = 'Memproses…';
  try {
    const { user } = await api(buy ? '/api/backgrounds/buy' : '/api/backgrounds/select', {
      method: 'POST',
      body: { id: buy || use },
    });
    renderProfile(user);
    buildShop();
    audio.buy();
    if (!buy) {
      game.setBackground(activeBackground());
      message.textContent = `Background ${activeBackground().name} terpasang di arena.`;
    } else {
      message.textContent = 'Berhasil dibeli! Klik "Pasang" untuk memakainya.';
    }
  } catch (error) {
    message.textContent = error.message;
  }
});

/* ---------- boot ---------- */

const FALLBACK = {
  id: 'neon-alley',
  name: 'Neon Alley',
  style: 'grid',
  palette: { sky: ['#080b1a', '#150a2e'], horizon: '#ff2e88', grid: '#2de2ff', glow: '#ff2e88', accent: '#f7d647', haze: 'rgba(45,226,255,0.10)' },
};

(async function boot() {
  const loop = (now) => {
    game.frame(now);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  new ResizeObserver(() => game.resize()).observe(stage);

  try {
    const user = await refresh();
    game.setBackground(activeBackground() ?? FALLBACK);
  } catch (error) {
    if (error.status === 401) return redirect('/');
    el('start-title').textContent = 'Gagal memuat data';
    el('play-btn').disabled = true;
    el('play-btn').textContent = error.message;
    return;
  }
  showScreen('start');
  el('hud-legend').textContent =
    `← → / A D geser cart · P jeda · kategori: ${Object.values(CATEGORIES).map((c) => c.label).join(' / ')}`;
})();
