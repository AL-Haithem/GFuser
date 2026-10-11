import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger.js';
import { ensureDirectory } from '../utils/fileUtils.js';
import { runCommand } from '../utils/commandRunner.js';
import { extractAdministrativeData } from './extractOsm.js';
import { convertToGeoPackage } from './convertToGeoPackage.js';

export async function runPipeline(config) {
  logger.info('');
  logger.info('======================================');
  logger.info('OSM to GeoPackage');
  logger.info('======================================');
  logger.info(`Input: ${config.inputFile}`);
  logger.info(`Output: ${config.outputDir}`);
  logger.info(`Admin levels: ${config.levels.join(', ')}`);
  logger.info('======================================');
  logger.info('');

  logger.step(1, 6, 'Checking input and required tools...');

  if (!fs.existsSync(config.inputFile)) {
    throw new Error(`Input file not found: ${config.inputFile}`);
  }

  for (const command of ['osmium', 'ogr2ogr']) {
    try {
      await runCommand(command, ['--version'], { silent: true });
    } catch {
      throw new Error(`${command} is required but was not found in PATH. Install it before running this program.`);
    }
  }

  logger.success('Input and required tools are available.');

  ensureDirectory(config.outputDir);
  ensureDirectory(config.tempDir);

  const geojsonFile = await extractAdministrativeData({
    inputFile: config.inputFile,
    outputDir: config.outputDir,
    levels: config.levels,
    tempDir: config.tempDir,
    keepTemp: false,
  });

  const baseName = path.basename(config.outputDir) || 'output';
  const gpkgFile = await convertToGeoPackage({
    geojsonFile,
    outputDir: config.outputDir,
    baseName,
    layerName: 'administrative_boundaries',
    crs: 'EPSG:4326',
  });

  logger.info('');
  logger.info('Done.');
  logger.info(`GeoPackage: ${gpkgFile}`);
  logger.info('');

  return {
    geojsonFile,
    gpkgFile,
  };
}
