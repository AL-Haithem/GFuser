import { execFile } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function checkOsmium(runtimeDirectory) {
  const executablePath = path.join(runtimeDirectory, 'Library', 'bin', 'osmium.exe');
  try {
    const executable = await fs.promises.stat(executablePath);
    if (!executable.isFile()) throw new Error('The Osmium executable is not a file.');
  } catch {
    return { id: 'osmium', name: 'Osmium', status: 'missing', detail: 'Executable not found.' };
  }

  const libraryPath = path.dirname(executablePath);
  const environmentPath = [libraryPath, runtimeDirectory, process.env.PATH || ''].join(path.delimiter);
  try {
    const { stdout, stderr } = await execFileAsync(executablePath, ['--version'], {
      cwd: runtimeDirectory,
      env: { ...process.env, PATH: environmentPath },
      timeout: 5000,
      windowsHide: true,
    });
    const version = (stdout || stderr).trim().split(/\r?\n/, 1)[0];
    return {
      id: 'osmium',
      name: 'Osmium',
      status: 'ready',
      detail: version || 'The command responded successfully.',
    };
  } catch (error) {
    return {
      id: 'osmium',
      name: 'Osmium',
      status: 'unavailable',
      detail: error.killed ? 'The availability check timed out.' : error.stderr?.trim() || 'Could not run the bundled executable.',
    };
  }
}