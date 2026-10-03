import { AstroTime, Body, Ecliptic, EclipticGeoMoon, GeoVector, SiderealTime, e_tilt } from 'astronomy-engine';
import { Temporal } from '@js-temporal/polyfill';

/**
 * A browser-only D1 prototype, deliberately limited to Gregorian years 1900–2100.
 * Astronomy Engine (MIT) supplies geocentric true-of-date positions, precession,
 * nutation, and its own TT/UT approximation. No Swiss Ephemeris code is bundled.
 * https://github.com/cosinekitty/astronomy
 *
 * Lahiri is approximated from the IAE reference epoch (JD 2435553.5 TT), with
 * IAU 2006 general precession and the engine's nutation. The reference numbers
 * are astronomical data documented at:
 * https://github.com/aloistr/swisseph/blob/master/sweph.h (SE_SIDM_LAHIRI).
 * The precession polynomial is the P03 general precession in longitude,
 * Capitaine, Wallace & Chapront 2003, A&A 412, 567–586.
 * https://doi.org/10.1051/0004-6361:20031539
 * Mean lunar node: Meeus, Astronomical Algorithms (2nd ed.), chapter 47.
 *
 * This is an approximately arcminute-level preview, not a replacement for a
 * professionally verified ephemeris. Time zones use the browser's IANA/Intl
 * history via Temporal; pre-1970 civil time records may need manual verification.
 */

export const ZODIAC_SIGNS = [
  'Baran', 'Byk', 'Bliźnięta', 'Rak', 'Lew', 'Panna',
  'Waga', 'Skorpion', 'Strzelec', 'Koziorożec', 'Wodnik', 'Ryby',
] as const;

export const NAKSHATRAS = [
  'Aświni', 'Bharani', 'Krittika', 'Rohini', 'Mrigasira', 'Ardra',
  'Punarwasu', 'Puszja', 'Aślesza', 'Magha', 'Purwa Phalguni', 'Uttara Phalguni',
  'Hasta', 'Czitra', 'Swati', 'Wiśakha', 'Anuradha', 'Dżjesztha', 'Mula',
  'Purwa Aszadha', 'Uttara Aszadha', 'Śrawana', 'Dhanisztha', 'Śatabhisza',
  'Purwa Bhadrapada', 'Uttara Bhadrapada', 'Rewati',
] as const;

export interface BirthChartInput {
  date: string;
  time: string;
  /** IANA name, e.g. Europe/Warsaw, or an explicit offset, e.g. +02:00. */
  timeZone: string;
  /** Geographic latitude, north positive. Exact poles are not supported. */
  latitude: number;
  /** Geographic longitude, east positive. */
  longitude: number;
}

export interface Placement {
  id: string;
  name: string;
  sanskrit: string;
  symbol: string;
  longitude: number;
  signIndex: number;
  sign: string;
  degree: number;
  nakshatraIndex: number;
  nakshatra: string;
  pada: number;
  house: number;
  retrograde: boolean;
  /** Sidereal longitude degrees/day; 0 for the Ascendant (not a planet). */
  speed: number;
}

export const CHART_SETTINGS = Object.freeze({
  chart: 'D1 / rāśi',
  layout: 'północnoindyjski',
  zodiac: 'syderyczny',
  ayanamsa: 'Lahiri (przybliżenie IAU 2006)',
  houses: 'pełne znaki',
  nodes: 'średnie węzły księżycowe',
  observer: 'geocentryczny',
  engine: 'Astronomy Engine 2.1.19',
  dateRange: '1900–2100',
});

export interface BirthChart {
  utc: string;
  localDateTime: string;
  utcOffset: string;
  timeZone: string;
  latitude: number;
  longitude: number;
  julianDay: number;
  /** True-of-date Lahiri ayanamsa, including nutation, in degrees. */
  ayanamsa: number;
  ascendant: Placement;
  planets: Placement[];
  settings: typeof CHART_SETTINGS;
  warnings: string[];
}

export class BirthChartError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'BirthChartError';
    this.code = code;
  }
}

export function normalizeLongitude(degrees: number): number {
  const reduced = degrees % 360;
  return reduced < 0 ? reduced + 360 : reduced === 0 ? 0 : reduced;
}

/** Exact sign boundaries belong to the following sign; nakshatras have 4 padas. */
export function describeLongitude(degrees: number) {
  const longitude = normalizeLongitude(degrees);
  const signIndex = Math.floor(longitude / 30);
  const nakshatraPart = longitude * 3 / 40;
  const nakshatraIndex = Math.min(26, Math.floor(nakshatraPart));
  return {
    longitude,
    signIndex,
    sign: ZODIAC_SIGNS[signIndex],
    degree: longitude - signIndex * 30,
    nakshatraIndex,
    nakshatra: NAKSHATRAS[nakshatraIndex],
    pada: Math.min(4, Math.floor((nakshatraPart - nakshatraIndex) * 4) + 1),
  };
}

/** Resolve local civil time without silently choosing a repeated or skipped hour. */
export function resolveBirthTime(input: Pick<BirthChartInput, 'date' | 'time' | 'timeZone'>) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(input.time)) {
    throw new BirthChartError('invalid-date', 'Podaj pełną datę i godzinę urodzenia.');
  }
  let local: Temporal.PlainDateTime;
  try {
    local = Temporal.PlainDateTime.from(`${input.date}T${input.time}`, { overflow: 'reject' });
  } catch {
    throw new BirthChartError('invalid-date', 'Sprawdź datę i godzinę — taki termin nie istnieje w kalendarzu.');
  }
  if (local.year < 1900 || local.year > 2100) {
    throw new BirthChartError('date-range', 'Ten kalkulator obsługuje daty od 1900 do 2100 roku.');
  }
  const timeZone = input.timeZone.trim();
  if (!timeZone) throw new BirthChartError('invalid-zone', 'Wybierz miejscowość lub podaj strefę czasową.');
  let earlier: Temporal.ZonedDateTime;
  let later: Temporal.ZonedDateTime;
  try {
    earlier = local.toZonedDateTime(timeZone, { disambiguation: 'earlier' });
    later = local.toZonedDateTime(timeZone, { disambiguation: 'later' });
  } catch {
    throw new BirthChartError('invalid-zone', 'Nie rozpoznaję tej strefy czasowej. Wpisz np. Europe/Warsaw albo +02:00.');
  }
  if (earlier.epochNanoseconds !== later.epochNanoseconds) {
    const isRepeated = earlier.toPlainDateTime().equals(local) && later.toPlainDateTime().equals(local);
    if (isRepeated) {
      throw new BirthChartError('ambiguous-time', `Ta godzina wystąpiła dwa razy podczas zmiany czasu. Sprawdź, czy obowiązywało UTC${earlier.offset} czy UTC${later.offset}, i wpisz właściwe przesunięcie w polu strefy czasowej.`);
    }
    throw new BirthChartError('nonexistent-time', 'Ta godzina nie wystąpiła w wybranej miejscowości z powodu zmiany czasu. Sprawdź godzinę w dokumencie urodzenia.');
  }
  return {
    date: new Date(earlier.epochMilliseconds),
    utc: earlier.toInstant().toString(),
    localDateTime: local.toString(),
    utcOffset: earlier.offset,
    timeZone,
    year: local.year,
  };
}

// General precession in longitude, arcseconds, t in Julian centuries of TT.
function generalPrecession(t: number): number {
  return 5028.796195 * t + 1.1054348 * t ** 2 + 0.00007964 * t ** 3
    - 0.000023857 * t ** 4 + 0.0000000383 * t ** 5;
}

export function lahiriAyanamsa(time: AstroTime): number {
  const epochCenturies = (2435553.5 - 2451545) / 36525;
  const epochMeanAyanamsa = 23.250182778 - 0.004658035;
  return epochMeanAyanamsa
    + (generalPrecession(time.tt / 36525) - generalPrecession(epochCenturies)) / 3600
    + e_tilt(time).dpsi / 3600;
}

function meanNodeLongitude(time: AstroTime): number {
  const t = time.tt / 36525;
  // The polynomial is referred to the mean equinox; add nutation before
  // subtracting the true-of-date ayanamsa used for all other positions.
  return normalizeLongitude(125.0445479 - 1934.1362891 * t + 0.0020754 * t ** 2
    + t ** 3 / 467441 - t ** 4 / 60616000 + e_tilt(time).dpsi / 3600);
}

function tropicalLongitude(body: Body, time: AstroTime): number {
  if (body === Body.Moon) return EclipticGeoMoon(time).lon;
  return Ecliptic(GeoVector(body, time, true)).elon;
}

function ascendantLongitude(time: AstroTime, latitude: number, longitude: number): number {
  const radians = Math.PI / 180;
  const theta = (SiderealTime(time) * 15 + longitude) * radians;
  const epsilon = e_tilt(time).tobl * radians;
  const phi = latitude * radians;
  // Intersection of the ecliptic with the geometric horizon. atan2 preserves
  // quadrants; the east-component check also handles locations above 66.5°.
  let lambda = Math.atan2(Math.cos(theta), -(Math.sin(theta) * Math.cos(epsilon)
    + Math.tan(phi) * Math.sin(epsilon)));
  const eastComponent = -Math.sin(theta) * Math.cos(lambda)
    + Math.cos(theta) * Math.cos(epsilon) * Math.sin(lambda);
  if (Math.abs(eastComponent) < 1e-10) {
    throw new BirthChartError('polar-ascendant', 'Dla tej godziny i szerokości geograficznej ascendent jest nieokreślony. Wymaga to indywidualnego sprawdzenia.');
  }
  if (eastComponent < 0) lambda += Math.PI;
  return normalizeLongitude(lambda / radians);
}

type Graha = { id: string; name: string; sanskrit: string; symbol: string; body?: Body; node?: boolean; };
const GRAHAS: Graha[] = [
  { id: 'sun', name: 'Słońce', sanskrit: 'Surja', symbol: '☉', body: Body.Sun },
  { id: 'moon', name: 'Księżyc', sanskrit: 'Czandra', symbol: '☽', body: Body.Moon },
  { id: 'mars', name: 'Mars', sanskrit: 'Mangala', symbol: '♂', body: Body.Mars },
  { id: 'mercury', name: 'Merkury', sanskrit: 'Budha', symbol: '☿', body: Body.Mercury },
  { id: 'jupiter', name: 'Jowisz', sanskrit: 'Guru', symbol: '♃', body: Body.Jupiter },
  { id: 'venus', name: 'Wenus', sanskrit: 'Śukra', symbol: '♀', body: Body.Venus },
  { id: 'saturn', name: 'Saturn', sanskrit: 'Śani', symbol: '♄', body: Body.Saturn },
  { id: 'rahu', name: 'Rahu', sanskrit: 'Rahu', symbol: '☊', node: true },
  { id: 'ketu', name: 'Ketu', sanskrit: 'Ketu', symbol: '☋', node: true },
];

export function calculateBirthChart(input: BirthChartInput): BirthChart {
  if (!Number.isFinite(input.latitude) || Math.abs(input.latitude) >= 89.9
    || !Number.isFinite(input.longitude) || Math.abs(input.longitude) > 180) {
    throw new BirthChartError('invalid-location', 'Sprawdź współrzędne miejsca. Kalkulator nie obsługuje bezpośredniego sąsiedztwa biegunów.');
  }
  const resolved = resolveBirthTime(input);
  const time = new AstroTime(resolved.date);
  const ayanamsa = lahiriAyanamsa(time);
  const ascendantPosition = describeLongitude(ascendantLongitude(time, input.latitude, input.longitude) - ayanamsa);
  const ascendant: Placement = {
    id: 'ascendant', name: 'Ascendent', sanskrit: 'Lagna', symbol: 'Asc',
    ...ascendantPosition, house: 1, retrograde: false, speed: 0,
  };
  const step = 0.02;
  const before = time.AddDays(-step);
  const after = time.AddDays(step);
  const ayanamsaBefore = lahiriAyanamsa(before);
  const ayanamsaAfter = lahiriAyanamsa(after);
  const planets: Placement[] = GRAHAS.map((graha) => {
    const nodeOffset = graha.id === 'ketu' ? 180 : 0;
    const longitudeAt = (t: AstroTime) => graha.node
      ? meanNodeLongitude(t) + nodeOffset
      : tropicalLongitude(graha.body!, t);
    const position = describeLongitude(longitudeAt(time) - ayanamsa);
    const displacement = normalizeLongitude((longitudeAt(after) - ayanamsaAfter)
      - (longitudeAt(before) - ayanamsaBefore) + 180) - 180;
    const speed = displacement / (2 * step);
    return {
      id: graha.id, name: graha.name, sanskrit: graha.sanskrit, symbol: graha.symbol,
      ...position,
      house: (position.signIndex - ascendant.signIndex + 12) % 12 + 1,
      retrograde: speed < 0,
      speed,
    };
  });
  const warnings: string[] = [];
  if (resolved.year < 1970) warnings.push('Dla dat sprzed 1970 roku warto potwierdzić historyczną strefę czasową miejsca urodzenia.');
  if (Math.abs(input.latitude) > 66) warnings.push('W pobliżu koła podbiegunowego ascendent może szybko zmieniać położenie. Dokładna godzina ma szczególne znaczenie.');
  if ([ascendant, ...planets].some((p) => Math.min(p.degree, 30 - p.degree) < 0.05)) {
    warnings.push('Jedna z pozycji jest blisko granicy znaku. Przed interpretacją potwierdź dokładną godzinę i wynik w programie astrologicznym.');
  }
  return {
    utc: resolved.utc,
    localDateTime: resolved.localDateTime,
    utcOffset: resolved.utcOffset,
    timeZone: resolved.timeZone,
    latitude: input.latitude,
    longitude: input.longitude,
    julianDay: time.ut + 2451545,
    ayanamsa,
    ascendant,
    planets,
    settings: CHART_SETTINGS,
    warnings,
  };
}
