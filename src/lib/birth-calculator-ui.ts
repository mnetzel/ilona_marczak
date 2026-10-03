import { calculateBirthChart, type BirthChart, type Placement } from './birth-chart';
import { searchPlaces, type Place } from './birth-places';
import { renderNorthIndianChart } from './north-indian-chart';

const escape = (value: unknown) => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);
const degrees = (value: number) => `${Math.floor(value)}° ${String(Math.floor((value % 1) * 60 + 1e-7)).padStart(2, '0')}′`;

export function initBirthCalculator() {
  const root = document.querySelector<HTMLElement>('[data-birth-calculator]');
  if (!root || root.dataset.initialized) return;
  root.dataset.initialized = 'true';
  const get = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const form = get<HTMLFormElement>('birth-form');
  const date = get<HTMLInputElement>('birth-date');
  const time = get<HTMLInputElement>('birth-time');
  const placeInput = get<HTMLInputElement>('birth-place');
  const results = get<HTMLUListElement>('birth-place-results');
  const placeStatus = get('birth-place-status');
  const selectedBox = get('birth-selected-place');
  const manual = get<HTMLInputElement>('birth-manual-toggle');
  const manualFields = get<HTMLFieldSetElement>('birth-manual-fields');
  const status = get('birth-status');
  const generate = form.querySelector<HTMLButtonElement>('[type=submit]')!;
  const chartPanel = root.querySelector<HTMLElement>('.birth-chart-panel')!;
  const download = get<HTMLButtonElement>('birth-download');
  const print = get<HTMLButtonElement>('birth-print');
  let selectedPlace: Place | undefined;
  let currentSvg = '';
  let lastResult: BirthChart | undefined;
  let queryVersion = 0;
  let formRevision = 0;
  let timer: ReturnType<typeof setTimeout>;
  generate.disabled = false;

  const say = (message: string, error = false) => {
    status.textContent = message;
    status.classList.toggle('is-error', error);
  };
  const stale = () => {
    formRevision++;
    say('');
    if (lastResult) {
      get('birth-stale').hidden = false;
      download.disabled = true;
      print.disabled = true;
    }
  };
  form.addEventListener('input', stale);
  form.addEventListener('change', stale);

  function hideResults() {
    results.hidden = true;
    results.replaceChildren();
  }
  function choosePlace(place: Place) {
    queryVersion++;
    selectedPlace = place;
    placeInput.value = place.name;
    placeInput.setCustomValidity('');
    selectedBox.innerHTML = `<strong>✓ ${escape(place.name)}, ${escape(place.country)}</strong>${escape(place.region)}<br>${place.latitude.toFixed(4)}°, ${place.longitude.toFixed(4)}° · ${escape(place.timezone)}`;
    selectedBox.hidden = false;
    placeStatus.textContent = '';
    hideResults();
    stale();
  }

  placeInput.addEventListener('input', () => {
    clearTimeout(timer);
    const version = ++queryVersion;
    selectedPlace = undefined;
    selectedBox.hidden = true;
    placeInput.setCustomValidity('');
    hideResults();
    const query = placeInput.value.trim();
    if (query.length < 2) { placeStatus.textContent = ''; return; }
    placeStatus.textContent = 'Szukam miejscowości… Przy pierwszym wyszukiwaniu pobieram bazę.';
    timer = setTimeout(async () => {
      try {
        const places = await searchPlaces(query);
        if (version !== queryVersion || manual.checked) return;
        results.replaceChildren();
        for (const place of places) {
          const item = document.createElement('li');
          const button = document.createElement('button');
          button.type = 'button';
          button.innerHTML = `<strong>${escape(place.name)}</strong><span>${escape([place.region, place.country].filter(Boolean).join(' · '))}</span>`;
          button.addEventListener('click', () => { choosePlace(place); placeInput.focus(); });
          item.append(button);
          results.append(item);
        }
        results.hidden = places.length === 0;
        placeStatus.textContent = places.length ? 'Wybierz właściwe miejsce z listy poniżej.' : 'Nie znaleziono miejsca. Spróbuj innej nazwy lub wpisz współrzędne ręcznie.';
      } catch {
        if (version === queryVersion) placeStatus.textContent = 'Nie udało się pobrać bazy. Sprawdź połączenie i wpisz nazwę ponownie albo podaj miejsce ręcznie.';
      }
    }, 200);
  });
  placeInput.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' && !results.hidden) { event.preventDefault(); results.querySelector('button')?.focus(); }
    if (event.key === 'Escape') hideResults();
  });
  results.addEventListener('keydown', event => {
    const buttons = [...results.querySelectorAll('button')];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); buttons[Math.min(index + 1, buttons.length - 1)]?.focus(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); if (index <= 0) placeInput.focus(); else buttons[index - 1]?.focus(); }
    if (event.key === 'Escape') { hideResults(); placeInput.focus(); }
  });
  manual.addEventListener('change', () => {
    queryVersion++;
    hideResults();
    placeStatus.textContent = '';
    placeInput.disabled = manual.checked;
    placeInput.setCustomValidity('');
    manualFields.disabled = !manual.checked;
    manualFields.hidden = !manual.checked;
    selectedBox.hidden = manual.checked || !selectedPlace;
  });

  function getPlace(): Place | undefined {
    if (manual.checked) {
      return {
        id: 'manual', name: get<HTMLInputElement>('birth-manual-name').value.trim(),
        latitude: get<HTMLInputElement>('birth-latitude').valueAsNumber,
        longitude: get<HTMLInputElement>('birth-longitude').valueAsNumber,
        timezone: get<HTMLInputElement>('birth-timezone').value.trim(), country: '', region: '',
      };
    }
    return selectedPlace;
  }

  function renderRow(point: Placement) {
    return `<tr><td><span class="birth-planet-symbol" aria-hidden="true">${escape(point.symbol)}</span>${escape(point.name)}<small>${escape(point.sanskrit)}</small>${point.retrograde ? '<abbr class="birth-retrograde" title="Ruch wsteczny">R</abbr>' : ''}</td><td>${escape(point.sign)}</td><td>${degrees(point.degree)}</td><td>${point.house}</td><td>${escape(point.nakshatra)}</td><td>${point.pada}</td></tr>`;
  }
  function render(chart: BirthChart, place: Place, example: boolean) {
    const [year, month, day] = chart.localDateTime.slice(0, 10).split('-');
    const when = `${day}.${month}.${year}, ${chart.localDateTime.slice(11, 16)}`;
    const location = [place.name, place.country].filter(Boolean).join(', ');
    const title = `${example ? 'Przykładowy wykres' : 'Twój wykres urodzeniowy'} — ${when} · ${location}`;
    currentSvg = renderNorthIndianChart({
      ascendantSign: chart.ascendant.signIndex,
      planets: chart.planets.map(planet => ({ id: planet.id, label: planet.name, glyph: planet.symbol, sign: planet.signIndex, retrograde: planet.retrograde })),
      title,
    });
    // Keep the exact calculation context with exported artwork, independent of the page.
    currentSvg = currentSvg.replace('</svg>', `<metadata>${escape(JSON.stringify({ title, utc: chart.utc, latitude: chart.latitude, longitude: chart.longitude, timeZone: chart.timeZone, utcOffset: chart.utcOffset, settings: chart.settings }))}</metadata></svg>`);
    get('birth-chart-visual').innerHTML = currentSvg;
    get('birth-result-heading').textContent = example ? 'Przykładowy wykres' : 'Twój wykres urodzeniowy';
    get('birth-result-subtitle').textContent = `${when} · ${location}`;
    const moon = chart.planets.find(planet => planet.id === 'moon')!;
    get('birth-highlights').innerHTML = [['Ascendent · Lagna', chart.ascendant.sign], ['Księżyc · Ćandra', moon.sign], ['Nakszatra Księżyca', moon.nakshatra]].map(([label, value]) => `<div class="birth-highlight"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`).join('');
    get('birth-highlights').hidden = false;
    get('birth-result-actions').hidden = false;
    get('birth-stale').hidden = true;
    download.disabled = false;
    print.disabled = false;
    get('birth-positions').innerHTML = [chart.ascendant, ...chart.planets].map(renderRow).join('');
    get('birth-details').hidden = false;
    const fields = [
      ['Miejsce i współrzędne', `${location} · ${place.latitude.toFixed(4)}°, ${place.longitude.toFixed(4)}°`],
      ['Czas lokalny i strefa', `${when} · ${chart.timeZone} (UTC${chart.utcOffset})`],
      ['Chwila w UTC', chart.utc.replace('T', ' ').replace(/(?:\.000)?Z$/, ' UTC')],
      ['Ajanamsa', `${chart.settings.ayanamsa} · ${degrees(chart.ayanamsa)}`],
      ['Zodiak i domy', `${chart.settings.zodiac} · ${chart.settings.houses}`],
      ['Rahu i Ketu', chart.settings.nodes],
      ['Silnik i zakres dat', `${chart.settings.engine} · ${chart.settings.dateRange}`],
      ['Dokładność prototypu', 'Około 1–2 minut łuku; pozycje w tabeli podano z dokładnością do minuty łuku.'],
    ];
    get('birth-calculation-data').innerHTML = fields.map(([key, value]) => `<div><dt>${escape(key)}</dt><dd>${escape(value)}</dd></div>`).join('');
    get('birth-warnings').textContent = chart.warnings.join(' ');
    lastResult = chart;
  }

  async function generateChart(example = false) {
    if (!form.reportValidity()) return;
    const place = getPlace();
    if (!place) {
      say('Wybierz miejscowość z wyników wyszukiwania albo wpisz ją ręcznie.', true);
      placeInput.focus();
      return;
    }
    generate.disabled = true;
    get<HTMLButtonElement>('birth-example').disabled = true;
    chartPanel.setAttribute('aria-busy', 'true');
    say('Obliczam pozycje planet…');
    const revision = formRevision;
    const input = { date: date.value, time: time.value, latitude: place.latitude, longitude: place.longitude, timeZone: place.timezone };
    try {
      // Allow the progress state to paint before the synchronous astronomy calculation.
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      if (revision !== formRevision) { say('Dane zmienione — kliknij ponownie „Wygeneruj wykres”.'); return; }
      const chart = calculateBirthChart(input);
      render(chart, place, example);
      say(example ? 'Gotowe — to przykład dla Warszawy, 15.06.1990 o 14:30. Zmień dane, aby obliczyć własny wykres.' : 'Gotowe. Twój wykres i tabela pozycji są poniżej.');
      get('birth-result-heading').focus({ preventScroll: true });
      if (window.matchMedia('(max-width:850px)').matches) get('birth-result-heading').scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth' });
    } catch (error) {
      say(error instanceof Error ? error.message : 'Nie udało się obliczyć wykresu. Sprawdź dane i spróbuj ponownie.', true);
    } finally {
      generate.disabled = false;
      get<HTMLButtonElement>('birth-example').disabled = false;
      chartPanel.setAttribute('aria-busy', 'false');
    }
  }
  form.addEventListener('submit', event => { event.preventDefault(); void generateChart(); });
  get('birth-example').addEventListener('click', () => {
    manual.checked = false;
    manualFields.disabled = true;
    manualFields.hidden = true;
    placeInput.disabled = false;
    date.value = '1990-06-15';
    time.value = '14:30';
    choosePlace({ id: '756135', name: 'Warszawa', country: 'Polska', region: 'woj. mazowieckie', latitude: 52.22977, longitude: 21.01178, timezone: 'Europe/Warsaw' });
    void generateChart(true);
  });
  download.addEventListener('click', () => {
    if (!currentSvg || download.disabled) return;
    const url = URL.createObjectURL(new Blob([currentSvg], { type: 'image/svg+xml;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'wykres-urodzeniowy.svg';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  print.addEventListener('click', () => { if (lastResult && !print.disabled) window.print(); });
}
