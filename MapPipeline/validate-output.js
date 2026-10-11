import fs from "fs"
import path from "path"
import {fileURLToPath} from "url"

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.resolve(process.argv[2] || path.join(ROOT_DIR, "output"))
const MAP_ASSETS_DIR = path.join(OUTPUT_DIR, "map-assets")
const PMTILES_DIR = path.join(MAP_ASSETS_DIR, "pmtiles")
const LABELS_DIR = path.join(MAP_ASSETS_DIR, "labels")

function fail(message) {
  throw new Error(message)
}

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"))
  } catch (error) {
    fail(`Invalid JSON: ${file} (${error.message})`)
  }
}

function requireFile(file) {
  if (!fs.existsSync(file)) fail(`Missing file: ${file}`)
  if (fs.statSync(file).size === 0) fail(`Empty file: ${file}`)
}

function findArtifact(directory, names) {
  for (const name of names) {
    const file = path.join(directory, name)
    if (fs.existsSync(file)) return file
  }
  const available = fs.existsSync(directory) ? fs.readdirSync(directory) : []
  const versioned = available.find((name) => /^v\d+\.pmtiles$/.test(name))
  if (versioned) return path.join(directory, versioned)
  return path.join(directory, names[0])
}

function findLabelArtifact(directory, prefix) {
  const available = fs.existsSync(directory) ? fs.readdirSync(directory) : []
  const match = available.find((name) => new RegExp(`^${prefix}-labels-(?:unversioned|v\\d+)\\.json$`).test(name))
  return path.join(directory, match || `${prefix}-labels-unversioned.json`)
}

function validateCountry(country) {
  if (!/^[A-Z]{3}$/.test(country.code)) fail(`Invalid country code: ${country.code}`)
  if (!Array.isArray(country.bounds) || country.bounds.length !== 4) fail(`Invalid bounds: ${country.code}`)
  if (!Array.isArray(country.center) || country.center.length !== 2) fail(`Invalid center: ${country.code}`)
  if (!Number.isFinite(country.zoom)) fail(`Invalid zoom: ${country.code}`)
  const [west, south, east, north] = country.bounds
  const [longitude, latitude] = country.center
  if (!(west < east && south < north)) fail(`Bounds do not describe an area: ${country.code}`)
  if (longitude < west || longitude > east || latitude < south || latitude > north) {
    fail(`Center is outside bounds: ${country.code}`)
  }
}

function main() {
  const countriesFile = path.join(OUTPUT_DIR, "countries.json")
  const reportFile = path.join(OUTPUT_DIR, "generation-report.json")
  requireFile(countriesFile)
  requireFile(reportFile)

  const countries = readJSON(countriesFile)
  const report = readJSON(reportFile)
  if (!Array.isArray(countries)) fail("countries.json must contain an array")
  if (!Array.isArray(report)) fail("generation-report.json must contain an array")

  const codes = new Set()
  for (const country of countries) {
    validateCountry(country)
    if (codes.has(country.code)) fail(`Duplicate country code: ${country.code}`)
    codes.add(country.code)
    const pmtiles = findArtifact(path.join(PMTILES_DIR, country.code), ["unversioned.pmtiles"])
    const labels = findLabelArtifact(LABELS_DIR, country.code)
    requireFile(pmtiles)
    requireFile(labels)
    const labelsData = readJSON(labels)
    if (labelsData.type !== "FeatureCollection" || !Array.isArray(labelsData.features)) {
      fail(`Invalid labels FeatureCollection: ${country.code}`)
    }
  }

  const worldPmtiles = findArtifact(path.join(PMTILES_DIR, "world"), ["unversioned.pmtiles"])
  const worldLabels = findLabelArtifact(LABELS_DIR, "world")
  requireFile(worldPmtiles)
  requireFile(worldLabels)
  const worldLabelsData = readJSON(worldLabels)
  if (worldLabelsData.type !== "FeatureCollection" || !Array.isArray(worldLabelsData.features)) {
    fail("Invalid world labels FeatureCollection")
  }

  console.log(`Validated ${countries.length} country record(s) and all map artifacts.`)
  console.log("Manual step remaining: choose versions, rename files, update versions.json, and upload to R2.")
}

try {
  main()
} catch (error) {
  console.error(`ERROR: ${error.message}`)
  process.exitCode = 1
}
