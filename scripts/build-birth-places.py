"""Build the local birthplace index from GeoNames (CC BY 4.0).

Run: python scripts/build-birth-places.py [--refresh]
The downloaded source files are cached in the ignored .qa directory.
No API key or third-party service is used by the deployed search.
"""

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path
import sys
import unicodedata
from urllib.request import urlretrieve
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".qa" / "birth-places-source"
OUTPUT = ROOT / "public" / "data"
BASE = "https://download.geonames.org/export/dump/"
SOURCES = ["cities15000.zip", "PL.zip", "admin1CodesASCII.txt", "admin2Codes.txt", "countryInfo.txt"]
EXCLUDED = {"PPLX", "PPLH", "PPLQ", "PPLW", "PPLS"}

# Select Polish names already present in the GeoNames alternate-name field.
# These are labels only: coordinates, IDs and IANA zones remain source values.
POLISH_NAMES = {
    "756135": "Warszawa", "2643743": "Londyn", "2988507": "Paryż",
    "3169070": "Rzym", "2761369": "Wiedeń", "3067696": "Praga",
    "3196359": "Lublana", "683506": "Bukareszt", "3054643": "Budapeszt",
    "524901": "Moskwa", "703448": "Kijów", "702550": "Lwów",
    "593116": "Wilno", "625144": "Mińsk", "5128581": "Nowy Jork",
    "1275339": "Bombaj", "1275004": "Kalkuta", "1264527": "Madras",
    "1253405": "Benares", "2950159": "Berlin", "2964574": "Dublin",
    "3117735": "Madryt", "292223": "Dubaj", "360630": "Kair",
    "1850147": "Tokio", "1816670": "Pekin", "1835848": "Seul",
    "1819729": "Hongkong", "1880252": "Singapur", "1642911": "Dżakarta",
    "2314302": "Kinszasa", "2267057": "Lizbona", "2618425": "Kopenhaga",
    "2673730": "Sztokholm", "658225": "Helsinki", "3143244": "Oslo",
    "323786": "Ankara", "745044": "Stambuł", "6691831": "Bratysława",
}

POLISH_REGIONS = {
    "72": "dolnośląskie", "73": "kujawsko-pomorskie", "74": "łódzkie",
    "75": "lubelskie", "76": "lubuskie", "77": "małopolskie",
    "78": "mazowieckie", "79": "opolskie", "80": "podkarpackie",
    "81": "podlaskie", "82": "pomorskie", "83": "śląskie",
    "84": "świętokrzyskie", "85": "warmińsko-mazurskie",
    "86": "wielkopolskie", "87": "zachodniopomorskie",
}


def normalized(value):
    value = value.lower().replace("ł", "l").replace("ø", "o").replace("đ", "d")
    return " ".join("".join(
        c if c.isalnum() else " "
        for c in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(c)
    ).split())


def download(name):
    path = CACHE / name
    if "--refresh" in sys.argv or not path.exists():
        urlretrieve(BASE + name, path)
    return path


def read_table(name):
    return [line.split("\t") for line in (CACHE / name).read_text(encoding="utf-8").splitlines()
            if line and not line.startswith("#")]


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=5) as pool:
        list(pool.map(download, SOURCES))

    countries = {r[0]: r[4] for r in read_table("countryInfo.txt")}
    admin1 = {r[0]: r[1] for r in read_table("admin1CodesASCII.txt")}
    admin2 = {r[0]: r[1] for r in read_table("admin2Codes.txt")}
    places = {}
    for name in ["cities15000", "PL"]:
        with ZipFile(CACHE / (name + ".zip")) as archive:
            for line in archive.read(name + ".txt").decode("utf-8").splitlines():
                fields = line.split("\t")
                if fields[6] == "P" and fields[7] not in EXCLUDED and fields[17]:
                    places[fields[0]] = fields

    # Rows are population ordered: ties in search results favour larger places.
    ordered = sorted(places.values(), key=lambda row: (-int(row[14]), int(row[0])))
    country_codes = sorted({row[8] for row in ordered})
    country_ids = {value: index for index, value in enumerate(country_codes)}
    zones, zone_ids, regions, region_ids, rows = [], {}, [], {}, []

    def intern(value, values, indices):
        if value not in indices:
            indices[value] = len(values)
            values.append(value)
        return indices[value]

    for fields in ordered:
        geoname_id, original_name, ascii_name, alternate = fields[:4]
        source_aliases = alternate.split(",")
        requested = POLISH_NAMES.get(geoname_id)
        name = requested if requested in source_aliases else original_name
        country = fields[8]
        region = admin1.get(country + "." + fields[10], "")
        if country == "PL":
            region = POLISH_REGIONS.get(fields[10], region)
            county = admin2.get(country + "." + fields[10] + "." + fields[11], "")
            if county and normalized(county) != normalized(name):
                region = ", ".join(filter(None, [region, county]))

        # Keep useful alternative scripts/spellings without the very large set of
        # transliterations for every language. Accent-only variants are redundant.
        aliases = []
        seen = {normalized(name)}
        prioritized = [original_name, ascii_name]
        if requested in source_aliases:
            prioritized.append(requested)
        prioritized += source_aliases
        alias_limit = 12 if int(fields[14]) >= 500000 else (4 if country != "PL" else 2)
        for alias in prioritized:
            key = normalized(alias)
            latin = all(not c.isalpha() or "LATIN" in unicodedata.name(c, "") for c in alias)
            if key and key not in seen and 3 <= len(alias) <= 48 and latin:
                aliases.append(alias)
                seen.add(key)
                if len(aliases) == alias_limit:
                    break

        row = [int(geoname_id), name, country_ids[country],
               intern(region, regions, region_ids), float(fields[4]), float(fields[5]),
               intern(fields[17], zones, zone_ids)]
        if aliases:
            row.append(aliases)
        rows.append(row)

    data = {
        "version": 1,
        "source": "GeoNames",
        "license": "CC BY 4.0",
        "generated": datetime.now(timezone.utc).date().isoformat(),
        "coverage": "cities15000 worldwide and populated settlements from PL; excludes sections, abandoned and historical settlements",
        "columns": ["id", "name", "countryIndex", "regionIndex", "latitude", "longitude", "timezoneIndex", "aliases?"],
        "countries": [[code, countries.get(code, code)] for code in country_codes],
        "regions": regions,
        "timezones": zones,
        "places": rows,
    }
    target = OUTPUT / "birth-places.json"
    target.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    manifest = "\n".join(f"- {BASE + name}\n  SHA-256: {sha256((CACHE / name).read_bytes()).hexdigest()}" for name in SOURCES)
    license_text = f"""Birthplace search data / Dane wyszukiwarki miejsc urodzenia

Source / Źródło: GeoNames geographical database, https://www.geonames.org/
Licence / Licencja: Creative Commons Attribution 4.0 International (CC BY 4.0)
https://creativecommons.org/licenses/by/4.0/
Legal text: https://creativecommons.org/licenses/by/4.0/legalcode
Source documentation: https://download.geonames.org/export/dump/readme.txt

Downloaded and transformed: {data['generated']}
Record count: {len(rows)}

This is an adaptation of GeoNames. Changes: selected populated places,
excluded place sections and historical/abandoned settlements, combined the
worldwide cities15000 extract with Poland's extract, retained a subset of
alternate names, selected Polish display labels where present in GeoNames,
translated Polish province labels, compacted the data and sorted by population.
Coordinates and IANA timezone identifiers are from GeoNames.
GeoNames does not endorse this website or its calculator.

Coverage: towns/cities in cities15000 worldwide, plus populated settlements
in Poland. This is not a complete global list of birthplaces. Records with
missing timezones are omitted. Data is supplied as is without warranty of
accuracy, timeliness or completeness. The timezone field names a geographic
zone; the calculator must still apply that zone's historical rules for the
date of birth, rather than a present-day UTC offset.

Build: python scripts/build-birth-places.py --refresh
Source files and reproducibility hashes:
{manifest}
"""
    (OUTPUT / "birth-places-LICENSE.txt").write_text(license_text, encoding="utf-8")
    print(f"Wrote {len(rows):,} places; {target.stat().st_size:,} bytes.")


if __name__ == "__main__":
    main()
