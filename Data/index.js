import { resolveConfig } from './src/config/config.js';
import { runPipeline } from './src/pipeline/runPipeline.js';
import { logger } from './src/utils/logger.js';

async function main() {
  try {
    const config = resolveConfig(process.argv.slice(2));

    if (config.help) {
      console.log('Usage: node index.js [world.osm.pbf]');
      console.log('Examples:');
      console.log('  node index.js');
      console.log('  node index.js world.osm.pbf');
      console.log('  node src/index.js --input path/to/file.osm.pbf');
      process.exit(0);
    }

    await runPipeline(config);
  } catch (error) {
    logger.error(error.message || 'Unknown error');
    process.exit(1);
  }
}

main();
