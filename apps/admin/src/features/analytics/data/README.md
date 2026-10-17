Analytics geography assets
==========================

Map boundaries are derived from Natural Earth 5.1.2, 1:110m. Natural Earth data
is public domain: https://www.naturalearthdata.com/about/terms-of-use/

- world.json: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_0_countries.geojson
- us.json: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_110m_admin_1_states_provinces.geojson

City coordinates are derived from GeoNames cities500, downloaded October 17,
2026: https://download.geonames.org/export/dump/cities500.zip
© GeoNames contributors, licensed under CC BY 4.0:
https://creativecommons.org/licenses/by/4.0/
Format and coverage: https://download.geonames.org/export/dump/readme.txt

Download those three sources using the filenames above, then run
`python3 scripts/build-analytics-geography.py /path/to/downloads` from apps/admin.
The generator strips unused properties, rounds coordinates to three decimal
places, omits Antarctica, and unwraps Alaska's antimeridian. The US city lookup
retains only unambiguous city/state pairs and is loaded exclusively on the server.
City locations are approximate; small places outside cities500 and unresolved
names remain visible in the data table without a map marker. The 110m world map
omits some small countries; their counts also remain in the data table.

Umami's `/api/reports/breakdown` endpoint groups US visitors by city and region
in a single request, capped upstream at 500 rows. Country totals use the separate
country metrics endpoint, so they are not calculated from the limited city data.
