export const FREE_BACKGROUND_ID = 'neon-alley';

const background = (cfg) => ({
  style: 'grid',
  cost: 0,
  ...cfg,
  palette: cfg.palette,
});

export const BACKGROUNDS = [
  background({
    id: 'neon-alley',
    name: 'Neon Alley',
    tagline: 'Gang belakang market, selalu nyala.',
    cost: 0,
    style: 'grid',
    palette: { sky: ['#080b1a', '#150a2e'], horizon: '#ff2e88', grid: '#2de2ff', glow: '#ff2e88', accent: '#f7d647', haze: 'rgba(45,226,255,0.10)' },
  }),
  background({
    id: 'acid-rain',
    name: 'Acid Rain',
    tagline: 'Hujan neon di atas aspal basah.',
    cost: 350,
    style: 'rain',
    palette: { sky: ['#04070f', '#0d1b2a'], horizon: '#2de2ff', grid: '#1b6d8c', glow: '#39ff88', accent: '#9be7ff', haze: 'rgba(57,255,136,0.08)' },
  }),
  background({
    id: 'chrome-skyline',
    name: 'Chrome Skyline',
    tagline: 'Menara krom, kota tak pernah tidur.',
    cost: 800,
    style: 'skyline',
    palette: { sky: ['#0a0518', '#2b0a4d'], horizon: '#ff6ec7', grid: '#7b2fbf', glow: '#ff6ec7', accent: '#ffd166', haze: 'rgba(255,110,199,0.10)' },
  }),
  background({
    id: 'circuit-void',
    name: 'Circuit Void',
    tagline: 'Jalur sirkuit melayang di ruang kosong.',
    cost: 1500,
    style: 'circuit',
    palette: { sky: ['#000607', '#04211f'], horizon: '#00ffc6', grid: '#0affc2', glow: '#00ffc6', accent: '#ff9f1c', haze: 'rgba(0,255,198,0.07)' },
  }),
  background({
    id: 'hyper-tunnel',
    name: 'Hyper Tunnel',
    tagline: 'Terowongan data, kecepatan maksimum.',
    cost: 2600,
    style: 'tunnel',
    palette: { sky: ['#0b0013', '#1a0033'], horizon: '#b967ff', grid: '#ff2e88', glow: '#b967ff', accent: '#2de2ff', haze: 'rgba(185,103,255,0.12)' },
  }),
  background({
    id: 'solar-grid',
    name: 'Solar Grid',
    tagline: 'Panel surya oranye di ufuk kota lama.',
    cost: 4200,
    style: 'solar',
    palette: { sky: ['#140606', '#3d1200'], horizon: '#ffb703', grid: '#fb8500', glow: '#ffd166', accent: '#00ffc6', haze: 'rgba(255,183,3,0.10)' },
  }),
];

export const FREE_STARTER = BACKGROUNDS.filter((b) => b.cost === 0).map((b) => b.id);
export const backgroundIds = new Set(BACKGROUNDS.map((b) => b.id));
export const findBackground = (id) => BACKGROUNDS.find((b) => b.id === id) ?? null;
