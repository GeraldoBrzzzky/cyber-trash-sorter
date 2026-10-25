export const CATEGORIES = {
  organik: {
    id: 'organik',
    label: 'Organik',
    color: '#39ff88',
    dark: '#0d3b24',
    icon: '♻',
  },
  anorganik: {
    id: 'anorganik',
    label: 'Anorganik',
    color: '#2de2ff',
    dark: '#0a2c3b',
    icon: '⬡',
  },
  b3: {
    id: 'b3',
    label: 'B3',
    color: '#ff2e88',
    dark: '#3b0a20',
    icon: '☣',
  },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES);

/**
 * glyph = emoji shown on the falling crate, name = Indonesian label used in the
 * feedback toast, rare items get a points multiplier.
 */
export const TRASH = [
  // Organik
  { glyph: '🍌', name: 'Kulit Pisang', category: 'organik' },
  { glyph: '🍚', name: 'Sisa Nasi', category: 'organik' },
  { glyph: '🥬', name: 'Sisa Sayur', category: 'organik' },
  { glyph: '🍎', name: 'Apel Busuk', category: 'organik' },
  { glyph: '🥚', name: 'Cangkang Telur', category: 'organik' },
  { glyph: '🦴', name: 'Tulang Ikan', category: 'organik' },
  { glyph: '🍞', name: 'Roti Basi', category: 'organik' },
  { glyph: '🍂', name: 'Daun Kering', category: 'organik' },
  { glyph: '🍊', name: 'Kulit Jeruk', category: 'organik' },
  // Anorganik
  { glyph: '🥤', name: 'Gelas Plastik', category: 'anorganik' },
  { glyph: '📦', name: 'Kardus Bekas', category: 'anorganik' },
  { glyph: '📄', name: 'Kertas Bekas', category: 'anorganik' },
  { glyph: '🥫', name: 'Kaleng Sarden', category: 'anorganik' },
  { glyph: '🍾', name: 'Botol Kaca', category: 'anorganik' },
  { glyph: '👜', name: 'Kantong Kresek', category: 'anorganik' },
  { glyph: '👕', name: 'Kain Lama', category: 'anorganik' },
  { glyph: '🧃', name: 'Kotak Minuman', category: 'anorganik' },
  { glyph: '🪣', name: 'Ember Plastik', category: 'anorganik' },
  // B3
  { glyph: '🔋', name: 'Bekas Baterai', category: 'b3', bonus: 3 },
  { glyph: '🛢️', name: 'Oli Bekas', category: 'b3' },
  { glyph: '💡', name: 'Lampu TL', category: 'b3' },
  { glyph: '💉', name: 'Jarum Medis', category: 'b3' },
  { glyph: '🧴', name: 'Kaleng Aerosol', category: 'b3' },
  { glyph: '😷', name: 'Masker Bekas', category: 'b3' },
  { glyph: '⚗️', name: 'Sisa Kimia', category: 'b3', bonus: 2 },
  { glyph: '🖌️', name: 'Sisa Cat', category: 'b3' },
];

export const BIN_ORDER = ['organik', 'anorganik', 'b3'];
