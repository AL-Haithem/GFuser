import fs from "fs"
import path from "path"
import {fileURLToPath} from "url"
import {execFileSync} from "child_process"
import pointOnFeature from "@turf/point-on-feature"

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url))
const INPUT_DIR = path.resolve(process.argv[2] || path.join(ROOT_DIR, "geojson-files"))
const OUTPUT_DIR = path.resolve(process.argv[3] || path.join(ROOT_DIR, "output"))
const MAP_ASSETS_DIR = path.join(OUTPUT_DIR, "map-assets")
const PMTILES_DIR = path.join(MAP_ASSETS_DIR, "pmtiles")
const LABELS_DIR = path.join(MAP_ASSETS_DIR, "labels")
const WORK_DIR = path.join(OUTPUT_DIR, ".work")
const METADATA_ONLY = process.argv.includes("--metadata-only")

const LABEL_FIELDS = ["English_Na", "NAME_1", "name", "NAME", "name_en", "NAME_EN"]
const REGION_FIELDS = ["ISO_A2", "iso_a2", "ISO2", "country_code_2"]
const NAME_FIELDS = ["ADMIN", "NAME","NAME_1", "name", "NAME_EN", "name_en", "English_Na"]
const WORLD_CODE_FIELD = "ISO_3_coun"
const TIPPECANOE = process.env.TIPPECANOE || "tippecanoe"
const PMTILES = process.env.PMTILES || "pmtiles"

function fail(message) {
  throw new Error(message)
}

function ensureDirectory(directory) {
  fs.mkdirSync(directory, {recursive: true})
}

function firstProperty(properties, fields) {
  for (const field of fields) {
    const value = properties?.[field]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

function collectCoordinates(value, coordinates = []) {
  const pending = [value]
  while (pending.length) {
    const current = pending.pop()
    if (!Array.isArray(current)) continue
    if (current.length >= 2 && current.every((item) => typeof item === "number" && Number.isFinite(item))) {
      coordinates.push([current[0], current[1]])
      continue
    }
    for (const child of current) pending.push(child)
  }
  return coordinates
}

function getGeoJSONCoordinates(geojson) {
  const coordinates = []
  for (const feature of geojson.features) {
    if (feature.geometry?.coordinates) collectCoordinates(feature.geometry.coordinates, coordinates)
  }
  return coordinates
}

function getBounds(coordinates) {
  if (!coordinates.length) fail("GeoJSON contains no coordinates")
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const [longitude, latitude] of coordinates) {
    west = Math.min(west, longitude)
    south = Math.min(south, latitude)
    east = Math.max(east, longitude)
    north = Math.max(north, latitude)
  }
  return [west, south, east, north]
}

function getCenter(geojson, bounds) {
  if (geojson.features.length > 500) {
    return [
      Number(((bounds[0] + bounds[2]) / 2).toFixed(6)),
      Number(((bounds[1] + bounds[3]) / 2).toFixed(6)),
    ]
  }
  try {
    const point = pointOnFeature(geojson)
    const coordinates = point?.geometry?.coordinates
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      return coordinates.slice(0, 2).map((value) => Number(value.toFixed(6)))
    }
  } catch {
    // The bounds center remains a valid fallback for unusual geometries.
  }
  return [
    Number(((bounds[0] + bounds[2]) / 2).toFixed(6)),
    Number(((bounds[1] + bounds[3]) / 2).toFixed(6)),
  ]
}

function getZoom(bounds) {
  const longitudeSpan = Math.max(bounds[2] - bounds[0], 0.000001)
  const latitudeSpan = Math.max(bounds[3] - bounds[1], 0.000001)
  const span = Math.max(longitudeSpan, latitudeSpan)
  const calculatedZoom = 1 + Math.log2(360 / span)
  return Number(Math.max(1, Math.min(12, calculatedZoom - 0.3)).toFixed(1))
}

function getTileZoomRange(isWorld) {
  return isWorld
    ? {minZoom: 0, maxZoom: 0}
    : {minZoom: 5, maxZoom: 5}
}

function normalizeGeoJSON(value, fileName) {
  if (!value || value.type !== "FeatureCollection" || !Array.isArray(value.features)) {
    fail(`${fileName} must be a GeoJSON FeatureCollection with a features array`)
  }
  if (!value.features.length) fail(`${fileName} contains no features`)
  return value
}

function getCountryCode(fileName) {
  const fileCode = path.basename(fileName, path.extname(fileName)).toUpperCase()
  if (fileCode === "WORLD") return "XXX"
  if (!/^[A-Z]{3}$/.test(fileCode)) fail(`${fileName}: country code must be three letters`)
  return fileCode
}

function filterWorldFeatures(geojson, countryCodes) {
  const features = geojson.features.filter((feature) => {
    const code = firstProperty(feature.properties, [WORLD_CODE_FIELD])?.toUpperCase()
    return code === "XXX" || countryCodes.has(code)
  })
  if (!features.length) fail("world.json has no XXX feature or matching country features")
  return {...geojson, features}
}

function getWorldCountryLabels(geojson) {
  const labels = new Map()
  for (const feature of geojson.features) {
    const code = firstProperty(feature.properties, [WORLD_CODE_FIELD])?.toUpperCase()
    const label = firstProperty(feature.properties, ["English_Na", ...NAME_FIELDS])
    if (code && label && code !== "XXX") labels.set(code, label)
  }
  return labels
}

function createLabels(geojson) {
  const labels = []
  for (const [index, feature] of geojson.features.entries()) {
    const label = firstProperty(feature.properties, LABEL_FIELDS)
    if (!label || !feature.geometry) continue
    try {
      const point = pointOnFeature(feature)
      labels.push({
        type: "Feature",
        id: getFeatureId(feature, index),
        properties: {name: label},
        geometry: {type: "Point", coordinates: point.geometry.coordinates},
      })
    } catch {
      // Invalid individual geometries should not stop valid features being processed.
    }
  }
  return {type: "FeatureCollection", features: labels}
}

function createWorldLabels(geojson) {
  const countryFeatures = geojson.features.filter((feature) => {
    const code = firstProperty(feature.properties, [WORLD_CODE_FIELD])?.toUpperCase()
    return code && code !== "XXX"
  })
  return createLabels({...geojson, features: countryFeatures})
}

function getFeatureId(feature, index) {
  const properties = feature.properties || {}
  const value = feature.id ?? properties.M_ID ?? properties.FID ?? properties.OBJECTID ?? index
  return typeof value === "number" || typeof value === "string" ? value : index
}

function normalizeFeatureNames(geojson) {
  return {
    ...geojson,
    features: geojson.features.map((feature, index) => {
      const properties = {...(feature.properties || {})}
      const label = firstProperty(properties, LABEL_FIELDS)
      if (label) properties.name = label
      return {...feature, id: getFeatureId(feature, index), properties}
    }),
  }
}

function run(command, args) {
  try {
    execFileSync(command, args, {stdio: "inherit"})
  } catch (error) {
    const detail = error.code === "ENOENT" ? `${command} was not found in PATH` : `${command} failed`
    fail(`${detail}. Install it before generating PMTiles.`)
  }
}

function checkTool(command, versionArgs = ["--version"]) {
  try {
    execFileSync(command, versionArgs, {stdio: "ignore"})
  } catch (error) {
    const detail =
      error.code === "ENOENT"
        ? `${command} was not found in PATH`
        : `${command} is not executable`

    fail(`${detail}. Install it or set the matching environment variable.`)
  }
}

function writeJSON(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function processFile(fileName, countryCodes, worldCountryLabels) {
  const filePath = path.join(INPUT_DIR, fileName)
  const sourceGeoJSON = normalizeGeoJSON(JSON.parse(fs.readFileSync(filePath, "utf8")), fileName)
  const code = getCountryCode(fileName)
  const isWorld = code === "XXX"
  const filteredGeoJSON = isWorld ? filterWorldFeatures(sourceGeoJSON, countryCodes) : sourceGeoJSON
  const geojson = normalizeFeatureNames(filteredGeoJSON)
  const properties = geojson.features[0]?.properties || {}
  const coordinates = getGeoJSONCoordinates(geojson)
  const bounds = getBounds(coordinates)
  const center = getCenter(geojson, bounds)
  const region = (firstProperty(properties, REGION_FIELDS) || code.slice(0, 2)).toUpperCase()
  const label = isWorld ? "world" : (worldCountryLabels.get(code) || code)
  const labels = isWorld ? createWorldLabels(geojson) : createLabels(geojson)
  const country = {code, region, label, enabled: true, bounds, center, zoom: getZoom(bounds)}
  const tileZoom = getTileZoomRange(isWorld)
  const countryDirectory = path.join(PMTILES_DIR, isWorld ? "world" : code)
  const pmtilesFile = path.join(countryDirectory, "unversioned.pmtiles")
  const mbtilesFile = path.join(WORK_DIR, `${code}.mbtiles`)
  const normalizedGeoJSONFile = path.join(WORK_DIR, `${code}.geojson`)
  const labelFile = path.join(LABELS_DIR, `${isWorld ? "world" : code}-labels-unversioned.json`)

  ensureDirectory(countryDirectory)
  ensureDirectory(path.dirname(labelFile))
  ensureDirectory(WORK_DIR)
  writeJSON(labelFile, labels)
  if (METADATA_ONLY) return {country, isWorld, tileZoom, labels: labels.features.length, pmtiles: null, labelFile}

  writeJSON(normalizedGeoJSONFile, geojson)
  run(TIPPECANOE, ["-o", mbtilesFile, "--force", `-Z${tileZoom.minZoom}`, `-z${tileZoom.maxZoom}`, `--layer=${isWorld ? "world" : code}`, "--no-simplification", "--no-tiny-polygon-reduction", "--no-feature-limit", "--no-tile-size-limit", normalizedGeoJSONFile])
  run(PMTILES, ["convert", mbtilesFile, pmtilesFile])
  fs.unlinkSync(mbtilesFile)

  return {country, isWorld, tileZoom, labels: labels.features.length, pmtiles: pmtilesFile, labelFile}
}

function main() {
  if (!fs.existsSync(INPUT_DIR)) fail(`Input directory does not exist: ${INPUT_DIR}`)
  const files = fs.readdirSync(INPUT_DIR)
    .filter((file) => file.toLowerCase().endsWith(".geojson") || file.toLowerCase().endsWith(".json"))
    .filter((file) => !file.toLowerCase().endsWith("-labels.json"))
  if (!files.length) fail(`No GeoJSON files found in ${INPUT_DIR}`)
  const countryFiles = files.filter((file) => path.basename(file, path.extname(file)).toLowerCase() !== "world")
  const countryCodes = new Set(countryFiles.map((file) => getCountryCode(file)))
  if (countryCodes.size !== countryFiles.length) fail("Duplicate country code in input filenames")
  if (!METADATA_ONLY) {
    checkTool(TIPPECANOE, ["--version"])
    checkTool(PMTILES, ["version"])
  }

  ensureDirectory(OUTPUT_DIR)
  const worldFile = files.find((file) => path.basename(file, path.extname(file)).toLowerCase() === "world")
  const worldSource = worldFile
    ? normalizeGeoJSON(JSON.parse(fs.readFileSync(path.join(INPUT_DIR, worldFile), "utf8")), worldFile)
    : {features: []}
  const worldCountryLabels = getWorldCountryLabels(worldSource)
  const results = files.map((file) => processFile(file, countryCodes, worldCountryLabels))
  fs.rmSync(WORK_DIR, {recursive: true, force: true})
  const countries = results.filter((result) => !result.isWorld).map((result) => result.country)
  writeJSON(path.join(OUTPUT_DIR, "countries.json"), countries)
  writeJSON(path.join(OUTPUT_DIR, "generation-report.json"), results.map(({country, tileZoom, labels}) => ({...country, tileZoom, labels})))
  console.log(`Generated ${results.length} map file(s) in ${OUTPUT_DIR}`)
  console.log(METADATA_ONLY
    ? "Metadata-only run completed; PMTiles were intentionally not generated."
    : "Review countries.json and generation-report.json, then rename unversioned.pmtiles and *-labels-unversioned.json to your chosen version manually.")
}

try {
  main()
} catch (error) {
  console.error(`ERROR: ${error.message}`)
  process.exitCode = 1
}
