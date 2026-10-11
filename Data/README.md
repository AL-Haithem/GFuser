# OSM to GeoPackage

This project converts an OpenStreetMap `.osm.pbf` file into a GeoPackage containing administrative boundaries only.

## Usage

```bash
node index.js
```

The default command reads `world.osm.pbf` from the project root and writes the result to `world/`.

You can also provide another file:

```bash
node index.js another-file.osm.pbf
```

The input file can have any name, but it must use the `.osm.pbf` extension.

## Output

```text
output/
  world/
    world.gpkg
```

The output GeoPackage contains a single layer named `administrative_boundaries`.

## Required tools

- `osmium`
- `ogr2ogr`

## Notes

- Only administrative boundary features are kept.
- Default admin levels: `1,2,3,4`.
- CRS: `EPSG:4326`.
