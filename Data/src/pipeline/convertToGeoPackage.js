import path from 'path';
import { logger } from '../utils/logger.js';
import { ensureDirectory, removeFileIfExists } from '../utils/fileUtils.js';
import { runCommand } from '../utils/commandRunner.js';

export async function convertToGeoPackage({ geojsonFile, outputDir, baseName, layerName = 'administrative_boundaries', crs = 'EPSG:4326' }) {
  logger.step(4, 6, 'Creating GeoPackage...');

  const gpkgFile = path.join(outputDir, `${baseName}.gpkg`);
  ensureDirectory(outputDir);
  removeFileIfExists(gpkgFile);

  await runCommand('ogr2ogr', [
    '-f', 'GPKG',
    gpkgFile,
    geojsonFile,
    '-nln', layerName,
    '-nlt', 'MULTIPOLYGON',
    '-s_srs', crs,
    '-t_srs', crs,
    '-overwrite',
  ]);

  logger.success(`GeoPackage created: ${gpkgFile}`);
  return gpkgFile;
}
