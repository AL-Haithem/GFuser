const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');

function runCommand(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function ensureDependency(projectName) {
  const projectDir = path.join(root, projectName);
  const packageJson = path.join(projectDir, 'package.json');

  if (!fs.existsSync(packageJson)) {
    throw new Error(`Missing project folder: ${projectName}`);
  }

  const dependenciesInstalled = fs.existsSync(path.join(projectDir, 'node_modules'));
  if (!dependenciesInstalled) {
    console.log(`Installing dependencies for ${projectName}...`);
    runCommand('npm', ['install'], projectDir);
  }
}

function main() {
  try {
    console.log('Starting merged map pipeline...');

    ensureDependency('Data');
    ensureDependency('MapPipeline');

    console.log('Running OSM to GeoPackage step...');
    runCommand('npm', ['run', 'start'], path.join(root, 'Data'));

    console.log('Running map generation step...');
    runCommand('npm', ['run', 'generate'], path.join(root, 'MapPipeline'));

    console.log('Merged map pipeline completed successfully.');
  } catch (error) {
    console.error(error && error.message ? error.message : String(error));
    process.exit(1);
  }
}

main();
