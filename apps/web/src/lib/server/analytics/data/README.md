NYC borough estimates
=====================

`nyc-boroughs.json` is server-only lookup data, generated from:

- NYC Planning's shoreline-clipped Borough Boundaries 26b:
  https://data.cityofnewyork.us/d/gthc-hcne
  https://data.cityofnewyork.us/resource/gthc-hcne.geojson
- GeoNames US postal codes: https://download.geonames.org/export/zip/US.zip
  © GeoNames contributors, CC BY 4.0: https://creativecommons.org/licenses/by/4.0/
  Format: https://download.geonames.org/export/zip/readme.txt

Both sources were downloaded October 17, 2026. To regenerate, install
`shapely==2.1.2` in a Python virtual environment, then from apps/web run:

```sh
python3 scripts/build-nyc-boroughs.py /path/to/nyc.json /path/to/US-postal.zip
```

Only ZIP codes with one NY county in the source are retained. Borough polygons
are inset by 0.001 degrees (roughly 80–110 m), simplified, and checked to remain
inside the original boundaries. Unlike the admin display map, these areas
deliberately exclude border and shoreline cases. GeoNames attribution already
appears beneath the admin map.

The collector changes a generic NYC label only when Cloudflare's ZIP and
coordinates agree on a borough interior. Common city-center fallback points,
missing/coarse data, and disagreements retain the original city. These checks
reject obvious inconsistencies; the inputs are from the same IP estimate and
agreement does not prove borough accuracy. Labels always include `(estimated)`.
Already-specific city labels are preserved. ZIP/coordinates are not forwarded
or stored, and historical citywide records are not reclassified.
