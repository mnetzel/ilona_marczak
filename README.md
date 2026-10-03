# Ilona Marczak — Jyotish

Statyczna strona wizytówka po polsku, opracowana w duchu sewy. Astro generuje zwykły HTML, CSS i niewielkie skrypty menu oraz filtrów raportu. Hosting: GitHub Pages.

- Strona: https://mnetzel.github.io/ilona_marczak/
- Wersja druga: https://mnetzel.github.io/ilona_marczak/v2/
- Kalkulator wykresu: https://mnetzel.github.io/ilona_marczak/v2/twoj-wykres/ (także `/twoj-wykres/` w wersji pierwszej)
- Raport 50 witryn: https://mnetzel.github.io/ilona_marczak/raport/
- CSV: https://mnetzel.github.io/ilona_marczak/research/zrodla.csv
- Pełne dane badania: https://mnetzel.github.io/ilona_marczak/research/zrodla.json

## Edycja z Iloną

### Dwie wersje strony

Pierwsza wersja zachowuje pierwotny układ pod głównym adresem. Druga działa pod `/v2/` i ma osobne podstrony: oferta, trzy rodzaje opracowań, proces zamawiania, o Jyotish, o Ilonie, czytelnia z trzema nowymi tekstami oraz przygotowanie zamówienia. Przełącznik obu wersji znajduje się u góry każdej podstrony.

`src/content/v2.json` zawiera ofertę i teksty drugiej wersji. `src/layouts/V2Layout.astro` oraz `src/styles/v2.css` tworzą jej oddzielny wygląd. `src/components/VersionSwitch.astro` jest wspólnym przełącznikiem. Pierwotna wersja nie została nadpisana.

V2 opisuje proces: zapytanie → ustalenie zakresu, terminu i ceny → pisemny raport → opcjonalne omówienie po lekturze. Zamówienie ma lokalny generator tekstu z kopiowaniem i pobieraniem TXT; niczego nie wysyła ani nie zapisuje danych. Dopóki `site.json` ma pusty `email`, widoczny jest komunikat o braku zapisów. Po wpisaniu prawdziwego adresu pojawi się link otwierający program pocztowy z przygotowaną wiadomością. Wtedy trzeba też zaktualizować informacje o dostępności w `v2.json` (FAQ i `order.availability`) oraz prywatności. Formularz celowo nie zbiera danych urodzenia.

### Wersja pierwsza i wspólne ustawienia

1. `src/content/site.json` — teksty głównej strony, FAQ, kontakt i oznaczenie wersji roboczej.
2. `src/content/articles.ts` — trzy artykuły czytelni, słowniczek i źródła.
3. `src/pages/index.astro` — kolejność sekcji oraz krótkie teksty wprowadzenia do Jyotish i sewy.
4. `src/styles/global.css` — kolory, czcionki, odstępy i układ mobilny.
5. `research/india.json`, `research/west.json`, `research/visual-audit.json` — źródła i obserwacje raportu.

Wszystkie teksty osobiste są propozycjami do zatwierdzenia przez Ilonę. Obie wersje przedstawiają jej podejście do Jyotish i zakres pracy bez deklarowania stażu. Nie dodano fikcyjnych nauczycieli, afiliacji, certyfikatów, doświadczenia, opinii, adresu, telefonu ani e-maila.

`isDraft: true` pokazuje pasek „strona w przygotowaniu” i ustawia `noindex, follow`. Po zatwierdzeniu tekstów zmień na `false`. Raport pozostanie `noindex` jako materiał roboczy, ale jest publicznie dostępny — nie zawiera poufnych danych.

### Uruchomienie kontaktu

Wpisz rzeczywisty adres do `email` w `site.json`, zmień teksty `contact`, `conversation.availability` i pytanie FAQ o dostępność. Przycisk e-mail pojawi się automatycznie. `mailto:` otwiera aplikację pocztową odwiedzającego; strona nie wysyła wiadomości sama. Przed zbieraniem danych urodzenia lub uruchomieniem formularza trzeba opisać faktyczne zasady prywatności. Obecnie strona nie zbiera danych, nie używa cookies, zewnętrznej analityki ani osadzonych widżetów.

## Uruchomienie lokalne

### Kalkulator urodzeniowy — prototyp

Obie wersje mają zakładkę **Twój wykres urodzeniowy**, z jednym wspólnym kalkulatorem. Formularz przyjmuje datę, godzinę lokalną i wybraną miejscowość. Wyświetla północnoindyjski D1, dziewięć grah, ascendent, znaki, domy całoznakowe, nakszatry, pady i retrogradację. Przykład używa umownych danych: Warszawa, 15.06.1990, 14:30. Wynik można pobrać jako samodzielny SVG z metadanymi lub wydrukować/zapisać jako PDF przez przeglądarkę. Zmiana formularza oznacza poprzedni wynik i blokuje eksport do ponownego obliczenia.

Domyślne ustawienia: zodiak syderyczny, przybliżenie ajanamsy Lahiri według epoki IAE oraz precesji IAU 2006, geocentryczne pozycje i średnie węzły Rahu/Ketu. Silnik **Astronomy Engine 2.1.19 (MIT)**; historyczne strefy IANA przez **Temporal polyfill 0.5.1 (ISC)** i dane `Intl` przeglądarki. Kod ani binaria Swiss Ephemeris nie są publikowane. Licencje bibliotek, w tym pośredniej JSBI, są w `public/licenses/birth-calculator.txt`.

Zakres lat: **1900–2100**, kalendarz gregoriański. Dokładność prototypu około **1–2 minut łuku**. 35 niezależnych zestawów danych referencyjnych Swiss Ephemeris/Moshier, z pochodzeniem i poleceniem generowania zapisanym w `scripts/fixtures/birth-chart-reference.json`, sprawdza planety, ascendent, retrogradację i UTC. Największa zaobserwowana różnica planet: 15,9″ do roku 2026 i 68,7″ dla przyszłych dat do 2100 (różnice modeli ΔT); ascendent 2,65″. Granice znaków i nakszatr wymagają ostrożności. Dla historycznych dat, szczególnie sprzed 1970 roku, warto potwierdzić lokalne przepisy czasowe. Nieistniejące i dwuznaczne godziny przy zmianie czasu są odrzucane; można podać świadomie wybrany offset w ręcznym trybie.

Baza **GeoNames, CC BY 4.0** obejmuje 76 802 miejscowości: większe miasta świata i szerokie pokrycie Polski. Statyczny indeks (~5,3 MB przed kompresją) pobiera się dopiero przy wyszukiwaniu. Wyszukiwane nazwy i dane urodzenia nie opuszczają przeglądarki; bez zewnętrznych API, zapisów kont, cookies, localStorage i danych w URL. Brakujące miejsca można wprowadzić ręcznie. Aktualizacja bazy: `python scripts/build-birth-places.py --refresh`; źródła, przekształcenia i hashe zapisano w `public/data/birth-places-LICENSE.txt`.

Pliki kalkulatora: `src/components/BirthChart.astro`, `src/styles/birth-chart.css`, `src/lib/birth-calculator-ui.ts`, `src/lib/birth-chart.ts`, `src/lib/north-indian-chart.ts`, `src/lib/birth-places.ts`. Test obliczeń: `npm run test:chart`; jest częścią workflow publikacji. Ustawienia i przyjęta dokładność są rozwijane także pod wynikiem na stronie. To prototyp do eksploracji; nie tworzy automatycznej interpretacji ani nie wysyła zamówienia.

Wymagany Node.js 22.12+ (wdrożenie używa Node 24).

```sh
npm ci
npm run dev
```

Podgląd: `http://127.0.0.1:4321/ilona_marczak/`.

```sh
npm run build
npm run check:site
npm run preview
```

Wynik trafia do `dist/`. Test sprawdza 50 unikalnych domen, kompletność danych, lokalne odsyłacze, kotwice, metadane oraz bazową ścieżkę projektu na GitHub Pages.

## Publikacja

Workflow `.github/workflows/deploy.yml` uruchamia się po każdym pushu do `main`. Buduje stronę, weryfikuje wynik i wdraża `dist/` do GitHub Pages. Repozytorium powinno mieć w Settings → Pages źródło **GitHub Actions**. Adres strony i ścieżka projektu są w `astro.config.mjs`; nie usuwaj `base`, jeśli strona ma pozostać w tym repozytorium.

## Research i prawa do materiałów

Badanie z 3 października 2026 obejmuje 25 witryn indyjskich i 25 zachodnich (w tym diasporę indyjską). Treści są polską, autorską syntezą. Związek serwisów z liniami przekazu opisano według ich własnych deklaracji. Nie jest to weryfikacja skuteczności astrologii ani rekomendacja praktyków. Serwisy pokrewne i mocniej sprzedażowe opisano jawnie.

Oryginalna ilustracja `public/images/hero.webp` została wygenerowana dla projektu; przedstawia umowny dziedziniec i lampkę, nie miejsce praktyki Ilony. Nie wykorzystano cudzych zdjęć, logo ani zrzutów stron w publicznym projekcie. Zrzuty badawcze pozostają lokalnie w ignorowanym katalogu `.qa/`. Fonty Cormorant Garamond i DM Sans są pobierane lokalnie z pakietów Fontsource; ich licencje SIL OFL znajdują się w zainstalowanych pakietach i katalogu `public/licenses/`.

## Uwagi techniczne

W dniu budowy `npm audit` zgłasza niezałataną zależność pośrednią `http-cache-semantics@4.2.0` używaną przez Astro (GHSA-ch52-4w7c-c8xp). Dotyczy obsługi współdzielonego cache HTTP; wdrożenie tutaj to wyłącznie statyczne pliki, bez serwera Astro i bez uwierzytelniania użytkowników. Nie obniżono Astro do przestarzałej wersji w celu ukrycia ostrzeżenia. Zależności warto aktualizować, gdy pojawi się poprawka.
