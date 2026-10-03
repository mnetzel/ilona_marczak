/** Static GeoNames search: entered names never leave the browser. */
export interface Place {
  id: string;
  name: string;
  country: string;
  region: string;
  latitude: number;
  longitude: number;
  timezone: string;
  aliases?: string[];
}

type PlaceRow = [number, string, number, number, number, number, number, string[]?];

interface PlaceData {
  version: number;
  countries: [string, string][];
  regions: string[];
  timezones: string[];
  places: PlaceRow[];
}

interface SearchEntry {
  place: Place;
  names: string[];
  context: string;
  index: number;
}

let pending: Promise<SearchEntry[]> | undefined;

/** Accent-insensitive search, including Polish ł which NFKD does not convert. */
export function normalizePlaceQuery(value: string): string {
  return value.toLocaleLowerCase('pl')
    .replace(/ł/g, 'l').replace(/ø/g, 'o').replace(/đ/g, 'd')
    .normalize('NFKD').replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

async function loadEntries(): Promise<SearchEntry[]> {
  if (!pending) {
    const base = import.meta.env.BASE_URL.replace(/\/?$/, '/');
    pending = fetch(`${base}data/birth-places.json`, { credentials: 'omit' })
      .then(async response => {
        if (!response.ok) throw new Error('Nie udało się pobrać listy miejscowości. Spróbuj ponownie.');
        const data = await response.json() as PlaceData;
        if (data.version !== 1 || !Array.isArray(data.places)) {
          throw new Error('Lista miejscowości ma nieobsługiwany format.');
        }
        let countryNames: Intl.DisplayNames | undefined;
        try { countryNames = new Intl.DisplayNames(['pl'], { type: 'region' }); } catch { /* English source labels remain usable. */ }
        const countries = data.countries.map(([code, name]) => countryNames?.of(code) || name);

        return data.places.map((row, index) => {
          const [id, name, countryIndex, regionIndex, latitude, longitude, timezoneIndex, aliases] = row;
          const country = countries[countryIndex];
          const region = data.regions[regionIndex];
          const place: Place = { id: String(id), name, country, region, latitude, longitude,
            timezone: data.timezones[timezoneIndex], ...(aliases?.length ? { aliases } : {}) };
          return { place, index,
            names: [...new Set([name, ...(aliases || [])].map(normalizePlaceQuery))],
            context: normalizePlaceQuery(`${country} ${data.countries[countryIndex][1]} ${region}`) };
        });
      })
      .catch(error => {
        pending = undefined; // A temporary download failure can be retried.
        throw error;
      });
  }
  return pending;
}

export async function loadPlaces(): Promise<Place[]> {
  return (await loadEntries()).map(entry => entry.place);
}

/** Returns candidates only. The form must require an explicit selection. */
export async function searchPlaces(query: string): Promise<Place[]> {
  const normalized = normalizePlaceQuery(query);
  if (normalized.length < 2) return [];
  const entries = await loadEntries();
  const words = normalized.split(' ');
  const matches: { entry: SearchEntry; score: number }[] = [];

  for (const entry of entries) {
    let score = 0;
    for (const name of entry.names) {
      let match = 0;
      if (name === normalized) match = 120;
      else if (name.startsWith(normalized)) match = 95;
      else if (name.split(' ').some(word => word.startsWith(normalized))) match = 70;
      else if (normalized.length >= 3 && name.includes(normalized)) match = 45;
      else if (words.length > 1 && words.some(word => name.startsWith(word)) &&
          words.every(word => name.includes(word) || entry.context.includes(word))) match = 80;
      // An exact English/alternative name is as valid as a Polish display name;
      // population then keeps London, UK above smaller Londons elsewhere.
      score = Math.max(score, match);
    }
    if (score) matches.push({ entry, score });
  }

  return matches.sort((a, b) => b.score - a.score || a.entry.index - b.entry.index)
    .slice(0, 12).map(result => result.entry.place);
}
