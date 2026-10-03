/** Engine-independent SVG renderer. Signs are zero-based; houses are fixed. */
export interface NorthIndianPlanet {
  id: string;
  label: string;
  glyph: string;
  sign: number;
  retrograde: boolean;
}

export interface NorthIndianChartOptions {
  ascendantSign: number;
  planets: NorthIndianPlanet[];
  title?: string;
}

type Point = readonly [number, number];
type Placement = { x: number; y: number; compact?: boolean; dense?: boolean };

const SIGNS = [
  'Baran', 'Byk', 'Bliźnięta', 'Rak', 'Lew', 'Panna',
  'Waga', 'Skorpion', 'Strzelec', 'Koziorożec', 'Wodnik', 'Ryby',
];

// 1 is the top diamond. House order is counterclockwise, independently of Lagna.
const HOUSES: { polygon: Point[]; sign: Point; kind: 'diamond' | 'top' | 'bottom' | 'left' | 'right'; center: Point }[] = [
  { polygon: [[300, 0], [450, 150], [300, 300], [150, 150]], sign: [300, 269], kind: 'diamond', center: [300, 154] },
  { polygon: [[0, 0], [300, 0], [150, 150]], sign: [150, 126], kind: 'top', center: [150, 0] },
  { polygon: [[0, 0], [150, 150], [0, 300]], sign: [20, 42], kind: 'left', center: [0, 150] },
  { polygon: [[0, 300], [150, 150], [300, 300], [150, 450]], sign: [271, 300], kind: 'diamond', center: [150, 300] },
  { polygon: [[0, 300], [150, 450], [0, 600]], sign: [20, 558], kind: 'left', center: [0, 450] },
  { polygon: [[0, 600], [150, 450], [300, 600]], sign: [150, 474], kind: 'bottom', center: [150, 600] },
  { polygon: [[300, 300], [450, 450], [300, 600], [150, 450]], sign: [300, 331], kind: 'diamond', center: [300, 446] },
  { polygon: [[300, 600], [450, 450], [600, 600]], sign: [450, 474], kind: 'bottom', center: [450, 600] },
  { polygon: [[600, 300], [600, 600], [450, 450]], sign: [580, 558], kind: 'right', center: [600, 450] },
  { polygon: [[300, 300], [450, 150], [600, 300], [450, 450]], sign: [329, 300], kind: 'diamond', center: [450, 300] },
  { polygon: [[600, 0], [600, 300], [450, 150]], sign: [580, 42], kind: 'right', center: [600, 150] },
  { polygon: [[300, 0], [600, 0], [450, 150]], sign: [450, 126], kind: 'top', center: [450, 0] },
];

const SHORT_LABELS: Record<string, string> = {
  sun: 'Sł', moon: 'Ks', mars: 'Ma', mercury: 'Me', jupiter: 'Ju',
  venus: 'We', saturn: 'Sa', rahu: 'Ra', ketu: 'Ke',
  mean_node: 'Ra', true_node: 'Ra', north_node: 'Ra', south_node: 'Ke',
};

const COLORS: Record<string, string> = {
  sun: '#986127', moon: '#536c82', mars: '#9b5144', mercury: '#527365',
  jupiter: '#8c6c27', venus: '#946778', saturn: '#62607e',
  rahu: '#66566e', ketu: '#7c7161',
};

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
}

function rows(count: number, capacity: number): number[] {
  const rowCount = Math.ceil(count / capacity);
  const sizes = Array.from({ length: rowCount }, () => Math.floor(count / rowCount));
  for (let i = 0; i < count % rowCount; i++) sizes[i]++;
  return sizes;
}

function positions(index: number, count: number): Placement[] {
  if (!count) return [];
  const house = HOUSES[index];
  const [cx, cy] = house.center;
  if (house.kind === 'diamond') {
    const sizes = rows(count, 3);
    return sizes.flatMap((size, row) => Array.from({ length: size }, (_, column) => ({
      x: cx + (column - (size - 1) / 2) * (count > 4 ? 56 : 64),
      y: cy + (row - (sizes.length - 1) / 2) * 38,
      dense: count > 4,
    })));
  }

  if (house.kind === 'top' || house.kind === 'bottom') {
    const direction = house.kind === 'top' ? 1 : -1;
    let local: Placement[];
    if (count === 1) local = [{ x: 0, y: 55 }];
    else if (count === 2) local = [{ x: -34, y: 51 }, { x: 34, y: 51 }];
    else if (count === 3) local = [{ x: -40, y: 33 }, { x: 40, y: 33 }, { x: 0, y: 77 }];
    else if (count === 4) local = [{ x: -65, y: 28 }, { x: 0, y: 28 }, { x: 65, y: 28 }, { x: 0, y: 72 }];
    else {
      // Wide base to narrow tip: 5 + 3 + 1 slots, each entirely inside the triangle.
      const sizes = count <= 6 ? [Math.ceil(count / 2), Math.floor(count / 2)] : count <= 8 ? [5, count - 5] : [5, 3, 1];
      local = sizes.flatMap((size, row) => Array.from({ length: size }, (_, column) => ({
        x: (column - (size - 1) / 2) * 34,
        y: 24 + row * 34,
        compact: true,
      })));
    }
    return local.map(({ x, y, compact }) => ({ x: cx + x, y: cy + y * direction, compact }));
  }

  let local: Placement[];
  if (count === 1) local = [{ x: 59, y: 0 }];
  else if (count === 2) local = [{ x: 51, y: -33 }, { x: 51, y: 33 }];
  else if (count === 3) local = [{ x: 49, y: -46 }, { x: 67, y: 0 }, { x: 49, y: 46 }];
  else if (count === 4) local = [{ x: 49, y: -45 }, { x: 33, y: 0 }, { x: 92, y: 0 }, { x: 49, y: 45 }];
  else {
    const capacities = count <= 6 ? [2, 2, 2] : [1, 2, 3, 2, 1];
    const offsets = count <= 6 ? [-35, 0, 35] : [-70, -35, 0, 35, 70];
    let remaining = count;
    local = capacities.flatMap((capacity, row) => {
      const size = Math.min(remaining, capacity);
      remaining -= size;
      const y = offsets[row];
      const midpoint = (134 - Math.abs(y)) / 2;
      return Array.from({ length: size }, (_, column) => ({
        x: midpoint + (column - (size - 1) / 2) * 34,
        y,
        compact: true,
      }));
    });
  }
  return local.map(({ x, y, compact }) => ({ x: cx + (house.kind === 'left' ? x : -x), y: cy + y, compact }));
}

function planetMarkup(planet: NorthIndianPlanet, position: Placement): string {
  const id = planet.id.toLowerCase();
  const short = SHORT_LABELS[id] ?? Array.from(planet.label).slice(0, 2).join('');
  const color = COLORS[id] ?? '#655267';
  const title = `${short} · ${planet.label}${planet.retrograde ? ' — ruch wsteczny' : ''}`;
  const glyph = `<text x="${position.compact ? 0 : -13}" y="${position.compact ? -1 : 1}" font-family="'Segoe UI Symbol','Noto Sans Symbols 2','DejaVu Sans',serif" font-size="${position.compact ? 23 : position.dense ? 25 : 28}" dominant-baseline="middle">${escape(planet.glyph)}</text>`;
  // Dense triangular houses retain full-sized symbols; names remain in titles and the accompanying table.
  const label = position.compact ? '' : `<text x="12" y="2" font-size="${position.dense ? 18 : 20}" font-weight="500" dominant-baseline="middle">${escape(short)}</text>`;
  const retrograde = planet.retrograde ? `<text x="${position.compact ? 13 : 28}" y="${position.compact ? -8 : -9}" font-size="9" font-weight="600">R</text>` : '';
  return `<g class="chart-planet" data-planet="${escape(planet.id)}" transform="translate(${position.x} ${position.y})" fill="${color}"><title>${escape(title)}</title>${glyph}${label}${retrograde}</g>`;
}

/** Returns a standalone SVG, safe to insert as markup or download as image/svg+xml. */
export function renderNorthIndianChart({ ascendantSign, planets, title = 'Twój wykres urodzeniowy — Rāśi D1' }: NorthIndianChartOptions): string {
  if (!Number.isInteger(ascendantSign) || ascendantSign < 0 || ascendantSign > 11 || planets.some((planet) => !Number.isInteger(planet.sign) || planet.sign < 0 || planet.sign > 11)) {
    throw new RangeError('Znaki muszą być liczbami całkowitymi od 0 do 11.');
  }
  if (planets.length > 9) throw new RangeError('Wykres D1 obsługuje dziewięć grah.');
  const grouped = HOUSES.map((_, index) => planets.filter((planet) => planet.sign === (ascendantSign + index) % 12));
  const description = HOUSES.map((_, index) => `Dom ${index + 1}: ${SIGNS[(ascendantSign + index) % 12]}; ${grouped[index].map((planet) => `${planet.label}${planet.retrograde ? ' (ruch wsteczny)' : ''}`).join(', ') || 'bez planet'}.`).join(' ');
  const houses = HOUSES.map((house, index) => {
    const sign = (ascendantSign + index) % 12;
    const placements = positions(index, grouped[index].length);
    return `<g class="chart-house" data-house="${index + 1}" data-sign="${sign + 1}"><title>Dom ${index + 1} · ${escape(SIGNS[sign])}</title><polygon points="${house.polygon.map((point) => point.join(',')).join(' ')}" fill="${index === 0 ? '#eee4d8' : index % 3 === 0 ? '#f6eee3' : '#fcf8f0'}"/><text class="chart-sign" x="${house.sign[0]}" y="${house.sign[1]}" dominant-baseline="middle" fill="#7d654d" font-size="19">${sign + 1}</text>${grouped[index].map((planet, planetIndex) => planetMarkup(planet, placements[planetIndex])).join('')}</g>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="660" height="704" viewBox="0 0 660 704" role="img" aria-label="${escape(title)}. Ascendent: ${escape(SIGNS[ascendantSign])}." focusable="false" style="display:block;width:100%;height:auto;max-width:100%"><title>${escape(title)}</title><desc>${escape(description)}</desc><rect width="660" height="704" rx="12" fill="#fcf8f0"/><g font-family="'DM Sans','Segoe UI',sans-serif" text-anchor="middle"><text x="330" y="28" font-size="13" letter-spacing="3" fill="#7d654d">RĀŚI · D1</text><rect x="24" y="44" width="612" height="612" rx="2" fill="none" stroke="#a88a66" stroke-width="0.7"/><g transform="translate(30 50)">${houses}<path d="M0 0H600V600H0Z M0 0L600 600 M600 0L0 600 M300 0L600 300L300 600L0 300Z" fill="none" stroke="#a08362" stroke-width="1.25" stroke-linejoin="round"/><text x="300" y="66" fill="#806348" font-size="12" letter-spacing="1.6">LAGNA</text><circle cx="300" cy="300" r="5" fill="#a08362"/><circle cx="300" cy="300" r="2" fill="#fcf8f0"/></g><text x="330" y="680" font-size="13" fill="#756a70">Numery: znaki zodiaku · R: ruch wsteczny</text></g></svg>`;
}
