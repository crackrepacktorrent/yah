"""Build the NYC map and location index from NYC Planning borough boundaries.

Requires Shapely 2.1.2. See src/features/analytics/data/README.md.
Usage: python3 scripts/build-analytics-nyc.py /path/to/nyc.json
"""

import json
import sys
from pathlib import Path

from shapely import coverage_simplify, set_precision, union_all
from shapely.geometry import Point, mapping, shape
from shapely.prepared import prep

target = Path(__file__).resolve().parents[1] / "src/features/analytics/data"
source = json.loads(Path(sys.argv[1]).read_text())["features"]
source.sort(key=lambda feature: feature["properties"]["borocode"])
boundaries = [shape(feature["geometry"]) for feature in source]
assert {feature["properties"]["boroname"] for feature in source} == {
    "Manhattan", "Bronx", "Brooklyn", "Queens", "Staten Island"
}

# Preserve shared borough boundaries while simplifying to roughly 10 metres.
display = coverage_simplify(boundaries, tolerance=0.0001)
features = []
for feature, boundary in zip(source, display):
    boundary = set_precision(boundary, grid_size=0.00001)
    assert boundary.is_valid and not boundary.is_empty
    features.append({
        "type": "Feature", "properties": {"name": feature["properties"]["boroname"]},
        "geometry": mapping(boundary),
    })

# Check membership against the original shoreline, not a metro-area rectangle.
# City/borough reference points can lie in water excluded by the shoreline map.
citywide_and_boroughs = {"NY:new york city", "NY:manhattan", "NY:the bronx", "NY:brooklyn", "NY:queens", "NY:staten island"}
area = prep(union_all(boundaries))
cities = json.loads((target / "us-cities.json").read_text())
locations = sorted({
    tuple(point) for key, point in cities.items()
    if key.startswith("NY:") and (key in citywide_and_boroughs or area.covers(Point(point)))
})

for name, value in [
    ("nyc.geo.json", {"type": "FeatureCollection", "features": features}),
    ("nyc-locations.json", locations),
]:
    (target / name).write_text(json.dumps(value, separators=(",", ":")) + "\n")
    print(f"{name}: {(target / name).stat().st_size:,} bytes")
print(f"NYC location reference points: {len(locations)}")
