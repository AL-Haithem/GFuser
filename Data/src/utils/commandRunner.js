import { spawn } from 'child_process';
import fs from 'fs';

export function runCommand(command, args, options = {}) {
  const {
    cwd = process.cwd(),
    env = process.env,
    stdio = 'inherit',
    silent = false,
    monitorFile = null,
    monitorLabel = 'Processing',
  } = options;

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env,
      stdio,
    });

    const startedAt = Date.now();
    const monitor = monitorFile
      ? setInterval(() => {
        let size = 0;
        try {
          size = fs.statSync(monitorFile).size;
        } catch {
          // The output file may not exist until the first write.
        }

        const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
        const elapsed = `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`;
        const sizeMb = (size / (1024 ** 2)).toFixed(1);
        process.stdout.write(`\r${monitorLabel}: running | elapsed ${elapsed} | output ${sizeMb} MB`);
      }, 10000)
      : null;

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
        if (!silent) {
          process.stdout.write(chunk);
        }
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
        if (!silent) {
          process.stderr.write(chunk);
        }
      });
    }

    child.on('error', (error) => {
      if (monitor) {
        clearInterval(monitor);
        process.stdout.write('\n');
      }
      reject(new Error(`${command} failed: ${error.message}`));
    });

    child.on('close', (code) => {
      if (monitor) {
        clearInterval(monitor);
        process.stdout.write('\n');
      }

      if (code === 0) {
        resolve({ code, stdout, stderr });
        return;
      }

      reject(new Error(`${command} exited with code ${code}. ${stderr || stdout}`));
    });
  });
}
