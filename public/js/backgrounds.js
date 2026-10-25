const rand = (seed) => {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
};

const layer = (w, h) => {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return { canvas, ctx: canvas.getContext('2d') };
};

const skyGradient = (ctx, w, h, sky) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, sky[0]);
  g.addColorStop(1, sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
};

const buildings = (ctx, w, horizon, { color, seed, minH, maxH, windows, windowColor }) => {
  const next = rand(seed);
  let x = -40;
  while (x < w + 40) {
    const bw = 40 + next() * 70;
    const bh = minH + next() * (maxH - minH);
    ctx.fillStyle = color;
    ctx.fillRect(x, horizon - bh, bw, bh);
    if (windows) {
      ctx.fillStyle = windowColor;
      for (let wy = horizon - bh + 12; wy < horizon - 14; wy += 22) {
        for (let wx = x + 8; wx < x + bw - 10; wx += 18) {
          if (next() > 0.55) ctx.fillRect(wx, wy, 6, 9);
        }
      }
    }
    x += bw + 6 + next() * 22;
  }
};

/**
 * Returns { draw(ctx, w, h, time, speed) } — an animated cyberpunk backdrop
 * painted from a background config's palette/style.
 */
export function createBackgroundPainter(config, size) {
  const { palette, style } = config;
  const horizon = Math.round(size.h * 0.58);
  const cache = layer(size.w, size.h);
  let built = false;
  let drops = null;
  let pulses = null;

  function build() {
    const ctx = cache.ctx;
    ctx.clearRect(0, 0, size.w, size.h);

    if (style === 'skyline' || style === 'solar') {
      buildings(ctx, size.w, horizon, { color: 'rgba(3,6,16,0.92)', seed: 77, count: 0, minH: 60, maxH: 210, windows: true, windowColor: palette.accent });
      buildings(ctx, size.w, horizon + 18, { color: 'rgba(2,4,10,0.96)', seed: 991, count: 0, minH: 30, maxH: 110, windows: true, windowColor: palette.horizon });
    } else if (style === 'grid') {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(size.w * 0.5, horizon - 30, 130, Math.PI, 0);
      ctx.fillStyle = palette.glow;
      ctx.globalAlpha = 0.22;
      ctx.fill();
      ctx.restore();
      buildings(ctx, size.w, horizon, { color: 'rgba(4,7,18,0.95)', seed: 4242, minH: 40, maxH: 150, windows: true, windowColor: palette.grid });
    } else if (style === 'rain') {
      buildings(ctx, size.w, horizon, { color: 'rgba(2,5,12,0.94)', seed: 8181, minH: 80, maxH: 260, windows: true, windowColor: palette.accent });
    } else if (style === 'circuit') {
      const next = rand(20261025);
      ctx.lineWidth = 2;
      for (let i = 0; i < 26; i += 1) {
        const y = 18 + next() * (size.h - 36);
        const x1 = next() * size.w;
        const x2 = x1 + (next() - 0.5) * 320;
        ctx.strokeStyle = palette.grid;
        ctx.globalAlpha = 0.16 + next() * 0.22;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x1 + (x2 - x1) * 0.6, y);
        ctx.lineTo(x2, y + (next() - 0.5) * 90);
        ctx.stroke();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = palette.glow;
        ctx.beginPath();
        ctx.arc(x2, y + (next() - 0.5) * 90, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    drops = Array.from({ length: style === 'rain' ? 90 : 0 }, () => ({
      x: Math.random() * size.w,
      y: Math.random() * size.h,
      len: 12 + Math.random() * 26,
      sp: 320 + Math.random() * 420,
    }));

    pulses = Array.from({ length: style === 'circuit' ? 14 : 0 }, () => ({
      x: Math.random() * size.w,
      y: Math.random() * size.h,
      sp: 60 + Math.random() * 180,
      dir: Math.random() > 0.5 ? 1 : -1,
    }));

    built = true;
  }

  function draw(ctx, w, h, time, speed) {
    if (!built || cache.canvas.width !== w) build();
    skyGradient(ctx, w, h, palette.sky);
    ctx.drawImage(cache.canvas, 0, 0);

    ctx.save();
    ctx.fillStyle = palette.haze;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    if (style === 'solar') {
      const g = ctx.createRadialGradient(w / 2, horizon, 10, w / 2, horizon, 300);
      g.addColorStop(0, palette.glow);
      g.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
      for (let i = 0; i < 9; i += 1) {
        const y = horizon - 150 + i * 22;
        ctx.fillStyle = palette.sky[0];
        ctx.globalAlpha = 0.7;
        ctx.fillRect(w / 2 - 160, y, 320, 7);
      }
      ctx.globalAlpha = 1;
    }

    if (style === 'grid' || style === 'solar' || style === 'rain' || style === 'skyline') {
      // Perspective floor scrolling toward the player.
      const scroll = (time * (0.35 + speed * 0.5)) % 1;
      ctx.strokeStyle = palette.grid;
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 14; i += 1) {
        const p = (i + scroll) / 14;
        const y = horizon + Math.pow(p, 2.2) * (h - horizon);
        ctx.globalAlpha = 0.12 + p * 0.4;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.globalAlpha = 0.28;
      for (let i = -10; i <= 10; i += 1) {
        ctx.beginPath();
        ctx.moveTo(w / 2 + i * 18, horizon);
        ctx.lineTo(w / 2 + i * (w / 7), h);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 26;
      ctx.shadowColor = palette.horizon;
      ctx.fillStyle = palette.horizon;
      ctx.fillRect(0, horizon - 1, w, 2);
      ctx.shadowBlur = 0;
    }

    if (style === 'tunnel') {
      const cx = w / 2;
      const cy = h * 0.44;
      ctx.strokeStyle = palette.grid;
      for (let i = 0; i < 12; i += 1) {
        const p = ((i / 12) + (time * (0.18 + speed * 0.22)) % (1 / 12)) % 1;
        const s = Math.pow(p, 2.4);
        ctx.globalAlpha = 0.2 + s * 0.62;
        ctx.lineWidth = 1.5 + s * 4;
        const rw = 40 + s * w * 1.5;
        const rh = 26 + s * h * 1.5;
        ctx.strokeRect(cx - rw / 2, cy - rh / 2, rw, rh);
      }
      ctx.globalAlpha = 1;
    }

    if (style === 'circuit' && pulses) {
      ctx.fillStyle = palette.accent;
      for (const pulse of pulses) {
        pulse.x += pulse.dir * pulse.sp * 0.016;
        if (pulse.x < 0 || pulse.x > w) { pulse.x = pulse.dir > 0 ? 0 : w; pulse.dir *= -1; }
        ctx.shadowBlur = 12;
        ctx.shadowColor = palette.glow;
        ctx.beginPath();
        ctx.arc(pulse.x, pulse.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    if (style === 'rain' && drops) {
      ctx.strokeStyle = palette.accent;
      ctx.globalAlpha = 0.42;
      ctx.lineWidth = 1.4;
      for (const d of drops) {
        d.y += d.sp * 0.016;
        d.x -= 42 * 0.016;
        if (d.y > h) { d.y = -20; d.x = Math.random() * w; }
        if (d.x < 0) d.x = w;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + 3, d.y + d.len);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Vignette keeps falling items readable on every theme.
    const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.78);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, w, h);
  }

  return { draw, config };
}
