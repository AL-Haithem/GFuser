const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const projectName = process.argv[2];

if (!projectName) {
  console.error('Usage: node scripts/runProject.js <Data|MapPipeline>');
  process.exit(1);
}

const projectDir = path.join(root, projectName);
if (!fs.existsSync(projectDir)) {
  console.error(`Project not found: ${projectDir}`);
  process.exit(1);
}

const command = projectName === 'Data' ? 'npm' : 'npm';
const args = projectName === 'Data' ? ['start'] : ['run', 'generate'];

const result = spawnSync(command, args, {
  cwd: projectDir,
  stdio: 'inherit',
  shell: true,
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 0);
