"""Build conservative borough lookup areas. Requires Shapely 2.1.2.

Usage: python3 scripts/build-nyc-boroughs.py nyc.json US-postal.zip
Sources and limitations: src/lib/server/analytics/data/README.md
"""

import json
import sys
import zipfile
from collections import defaultdict
from pathlib import Path

from shapely import set_precision
from shapely.geometry import mapping, shape

counties = {"Manhattan": "061", "Bronx": "005", "Brooklyn": "047", "Queens": "081", "Staten Island": "085"}
postal_counties = defaultdict(set)
with zipfile.ZipFile(sys.argv[2]) as archive:
    for line in archive.read("US.txt").decode().splitlines():
        row = line.split("\t")
        postal_counties[row[1]].add((row[4], row[6]))

features = json.loads(Path(sys.argv[1]).read_text())["features"]
assert {feature["properties"]["boroname"] for feature in features} == set(counties)
boroughs = []
for feature in sorted(features, key=lambda item: item["properties"]["borocode"]):
    name = feature["properties"]["boroname"]
    original = shape(feature["geometry"])
    # Exclude roughly 80–110 m around shorelines and borders. Simplification
    # stays inside the original borough; boundary cases must remain citywide.
    interior = set_precision(original.buffer(-0.001).simplify(0.0002), 0.00001)
    assert interior.is_valid and not interior.is_empty and original.covers(interior)
    polygons = mapping(interior)["coordinates"]
    if interior.geom_type == "Polygon":
        polygons = [polygons]
    zips = sorted(code for code, places in postal_counties.items() if places == {("NY", counties[name])})
    assert zips
    boroughs.append({"name": name, "zips": zips, "polygons": polygons})

target = Path(__file__).resolve().parents[1] / "src/lib/server/analytics/data/nyc-boroughs.json"
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(boroughs, separators=(",", ":")) + "\n")
print(f"{len(boroughs)} boroughs, {sum(len(item['zips']) for item in boroughs)} ZIP codes, {target.stat().st_size:,} bytes")
