# Map data pipeline

This folder processes GeoJSON only. It does not upload to R2 and it does not create or edit `versions.json`.

## Input

Put one file per map in `geojson-files`:

```text
DZA.json
MAR.json
world.json
```

The filename is the three-letter country code. `world.json` is treated as the global map and is not added to `countries.json`.

The generated world map always uses internal code `XXX`. Its features are filtered using `ISO_3_coun`: the `XXX` world feature is kept, and a country feature is kept only when a matching input file exists, such as `DZA.json` for `ISO_3_coun: "DZA"`.

## Generate

From this folder:

```powershell
npm run generate
```

Or provide input and output directories:

```powershell
node generate.js .\geojson-files .\output
```

The pipeline validates each FeatureCollection, creates labels, calculates `bounds`, `center`, and a fit-to-bounds fallback `zoom`, then creates PMTiles.

Tile zoom ranges are fixed by map type:

- `world.json`: zoom `0` only
- every country/administrative GeoJSON: zoom `5` only

To test only metadata and labels when `tippecanoe` or `pmtiles` are not installed:

```powershell
node generate.js .\geojson-files .\metadata-test --metadata-only
```

This mode is for inspection only and does not create PMTiles.

Output:

```text
output/
├── countries.json
├── generation-report.json
└── map-assets/
    ├── pmtiles/
    │   ├── DZA/
    │   │   └── unversioned.pmtiles
    │   └── world/
    │       └── unversioned.pmtiles
    └── labels/
        ├── DZA-labels-unversioned.json
        └── world-labels-unversioned.json
```

`unversioned` is intentional. Rename the PMTiles and labels files manually to `v1`, `v2`, and so on, update `versions.json`, and upload them yourself. The `.work` folder is temporary and is removed after generation; it contains intermediate MBTiles files used before conversion to PMTiles.

## Validate

After generation and after manual renaming checks:

```powershell
npm run validate
```

## External tools

The generator requires `tippecanoe` and `pmtiles` available in `PATH`. Custom executable paths are supported:

```powershell
$env:TIPPECANOE = "C:\tools\tippecanoe.exe"
$env:PMTILES = "C:\tools\pmtiles.exe"
npm run generate
```

The source GeoJSON should include ISO metadata when available (`ISO_A3`, `ISO_A2`, `ADMIN`). If it does not, the country code comes from the filename, the region falls back to the first two code letters, and the display label falls back to the code.
