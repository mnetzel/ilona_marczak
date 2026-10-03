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
  /** Same-origin asset in the page; an embedded data URL for a portable download. */
  backgroundHref?: string;
  /** A decorative preview with no invented birth positions. */
  empty?: boolean;
  idPrefix?: string;
}

type Point = readonly [number, number];
type Placement = { x: number; y: number; compact?: boolean; dense?: boolean };

const SIGNS = [
  'Baran', 'Byk', 'Bliźnięta', 'Rak', 'Lew', 'Panna',
  'Waga', 'Skorpion', 'Strzelec', 'Koziorożec', 'Wodnik', 'Ryby',
];

// 1 is the top diamond. House order is counterclockwise, independently of Lagna.
const HOUSES: { polygon: Point[]; sign: Point; kind: 'diamond' | 'top' | 'bottom' | 'left' | 'right'; center: Point }[] = [
  { polygon: [[300, 0], [450, 150], [300, 300], [150, 150]], sign: [300, 269], kind: 'diamond', center: [300, 150] },
  { polygon: [[0, 0], [300, 0], [150, 150]], sign: [150, 126], kind: 'top', center: [150, 0] },
  { polygon: [[0, 0], [150, 150], [0, 300]], sign: [20, 42], kind: 'left', center: [0, 150] },
  { polygon: [[0, 300], [150, 150], [300, 300], [150, 450]], sign: [271, 300], kind: 'diamond', center: [150, 300] },
  { polygon: [[0, 300], [150, 450], [0, 600]], sign: [20, 558], kind: 'left', center: [0, 450] },
  { polygon: [[0, 600], [150, 450], [300, 600]], sign: [150, 474], kind: 'bottom', center: [150, 600] },
  { polygon: [[300, 300], [450, 450], [300, 600], [150, 450]], sign: [300, 331], kind: 'diamond', center: [300, 450] },
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
  sun: '#ac6c25', moon: '#466676', mars: '#94402e', mercury: '#37645c',
  jupiter: '#946017', venus: '#92574e', saturn: '#424661',
  rahu: '#594c67', ketu: '#635846',
};

const ALIASES: Record<string, string> = { mean_node: 'rahu', true_node: 'rahu', north_node: 'rahu', south_node: 'ketu' };
let chartSequence = 0;

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
      x: cx + (column - (size - 1) / 2) * (count > 4 ? 62 : 74),
      y: cy + (row - (sizes.length - 1) / 2) * (count > 4 ? 38 : 50),
      dense: count > 4,
    })));
  }

  if (house.kind === 'top' || house.kind === 'bottom') {
    const direction = house.kind === 'top' ? 1 : -1;
    let local: Placement[];
    if (count === 1) local = [{ x: 0, y: 55 }];
    else if (count === 2) local = [{ x: -34, y: 51 }, { x: 34, y: 51 }];
    else if (count === 3) local = [{ x: -40, y: 33 }, { x: 40, y: 33 }, { x: 0, y: 77 }];
    else if (count === 4) local = [{ x: -68, y: 26 }, { x: 0, y: 26 }, { x: 68, y: 26 }, { x: 0, y: 77 }];
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
  else if (count === 3) local = [{ x: 47, y: -44 }, { x: 67, y: 0 }, { x: 47, y: 44 }];
  else if (count === 4) local = [{ x: 46, y: -48, dense: true }, { x: 32, y: 0, dense: true }, { x: 96, y: 0, dense: true }, { x: 46, y: 48, dense: true }];
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
  return local.map(({ x, y, compact, dense }) => ({ x: cx + (house.kind === 'left' ? x : -x), y: cy + y, compact, dense }));
}

function planetMarkup(planet: NorthIndianPlanet, position: Placement, prefix: string): string {
  const id = planet.id.toLowerCase();
  const short = SHORT_LABELS[id] ?? Array.from(planet.label).slice(0, 2).join('');
  const colorId = ALIASES[id] ?? (COLORS[id] ? id : 'ketu');
  const color = COLORS[colorId];
  const title = `${short} · ${planet.label}${planet.retrograde ? ' — ruch wsteczny' : ''}`;
  const radius = position.compact ? 12.5 : position.dense ? 13.5 : 17.5;
  const medalX = position.compact ? 0 : -14;
  const glyph = `<text x="${medalX}" y="1" fill="#fff4d7" font-family="'Segoe UI Symbol','Noto Sans Symbols 2','DejaVu Sans',serif" font-size="${position.compact ? 20 : position.dense ? 21 : 28}" dominant-baseline="middle">${escape(planet.glyph)}</text>`;
  // Nine grahas fit inside even the smallest triangular house. The dense view
  // keeps symbols; complete names are always in the title and companion table.
  const label = position.compact ? '' : `<text x="${position.dense ? 11 : 14}" y="2" fill="${color}" stroke="#f8efd9" stroke-width="2.5" stroke-linejoin="round" paint-order="stroke" font-size="${position.dense ? 18 : 22}" font-weight="600" dominant-baseline="middle">${escape(short)}</text>`;
  const retrograde = planet.retrograde ? `<text x="${position.compact ? 13.5 : position.dense ? 25 : 30}" y="${position.compact ? -9 : -10}" fill="#59412d" font-size="8.5" font-weight="600">R</text>` : '';
  return `<g class="chart-planet" data-planet="${escape(planet.id)}" transform="translate(${position.x} ${position.y})"><title>${escape(title)}</title><circle cx="${medalX}" r="${radius + 1.5}" fill="url(#${prefix}-gold)" stroke="#805524" stroke-width="0.75"/><circle cx="${medalX}" r="${radius - 0.6}" fill="url(#${prefix}-${colorId})" stroke="#f0d499" stroke-width="0.7"/><path d="M${medalX - radius * 0.6} ${-radius * 0.55}Q${medalX} ${-radius * 0.85} ${medalX + radius * 0.55} ${-radius * 0.45} M${medalX - radius * 0.6} ${radius * 0.45}Q${medalX} ${radius * 0.7} ${medalX + radius * 0.5} ${radius * 0.5}" fill="none" stroke="#eac785" stroke-width="1.2" opacity="0.16"/>${glyph}${label}${retrograde}</g>`;
}

/** Returns a standalone SVG, safe to insert as markup or download as image/svg+xml. */
export function renderNorthIndianChart({ ascendantSign, planets, title = 'Twój wykres urodzeniowy — Rāśi D1', backgroundHref, empty = false, idPrefix }: NorthIndianChartOptions): string {
  if (!Number.isInteger(ascendantSign) || ascendantSign < 0 || ascendantSign > 11 || planets.some((planet) => !Number.isInteger(planet.sign) || planet.sign < 0 || planet.sign > 11)) {
    throw new RangeError('Znaki muszą być liczbami całkowitymi od 0 do 11.');
  }
  if (planets.length > 9) throw new RangeError('Wykres D1 obsługuje dziewięć grah.');
  const prefix = (idPrefix ?? `manuscript-${++chartSequence}`).replace(/[^a-zA-Z0-9_-]/g, '-');
  const grouped = HOUSES.map((_, index) => empty ? [] : planets.filter((planet) => planet.sign === (ascendantSign + index) % 12));
  const description = empty ? 'Ozdobna oprawa północnoindyjskiego wykresu z dwunastoma domami. Uzupełnij dane urodzenia, aby zobaczyć własny ascendent, znaki i pozycje planet.' : HOUSES.map((_, index) => `Dom ${index + 1}: ${SIGNS[(ascendantSign + index) % 12]}; ${grouped[index].map((planet) => `${planet.label}${planet.retrograde ? ' (ruch wsteczny)' : ''}`).join(', ') || 'bez planet'}.`).join(' ');
  const houses = HOUSES.map((house, index) => {
    const sign = (ascendantSign + index) % 12;
    const placements = positions(index, grouped[index].length);
    return `<g class="chart-house" data-house="${index + 1}"${empty ? '' : ` data-sign="${sign + 1}"`}><title>Dom ${index + 1}${empty ? '' : ` · ${escape(SIGNS[sign])}`}</title><polygon points="${house.polygon.map((point) => point.join(',')).join(' ')}" fill="none"/>${empty ? '' : `<text class="chart-sign" x="${house.sign[0]}" y="${house.sign[1]}" dominant-baseline="middle" fill="#785328" font-size="21" font-weight="600">${sign + 1}</text>`}${grouped[index].map((planet, planetIndex) => planetMarkup(planet, placements[planetIndex], prefix)).join('')}</g>`;
  }).join('');
  const planetGradients = Object.entries(COLORS).map(([id, color]) => `<radialGradient id="${prefix}-${id}" cx="36%" cy="28%" r="82%"><stop stop-color="${color}"/><stop offset="0.58" stop-color="${color}"/><stop offset="1" stop-color="#252220"/></radialGradient>`).join('');
  const fallbackFrame = `<rect x="44" y="89" width="712" height="712" fill="none" stroke="#a98548" stroke-width="1"/><rect x="58" y="103" width="684" height="684" fill="none" stroke="#a98548" stroke-width="3"/><rect x="67" y="112" width="666" height="666" fill="none" stroke="#a98548" stroke-width="0.6"/>${[[58,103], [742,103], [58,787], [742,787]].map(([x,y]) => `<g transform="translate(${x} ${y})"><rect x="-19" y="-19" width="38" height="38" fill="#efe3c4" stroke="#a98548"/><circle r="14" fill="#854d3a" stroke="#a98548"/><path d="M0-11C10-7 10 7 0 11C-10 7-10-7 0-11ZM-11 0C-7-10 7-10 11 0C7 10-7 10-11 0Z" fill="none" stroke="#ead3a0" stroke-width="1"/><circle r="3" fill="#ead3a0"/></g>`).join('')}`;
  const background = backgroundHref ? `<image href="${escape(backgroundHref)}" x="28" y="48" width="746" height="776" preserveAspectRatio="none" aria-hidden="true"/>` : fallbackFrame;
  const grid = 'M0 0H600V600H0Z M0 0L600 600 M600 0L0 600 M300 0L600 300L300 600L0 300Z';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="870" viewBox="0 0 800 870" role="img" aria-label="${escape(title)}${empty ? '. Podgląd oprawy bez danych urodzenia.' : `. Ascendent: ${escape(SIGNS[ascendantSign])}.`}" focusable="false" style="display:block;width:100%;height:auto;max-width:100%"><title>${escape(title)}</title><desc>${escape(description)}</desc><defs><linearGradient id="${prefix}-paper" x2="0.8" y2="1"><stop stop-color="#fcf5e6"/><stop offset="0.55" stop-color="#f3e9d2"/><stop offset="1" stop-color="#faf2e2"/></linearGradient><linearGradient id="${prefix}-gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#d8b566"/><stop offset="0.48" stop-color="#b88436"/><stop offset="1" stop-color="#eed59a"/></linearGradient>${planetGradients}</defs><rect width="800" height="870" fill="url(#${prefix}-paper)"/>${background}<g font-family="'Cormorant Garamond','Palatino Linotype','Book Antiqua',Georgia,serif" text-anchor="middle"><text x="400" y="26" font-size="29" font-weight="600" fill="#664218">Ilona Marczak</text><text x="400" y="43" font-size="12" letter-spacing="2.7" fill="#815238">JYOTISH · RĀŚI D1</text><g transform="translate(100 145)"><path d="${grid}" fill="none" stroke="#f7edcc" stroke-width="3.8" stroke-linejoin="round"/><path d="${grid}" fill="none" stroke="#956d2e" stroke-width="1.25" stroke-linejoin="round"/>${houses}${empty ? '' : '<text x="300" y="56" fill="#855239" font-size="12" letter-spacing="2.2">LAGNA</text>'}<circle cx="300" cy="300" r="6.5" fill="#a17131" stroke="#f1d89f" stroke-width="1"/><path d="M300 295L302 298L305 300L302 302L300 305L298 302L295 300L298 298Z" fill="#efe0b5"/></g><text x="400" y="862" font-size="13" fill="#7f6b51">${empty ? 'Twój wykres pojawi się po uzupełnieniu danych urodzenia' : 'Numery: znaki zodiaku · R: ruch wsteczny'}</text></g></svg>`;
}
