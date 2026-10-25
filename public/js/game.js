import { BIN_ORDER, CATEGORIES, TRASH } from './data.js';
import { createBackgroundPainter } from './backgrounds.js';

export const LOGICAL = { w: 960, h: 600 };
const BIN_W = 118;
const BIN_GAP = 14;
const BIN_H = 112;
const CART_W = BIN_W * 3 + BIN_GAP * 2;
const RIM_Y = LOGICAL.h - 148;
const GROUND_Y = LOGICAL.h - 24;
const MAX_LEVEL = 14;
const POINTS_PER_CATCH = 10;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;

const CATCH_TOLERANCE = BIN_W / 2 - 6;

/**
 * Horizontal span over which bin `index` can actually be parked. The cart only
 * travels between CART_W/2 and w-CART_W/2, so the left bin can never serve the
 * right edge of the arena and vice versa — spawns must stay inside this window.
 */
function reachFor(index) {
  const offset = index * (BIN_W + BIN_GAP) + BIN_W / 2;
  const minCenter = offset;
  const maxCenter = LOGICAL.w - CART_W + offset;
  return [
    Math.max(36, minCenter - CATCH_TOLERANCE),
    Math.min(LOGICAL.w - 36, maxCenter + CATCH_TOLERANCE),
  ];
}

const sound = (() => {
  const Ctor = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  let ctx = null;
  let muted = false;
  const tone = (freq, dur, type = 'square', gain = 0.05, slide = 0) => {
    if (muted || !Ctor) return;
    ctx ||= new Ctor();
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + dur);
    amp.gain.setValueAtTime(gain, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.connect(amp).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  };
  return {
    correct: (combo) => tone(420 + Math.min(combo, 8) * 70, 0.12, 'triangle', 0.06),
    wrong: () => { tone(150, 0.22, 'sawtooth', 0.06, -80); tone(96, 0.3, 'square', 0.04, -40); },
    miss: () => tone(210, 0.14, 'sine', 0.035, -110),
    level: () => [0, 90, 180].forEach((d, i) => setTimeout(() => tone(520 + i * 180, 0.12, 'square', 0.045), d)),
    over: () => [0, 140, 300].forEach((d, i) => setTimeout(() => tone(300 - i * 90, 0.3, 'sawtooth', 0.05, -60), d)),
    buy: () => tone(680, 0.16, 'triangle', 0.05, 240),
    toggle: (on) => { muted = on; },
  };
})();

export class Game {
  constructor(canvas, { background, onHud, onOver }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onHud = onHud;
    this.onOver = onOver;
    this.lastFrame = performance.now();
    this.time = 0;
    this.setBackground(background);
    this.reset();
    this.resize();
  }

  /** Match the backing store to the CSS size so the neon stays sharp. */
  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const cssW = this.canvas.clientWidth || LOGICAL.w;
    const cssH = cssW * (LOGICAL.h / LOGICAL.w);
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    const scale = this.canvas.width / LOGICAL.w;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
  }

  setBackground(config) {
    this.background = config;
    this.painter = createBackgroundPainter(config, LOGICAL);
  }

  static categoryFor(binIndex) {
    return CATEGORIES[BIN_ORDER[binIndex]];
  }

  binCenter(index) {
    return this.cartX - CART_W / 2 + index * (BIN_W + BIN_GAP) + BIN_W / 2;
  }

  reset() {
    this.items = [];
    this.particles = [];
    this.floaters = [];
    this.cartX = LOGICAL.w / 2;
    this.pointerX = null;
    this.keys = { left: false, right: false };
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.shields = 4;
    this.level = 1;
    this.correct = 0;
    this.wrong = 0;
    this.missed = 0;
    this.elapsed = 0;
    this.spawnTimer = 0.4;
    this.shake = 0;
    this.flash = null;
    this.running = false;
    this.paused = false;
    this.over = false;
    this.binFlash = [0, 0, 0];
    this.pushHud();
  }

  get multiplier() {
    return Math.min(5, 1 + Math.floor(this.combo / 4));
  }

  start() {
    this.reset();
    this.running = true;
    this.lastFrame = performance.now();
    this.pushHud();
  }

  setPaused(value) {
    if (!this.running || this.over) return;
    this.paused = value;
    if (!value) this.lastFrame = performance.now();
  }

  destroy() {
    this.running = false;
  }

  pushHud() {
    this.onHud?.({
      score: this.score,
      combo: this.combo,
      multiplier: this.multiplier,
      bestCombo: this.bestCombo,
      shields: this.shields,
      level: this.level,
      correct: this.correct,
      wrong: this.wrong,
      missed: this.missed,
      elapsed: Math.round(this.elapsed),
    });
  }

  spawn() {
    const template = TRASH[Math.floor(Math.random() * TRASH.length)];
    const [minX, maxX] = reachFor(BIN_ORDER.indexOf(template.category));
    this.items.push({
      ...template,
      minX,
      maxX,
      x: minX + Math.random() * (maxX - minX),
      y: -40,
      r: 31,
      vy: 132 + this.level * 15 + Math.random() * 34,
      drift: (Math.random() - 0.5) * 34,
      rot: (Math.random() - 0.5) * 0.5,
      spin: (Math.random() - 0.5) * 1.6,
      fading: 0,
    });
  }

  burst(x, y, color, count = 18) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 260;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 60,
        life: 0.55 + Math.random() * 0.5,
        age: 0,
        size: 1.6 + Math.random() * 3.4,
        color,
      });
    }
  }

  float(x, y, text, color, big = false) {
    this.floaters.push({ x, y, text, color, age: 0, life: big ? 1.3 : 0.95, big });
  }

  resolveCatch(item, binIndex) {
    const bin = Game.categoryFor(binIndex);
    const right = item.category === bin.id;
    const cx = this.binCenter(binIndex);
    this.binFlash[binIndex] = 1;

    if (right) {
      const gain = Math.round((POINTS_PER_CATCH + this.level * 2) * this.multiplier * (item.bonus ?? 1));
      this.score += gain;
      this.combo += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.correct += 1;
      const nextLevel = Math.min(MAX_LEVEL, 1 + Math.floor(this.correct / 12));
      if (nextLevel > this.level) {
        this.level = nextLevel;
        this.float(LOGICAL.w / 2, LOGICAL.h * 0.34, `LEVEL ${this.level}`, this.background.palette.accent, true);
        sound.level();
      }
      this.burst(cx, RIM_Y + 18, bin.color, 22);
      this.float(cx, RIM_Y - 14, `+${gain}${this.multiplier > 1 ? ` ×${this.multiplier}` : ''}`, bin.color);
      sound.correct(this.combo);
    } else {
      this.wrong += 1;
      this.combo = 0;
      this.shields -= 1;
      this.shake = 1;
      this.flash = { color: bin.color, age: 0 };
      this.burst(cx, RIM_Y + 18, '#ff3b3b', 26);
      this.float(cx, RIM_Y - 14, `${item.name} ≠ ${bin.label}`, '#ff6b6b', true);
      sound.wrong();
      if (this.shields <= 0) return this.endRun();
    }
    this.pushHud();
    return true;
  }

  endRun() {
    this.over = true;
    this.running = false;
    sound.over();
    this.onOver?.(this.summary());
    return false;
  }

  summary() {
    return {
      score: this.score,
      level: this.level,
      bestCombo: this.bestCombo,
      correct: this.correct,
      wrong: this.wrong,
      missed: this.missed,
      durationMs: Math.round(this.elapsed * 1000),
    };
  }

  handlePointer(x) {
    this.pointerX = x;
  }

  clearPointer() {
    this.pointerX = null;
  }

  setKey(dir, down) {
    if (dir === 'left') this.keys.left = down;
    else this.keys.right = down;
    if (down) this.pointerX = null;
  }

  update(dt) {
    this.elapsed += dt;

    const speed = 660;
    const keyDir = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    if (this.pointerX != null) {
      this.cartX = lerp(this.cartX, clamp(this.pointerX, CART_W / 2, LOGICAL.w - CART_W / 2), 1 - Math.exp(-dt * 16));
    } else if (keyDir) {
      this.cartX += keyDir * speed * dt;
    }
    this.cartX = clamp(this.cartX, CART_W / 2, LOGICAL.w - CART_W / 2);

    this.spawnTimer -= dt;
    const maxItems = Math.min(6, 2 + Math.floor(this.level / 2));
    const interval = Math.max(0.5, 1.45 - this.level * 0.068);
    if (this.spawnTimer <= 0 && this.items.length < maxItems) {
      this.spawn();
      this.spawnTimer = interval;
    }

    for (let i = this.items.length - 1; i >= 0; i -= 1) {
      const item = this.items[i];
      if (item.fading > 0) {
        item.fading += dt;
        item.y += 240 * dt;
        if (item.fading > 0.32) this.items.splice(i, 1);
        continue;
      }
      item.y += item.vy * dt;
      item.x = clamp(item.x + item.drift * dt, item.minX, item.maxX);
      item.rot += item.spin * dt;

      if (item.y + item.r * 0.5 >= RIM_Y && item.y < RIM_Y + BIN_H) {
        let landed = -1;
        for (let b = 0; b < 3; b += 1) {
          if (Math.abs(item.x - this.binCenter(b)) <= BIN_W / 2 - 6) { landed = b; break; }
        }
        if (landed >= 0) {
          item.fading = 0.001;
          item.x = this.binCenter(landed);
          this.resolveCatch(item, landed);
          if (this.over) return;
          continue;
        }
      }
      if (item.y - item.r > GROUND_Y) {
        this.items.splice(i, 1);
        this.missed += 1;
        this.combo = 0;
        this.float(item.x, GROUND_Y - 30, 'BOCOR', '#ffb37c');
        this.burst(item.x, GROUND_Y, '#ff9f1c', 10);
        sound.miss();
        this.pushHud();
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.age += dt;
      p.vy += 520 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.age > p.life) this.particles.splice(i, 1);
    }
    for (let i = this.floaters.length - 1; i >= 0; i -= 1) {
      const f = this.floaters[i];
      f.age += dt;
      f.y -= 34 * dt;
      if (f.age > f.life) this.floaters.splice(i, 1);
    }
    for (let b = 0; b < 3; b += 1) this.binFlash[b] = Math.max(0, this.binFlash[b] - dt * 2.6);
    this.shake = Math.max(0, this.shake - dt * 3.2);
    if (this.flash) {
      this.flash.age += dt;
      if (this.flash.age > 0.3) this.flash = null;
    }
  }

  drawItem(ctx, item) {
    const cat = CATEGORIES[item.category];
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.rotate(item.rot * 0.22);
    if (item.fading > 0) ctx.globalAlpha = 1 - item.fading / 0.32;

    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const px = Math.cos(a) * item.r;
      const py = Math.sin(a) * item.r;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(6,10,22,0.82)';
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = cat.color;
    ctx.shadowBlur = 16;
    ctx.shadowColor = cat.color;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.font = `${Math.round(item.r * 1.05)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.glyph, 0, 2);

    if (item.bonus) {
      ctx.font = '700 11px Orbitron, sans-serif';
      ctx.fillStyle = this.background.palette.accent;
      ctx.fillText(`×${item.bonus}`, 0, -item.r - 10);
    }
    ctx.restore();
  }

  drawCart(ctx) {
    const left = this.cartX - CART_W / 2;
    ctx.save();

    // thruster glow
    const g = ctx.createLinearGradient(0, RIM_Y + BIN_H, 0, RIM_Y + BIN_H + 42);
    g.addColorStop(0, 'rgba(45,226,255,0.5)');
    g.addColorStop(1, 'rgba(45,226,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(left + 10, RIM_Y + BIN_H, CART_W - 20, 42);

    for (let i = 0; i < 3; i += 1) {
      const cat = Game.categoryFor(i);
      const x = left + i * (BIN_W + BIN_GAP);
      const flash = this.binFlash[i];

      ctx.beginPath();
      ctx.roundRect(x, RIM_Y, BIN_W, BIN_H, [12, 12, 6, 6]);
      ctx.fillStyle = `rgba(${cat.id === 'organik' ? '13,59,36' : cat.id === 'anorganik' ? '10,44,59' : '59,10,32'},0.92)`;
      ctx.fill();
      ctx.lineWidth = 2 + flash * 4;
      ctx.strokeStyle = cat.color;
      ctx.shadowBlur = 12 + flash * 30;
      ctx.shadowColor = cat.color;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // opening
      ctx.beginPath();
      ctx.ellipse(x + BIN_W / 2, RIM_Y + 3, BIN_W / 2 - 8, 9, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.72)';
      ctx.fill();
      ctx.strokeStyle = cat.color;
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '26px "Segoe UI Emoji", sans-serif';
      ctx.fillText(cat.icon, x + BIN_W / 2, RIM_Y + 44);
      ctx.font = '700 16px Orbitron, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.shadowBlur = 10;
      ctx.shadowColor = cat.color;
      ctx.fillText(cat.label.toUpperCase(), x + BIN_W / 2, RIM_Y + 78);
      ctx.shadowBlur = 0;

      ctx.fillStyle = cat.color;
      ctx.globalAlpha = 0.35 + flash * 0.65;
      ctx.fillRect(x + 8, RIM_Y + BIN_H - 12, BIN_W - 16, 4);
      ctx.globalAlpha = 1;
    }

    // chassis rails
    ctx.strokeStyle = this.background.palette.grid;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.moveTo(left - 16, RIM_Y + BIN_H + 6);
    ctx.lineTo(left + CART_W + 16, RIM_Y + BIN_H + 6);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  draw(ctx) {
    const { w, h } = LOGICAL;
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * 14 * this.shake, (Math.random() - 0.5) * 10 * this.shake);
    }

    this.painter.draw(ctx, w, h, this.time, (this.level - 1) / MAX_LEVEL);

    // ground strip
    ctx.strokeStyle = this.background.palette.horizon;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(w, GROUND_Y);
    ctx.stroke();
    ctx.globalAlpha = 1;

    this.drawCart(ctx);
    for (const item of this.items) this.drawItem(ctx, item);

    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    for (const f of this.floaters) {
      ctx.globalAlpha = Math.max(0, 1 - f.age / f.life);
      ctx.font = `700 ${f.big ? 26 : 18}px Orbitron, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = f.color;
      ctx.shadowBlur = 14;
      ctx.shadowColor = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;

    if (this.flash) {
      ctx.globalAlpha = (1 - this.flash.age / 0.3) * 0.28;
      ctx.fillStyle = '#ff2e4e';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  frame(now) {
    const dt = Math.min(0.033, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    // Time always advances so the city keeps moving behind the menus.
    this.time += dt;
    if (this.running && !this.paused) this.update(dt);
    this.draw(this.ctx);
  }
}

export const audio = sound;
