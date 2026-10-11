import path from 'path';
import fs from 'fs';
import { ensureDirectory, removeFileIfExists } from '../utils/fileUtils.js';
import { logger } from '../utils/logger.js';
import { runCommand } from '../utils/commandRunner.js';

export async function extractAdministrativeData({ inputFile, outputDir, levels, tempDir, keepTemp }) {
  logger.step(2, 6, 'Extracting administrative boundaries...');

  ensureDirectory(outputDir);
  ensureDirectory(tempDir);

  const extractedFile = path.join(tempDir, 'administrative_boundaries.osm.pbf');
  const rawGeojson = path.join(tempDir, 'administrative_boundaries_raw.geojsonseq');
  const finalGeojson = path.join(outputDir, 'administrative_boundaries.geojson');

  removeFileIfExists(extractedFile);
  removeFileIfExists(rawGeojson);
  removeFileIfExists(finalGeojson);

  await runCommand('osmium', [
    'tags-filter',
    inputFile,
    'r/boundary=administrative',
    '--progress',
    '-o',
    extractedFile,
    '--overwrite',
  ], {
    monitorFile: extractedFile,
    monitorLabel: 'Extracting administrative PBF',
  });

  await runCommand('osmium', [
    'export',
    extractedFile,
    '-f',
    'geojsonseq',
    '-o',
    rawGeojson,
    '--overwrite',
  ]);

  const sqlWhere = `boundary = 'administrative' AND CAST(admin_level AS INTEGER) IN (${levels.join(',')})`;

  await runCommand('ogr2ogr', [
    '-f', 'GeoJSON',
    finalGeojson,
    rawGeojson,
    '-where',
    sqlWhere,
    '-dialect',
    'SQLite',
    '-overwrite',
  ]);

  if (fs.existsSync(finalGeojson)) {
    logger.success('Administrative boundary extraction complete.');
  }

  if (!keepTemp) {
    removeFileIfExists(extractedFile);
    removeFileIfExists(rawGeojson);
  }

  return finalGeojson;
}
