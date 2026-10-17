"""Build compact analytics assets from downloaded Natural Earth and GeoNames data.

Usage: python3 scripts/build-analytics-geography.py /path/to/downloads
See src/features/analytics/data/README.md for source URLs and licenses.
"""

import json
import re
import sys
import unicodedata
import zipfile
from pathlib import Path

source = Path(sys.argv[1])
target = Path(__file__).resolve().parents[1] / "src/features/analytics/data"
target.mkdir(parents=True, exist_ok=True)


def write(name, value):
    (target / name).write_text(json.dumps(value, separators=(",", ":"), ensure_ascii=False) + "\n")


def coordinates(value, alaska=False):
    if isinstance(value[0], (int, float)):
        lon, lat = value[:2]
        return [round(lon - 360 if alaska and lon > 0 else lon, 3), round(lat, 3)]
    return [coordinates(child, alaska) for child in value]


def feature(value, name, alaska=False):
    return {
        "type": "Feature", "properties": {"name": name},
        "geometry": {"type": value["geometry"]["type"], "coordinates": coordinates(value["geometry"]["coordinates"], alaska)},
    }


def collection(features):
    return {"type": "FeatureCollection", "features": features}


world = json.loads((source / "world.json").read_text())["features"]
write("world.geo.json", collection([
    feature(f, f["properties"]["ISO_A2_EH"] if len(f["properties"]["ISO_A2_EH"]) == 2 else f["properties"]["NAME_EN"])
    for f in world if f["properties"]["ISO_A2_EH"] != "AQ"
]))
states = json.loads((source / "us.json").read_text())["features"]
for name, codes in [("us", {f["properties"]["iso_3166_2"] for f in states} - {"US-AK", "US-HI"}), ("alaska", {"US-AK"}), ("hawaii", {"US-HI"})]:
    write(f"{name}.geo.json", collection([
        feature(f, f["properties"]["name"], name == "alaska")
        for f in states if f["properties"]["iso_3166_2"] in codes
    ]))


def normalize(value):
    value = "".join(char for char in unicodedata.normalize("NFD", value) if not 0x0300 <= ord(char) <= 0x036F)
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


# Exact city + state lookup. Ambiguous names stay unmapped instead of choosing
# the largest city. This file is imported only by server code.
cities = {}
with zipfile.ZipFile(source / "cities500.zip") as archive:
    for line in archive.read("cities500.txt").decode().splitlines():
        row = line.split("\t")
        if row[8] != "US":
            continue
        for city in {row[1], row[2]}:
            key = f"{row[10]}:{normalize(city)}"
            point = [round(float(row[5]), 3), round(float(row[4]), 3)]
            if key in cities and cities[key] != point:
                cities[key] = None
            else:
                cities[key] = point
write("us-cities.json", {key: value for key, value in sorted(cities.items()) if value is not None})
