# MapFusionDesktop — Sequential Task Plan

> **Goal:** Evolve the existing Electron pipeline console into a personal Windows GIS workbench that can inspect, convert, preview, edit, combine, and export geographic data as PMTiles.
>
> **Important as-built correction:** This repository is **not currently a React/MapLibre app**. It is a vanilla HTML/CSS/JavaScript Electron console with two existing Node.js processing projects: `Data` and `MapPipeline`. Do not scaffold a new app or migrate to React unless a later requirement proves it necessary.
>
> **Working rule:** Complete one task at a time. Make only the changes required by that task, run its acceptance checks, record the result, and only then move on. Prefer one small Git commit per code task.

## Status legend

- `[x]` Completed based on the repository inspection supplied for this project.
- `[>]` Current next task.
- `[ ]` Not started.
- `[!]` Blocked or awaiting a technical decision.

---

# Phase 0 — Establish the real baseline

## TASK-001 — Audit the current repository `[x]`

**Result recorded:**

- Root Electron UI: `index.html`, `styles.css`, `renderer.js`.
- Electron main/preload: `main.js`, `preload.js`; renderer calls the `run-merged-project` IPC method.
- `scripts/runMergedProject.js` runs `Data` then `MapPipeline`, and installs a subproject's npm dependencies if its `node_modules` directory is missing.
- `Data` processes OSM PBF input into administrative-boundary GeoPackage output; it depends on `osmium` and `ogr2ogr`.
- `MapPipeline` consumes GeoJSON and creates metadata, labels, and PMTiles artifacts; its normal generation path depends on `tippecanoe` and `pmtiles`.
- There is currently no MapLibre initialization or map UI, and no MapLibre/PMTiles client dependency in the application packages.
- Root/Data syntax checks, MapPipeline generator syntax check, and existing output validation passed. The validator recognized two country records and their artifacts.
- A full pipeline run was not possible in the inspected environment because the required PBF/input data and GIS executables were unavailable there. This does not prove they are absent from every environment on the user's PC.
- No application code or project structure was changed during that inspection.

**Acceptance:** Met from the supplied inspection report. Keep this section as the baseline unless the repository changes materially.

## TASK-002 — Document the as-built architecture and correct the target stack `[x]`

**Result:** The architecture notes now distinguish existing components from planned ones. Existing vanilla JavaScript remains the renderer; Electron already exists; MapLibre is a future feature; the `Data` and `MapPipeline` projects should be tested before being rewritten.

**Acceptance:** The documentation separates current facts from planned features and names the existing pipeline entry points.

---

# Phase 1 — Verify the toolchain before writing new GIS features

## TASK-003 — Inventory tools in the actual Windows/WSL environments `[>]`

**Goal:** Determine where the existing commands can run on the machine that will launch Electron.

**Scope:** Inspection only. Do not install or change anything yet. In PowerShell, run:

```powershell
Get-Command node, npm, python, conda, gdalinfo, ogrinfo, ogr2ogr, osmium, tippecanoe, pmtiles -ErrorAction SilentlyContinue |
  Select-Object Name, Source
wsl.exe --list --verbose
```

For each WSL/Linux environment you already use, check:

```bash
command -v osmium ogrinfo ogr2ogr tippecanoe pmtiles
osmium --version
ogrinfo --version
ogr2ogr --version
tippecanoe --version
pmtiles --help
```

Run version checks only for commands that are found. Save the output in `docs/toolchain-inventory.md`.

**Acceptance criteria:** The report states which commands exist, their versions/paths, and whether they are available in Windows, WSL, or both. Missing commands are recorded rather than guessed.

**Do not do in this task:** Install packages, edit application code, or change the existing pipeline.

## TASK-004 — Choose how Electron will invoke GIS tools

**Goal:** Decide the execution environment for the existing scripts based on TASK-003.

**Options to evaluate:**
- Windows-native executables for GDAL/OGR and any supported tools.
- WSL for commands such as Tippecanoe if that is where they already work.
- GDAL's PMTiles writer as an alternative only if it works adequately with the real data.

**Acceptance criteria:** Document the chosen location for each required command and how Windows paths will be translated if WSL is used. No code changes yet.

**Dependency:** TASK-003.

## TASK-005 — Verify GDAL/OGR installation and required drivers

**Goal:** Confirm the installed GDAL can read and write the required formats.

**Scope:** Install/activate a dedicated Miniforge/Conda-Forge environment only if TASK-003 shows GDAL is missing from the chosen environment. Check GeoPackage, GeoJSON, Shapefile, OSM PBF, and PMTiles support as applicable.

**Acceptance criteria:** Record `gdalinfo --version`, `ogrinfo --version`, `ogr2ogr --version`, and the available vector drivers. If PMTiles writing is a candidate, verify actual creation support rather than read support alone.

**Dependency:** TASK-004.

## TASK-006 — Test ordinary vector conversion outside Electron

**Goal:** Prove basic conversions preserve data.

**Scope:** Use small local samples. Test one conversion into GeoPackage and one conversion out of GeoPackage.

**Acceptance criteria:** Reopen the outputs and compare layer names, geometry type, CRS, feature counts, and important attributes. Preserve the original inputs.

**Dependency:** TASK-005.

## TASK-007 — Test the existing `Data` pipeline on a small PBF

**Goal:** Verify the existing OSM-to-GeoPackage logic before integrating it into the UI.

**Scope:** Use a small PBF and the project's existing CLI/configuration. Do not redesign the pipeline.

**Acceptance criteria:** The command completes, creates the expected GeoPackage layer(s), and the output can be inspected with OGR. Record exact command, input, output, and limitations.

**Dependencies:** TASK-004 and TASK-005.

## TASK-008 — Test the existing `MapPipeline` generation path

**Goal:** Verify the current GeoJSON-to-PMTiles pipeline before replacing or duplicating it.

**Scope:** Run it on a small/test input or a safe test copy using the current `MapPipeline` scripts. Preserve known-good outputs.

**Acceptance criteria:** Metadata/labels are generated as expected; a PMTiles artifact is created; `npm run validate --prefix MapPipeline` or the appropriate validator passes. Record the generator versions and command used.

**Dependency:** TASK-004.

## TASK-009 — Decide whether to keep Tippecanoe or test GDAL PMTiles output

**Goal:** Avoid replacing a pipeline that already meets the requirements without evidence.

**Decision rule:** If the existing Tippecanoe + PMTiles path is available and its output meets the project's needs, keep it as the baseline. Test GDAL direct PMTiles generation as a separate comparison only if Windows execution, controls, or performance give a concrete reason.

**Acceptance criteria:** Document one decision: `keep existing pipeline`, `use GDAL for defined cases`, or `more comparison required`. Compare visual quality in MapLibre later; do not decide only from file creation success.

**Dependencies:** TASK-008; TASK-005 if GDAL PMTiles is tested.

---

# Phase 2 — Add map display to the existing Electron console

## TASK-010 — Choose how frontend dependencies will be loaded

**Goal:** Use MapLibre in the current vanilla renderer without unnecessarily migrating the application to React.

**Scope:** Inspect the current `package.json`, Electron load method, and packaging rules. Choose a compatible way to bundle/load local `maplibre-gl` and `pmtiles` assets in development and in the packaged app. Prefer keeping dependencies local rather than requiring a CDN at runtime.

**Acceptance criteria:** A short decision note identifies how renderer modules and CSS will load in both development and the Windows build. Do not implement the map in this task.

## TASK-011 — Add MapLibre and display an empty map

**Goal:** Establish the first map canvas inside the current console UI.

**Scope:** Add only the dependencies/build configuration justified by TASK-010, a map container, basic layout, and map initialization. Do not add data import yet.

**Acceptance criteria:** The map initializes in the Electron window, resize works, and a clear UI error is shown if map/style initialization fails.

**Dependency:** TASK-010.

## TASK-012 — Register PMTiles and decide how local archives are opened

**Goal:** Make the PMTiles client work in the Electron renderer.

**Scope:** Register the PMTiles protocol with MapLibre and choose a secure local-file access approach supported by the chosen Electron loading scheme. Do not expose arbitrary filesystem access to the renderer.

**Acceptance criteria:** A small local PMTiles archive can be read from the packaged/local app context, or a specific blocker and chosen workaround are documented.

**Dependencies:** TASK-009 and TASK-011.

## TASK-013 — Display one existing PMTiles artifact

**Goal:** Prove the map can display output from the current project.

**Scope:** Use a known artifact from `MapPipeline/output`; identify its actual vector-layer metadata and use a minimal explicit style. Do not yet build a generalized layer manager.

**Acceptance criteria:** The archive renders at multiple zoom levels, the correct source-layer is referenced, and any missing/corrupt archive produces a useful error.

**Dependencies:** TASK-008 and TASK-012.

## TASK-014 — Add a safe file picker for map/PMTiles inputs

**Goal:** Let the user select a local data artifact through Electron.

**Scope:** Use a main-process file dialog and a narrow preload/IPC method. Allow known file types as selection hints, not as proof that the contents are valid.

**Acceptance criteria:** Selection and cancellation work, the path is returned as structured data, and the renderer does not gain unrestricted filesystem access.

**Dependency:** TASK-009.

## TASK-015 — Add basic map layer controls

**Goal:** Make the preview useful for multiple loaded layers.

**Scope:** Add show/hide and remove controls for already-supported map sources. Avoid editing source data in this task.

**Acceptance criteria:** UI layer state matches MapLibre state, and toggling/removing a layer does not unexpectedly change source files.

**Dependency:** TASK-013.

---

# Phase 3 — Integrate existing processing workflows with the UI

## TASK-016 — Review and harden the current IPC boundary

**Goal:** Confirm that the existing `run-merged-project` channel and preload API are restricted.

**Scope:** Inspect `main.js` and `preload.js`; verify context isolation, disabled renderer Node integration, sender validation where appropriate, and no renderer-provided arbitrary shell command.

**Acceptance criteria:** Document the findings and make only the smallest necessary security fixes. The current console still launches.

## TASK-017 — Expose the `Data` pipeline as a separate operation

**Goal:** Run OSM-to-GeoPackage without always running `MapPipeline` afterward.

**Scope:** Add a dedicated main-process operation using the existing Data entry point and validated arguments/config. Keep the merged command available until the new operation is proven.

**Acceptance criteria:** A controlled request runs only `Data`, reports exit status and output, handles missing executables, and does not freeze the renderer.

**Dependencies:** TASK-007 and TASK-016.

## TASK-018 — Expose the `MapPipeline` as a separate operation

**Goal:** Generate/validate map artifacts without rerunning the Data pipeline.

**Scope:** Call existing scripts; keep the command and options explicit. Do not redesign their transformation logic.

**Acceptance criteria:** The UI can run generation and validation independently and report success/failure accurately.

**Dependencies:** TASK-008 and TASK-016.

## TASK-019 — Add structured job status and errors

**Goal:** Make local processing understandable from the UI.

**Scope:** Represent idle/running/succeeded/failed states, capture stdout/stderr, and display a useful error when a tool is unavailable. Add cancellation only if the process can be stopped safely.

**Acceptance criteria:** The UI remains responsive during a test job and does not label a failed command as successful.

**Dependencies:** TASK-017 and TASK-018.

## TASK-020 — Add a dataset inspection operation

**Goal:** Inspect selected Shapefile, GeoJSON, or GeoPackage files with GDAL/OGR.

**Scope:** Return structured layers, fields, geometry types, CRS, and feature counts when available. Do not load all geometries into the renderer.

**Acceptance criteria:** Small samples of each supported format return correct metadata, and invalid files result in readable structured errors.

**Dependencies:** TASK-005, TASK-014, and TASK-016.

## TASK-021 — Convert one selected dataset/layer to GeoPackage

**Goal:** Add a general-purpose conversion path without altering source files.

**Scope:** Use OGR with explicit layer, output path, CRS, and overwrite behavior as relevant. Start with one layer per operation.

**Acceptance criteria:** Output can be reopened and matches expected feature count, geometry type, CRS, and attributes. Existing output is never silently overwritten.

**Dependencies:** TASK-006, TASK-020.

## TASK-022 — Preview a small vector dataset on MapLibre

**Goal:** Display source vector data, not just prebuilt PMTiles.

**Scope:** Start with small GeoJSON data or a small converted test layer. Do not load national-scale GeoJSON into the renderer by default; large-data preview strategy is a later task.

**Acceptance criteria:** Fit-to-extent works, features are visible, and invalid/empty geometry gives an understandable message.

**Dependencies:** TASK-011 and TASK-020.

---

# Phase 4 — Editable and combinable working data

## TASK-023 — Define the editable GeoPackage working-copy model

**Goal:** Keep original files safe and store edits persistently.

**Scope:** Define project/workspace folders, working GeoPackage creation, layer names, and how a reopened project finds its working data.

**Acceptance criteria:** Importing a source creates or selects a working copy without modifying the original. The working GeoPackage can be closed and reopened with layers intact.

**Dependencies:** TASK-021 and TASK-022.

## TASK-024 — Add feature selection and an attribute table

**Goal:** Let the user inspect specific features in a loaded layer.

**Scope:** Display rows/fields and synchronize row selection with map highlighting. Define how stable IDs are assigned or preserved.

**Acceptance criteria:** Selecting a row identifies its feature on the map and selecting a map feature identifies the corresponding row on the table.

**Dependency:** TASK-023.

## TASK-025 — Edit and persist feature attributes

**Goal:** Change an attribute value safely and save it to the working data.

**Scope:** Edit one selected feature; handle read-only/system fields and write failures.

**Acceptance criteria:** The value persists after reopening the working GeoPackage; failures leave the previous value intact.

**Dependency:** TASK-024.

## TASK-026 — Add new point features

**Goal:** Implement the simplest geometry editing workflow first.

**Scope:** Draw a point, collect its attributes, and save it into a compatible working layer.

**Acceptance criteria:** The new feature persists after reopening, has the expected CRS, and appears in the map and table.

**Dependency:** TASK-024.

## TASK-027 — Add line and polygon creation

**Goal:** Extend drawing to line and polygon layers.

**Scope:** Implement one geometry type at a time, validating required vertices and polygon closure.

**Acceptance criteria:** Each geometry type saves and reopens correctly; malformed geometries receive clear feedback.

**Dependency:** TASK-026.

## TASK-028 — Modify and delete existing geometries

**Goal:** Edit vertices and delete selected features.

**Scope:** Keep vertex modification and deletion logically separable, even if delivered as small commits under this task.

**Acceptance criteria:** Updates persist in GeoPackage, and map/table state stays consistent.

**Dependency:** TASK-027.

## TASK-029 — Merge/append compatible layers

**Goal:** Combine datasets without silent field or CRS loss.

**Scope:** Start with two vector layers of compatible geometry type. Make field mapping explicit and reproject only by an explicit, documented rule.

**Acceptance criteria:** Feature count and key attributes are checked; incompatible schemas/CRSs produce a clear choice or error.

**Dependencies:** TASK-023 and TASK-021.

## TASK-030 — Validate working data before final export

**Goal:** Catch common data issues without silently modifying the dataset.

**Scope:** Report invalid geometries, missing required attributes, empty layers, and CRS issues where supported.

**Acceptance criteria:** Validation reports problems and does not repair or rewrite data unless the user explicitly invokes a repair action.

**Dependencies:** TASK-025, TASK-028, TASK-029.

---

# Phase 5 — Broaden OSM PBF and large-data support

## TASK-031 — Document current OSM PBF coverage and gaps

**Goal:** Distinguish what the existing Data project extracts from what a general-purpose OSM importer would need.

**Scope:** Inspect existing configuration and outputs. The current entry point is described as extracting administrative boundaries; do not assume that roads/buildings/POIs are already supported.

**Acceptance criteria:** List the available OSM layers/tags and the currently supported extraction use case, with sample output verified.

**Dependencies:** TASK-007 and TASK-020.

## TASK-032 — Add one additional OSM content type only if required

**Goal:** Expand the existing PBF pipeline incrementally rather than attempting to import all OSM content at once.

**Scope:** Choose one needed type (for example, roads or buildings), implement it through GDAL/OGR or Osmium based on a repeatable test, and store it in GeoPackage.

**Acceptance criteria:** Important tags and geometry are preserved and the output is validated and viewable.

**Dependency:** TASK-031.

## TASK-033 — Design a large-data preview strategy

**Goal:** Prevent memory-heavy full-file loading.

**Scope:** Test a sensible threshold for direct GeoJSON preview and choose an alternative for larger layers, such as temporary vector tiles or bounded feature queries.

**Acceptance criteria:** Record input sizes, peak memory if measurable, load time, and graceful failure behavior.

**Dependencies:** TASK-013 and TASK-022.

## TASK-034 — Add progress/cancellation for long-running jobs

**Goal:** Improve long processing operations after basic success/failure handling works.

**Scope:** Use tool progress if available; otherwise show indeterminate progress. Implement cancellation only where child-process termination is safe and defined.

**Acceptance criteria:** Jobs clearly distinguish running/succeeded/failed/cancelled, and the app remains responsive.

**Dependencies:** TASK-019, TASK-021, TASK-032.

## TASK-035 — Add end-to-end regression samples

**Goal:** Protect the working pipelines from regressions.

**Scope:** Keep small test samples for Shapefile, GeoJSON, GeoPackage, and OSM PBF along with expected metadata and output checks.

**Acceptance criteria:** A repeatable test covers import → inspect → convert/working copy → preview → PMTiles output → MapLibre display, and verifies layer names, CRS, essential attributes, and artifacts.

**Dependencies:** Relevant tasks in Phases 1–5.

---

# Current position

- **TASK-001:** completed from the provided inspection report.
- **TASK-002:** completed by correcting the stack/workflow documentation to reflect the real repository.
- **Next:** `TASK-003 — Inventory tools in the actual Windows/WSL environments`.

Do not start TASK-004 until the inventory report records what is actually installed and where. The earlier inspection environment did not have the required source PBF and GIS executables, so tool availability must be checked on the machine/environment that will actually run the app.
