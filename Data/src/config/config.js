import fs from 'fs';
import path from 'path';

export const DEFAULT_ADMIN_LEVELS = [1, 2, 3, 4];

export function parseLevels(value) {
  if (!value) {
    return [...DEFAULT_ADMIN_LEVELS];
  }

  if (Array.isArray(value)) {
    return value.map((item) => Number(item)).filter((item) => Number.isInteger(item));
  }

  return String(value)
    .split(',')
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item));
}

export function parseArgs(argv) {
  const args = { input: null, output: null, levels: [...DEFAULT_ADMIN_LEVELS] };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === '--help' || current === '-h') {
      args.help = true;
      continue;
    }

    if (current === '--input' || current === '-i') {
      args.input = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === '--output' || current === '-o') {
      args.output = argv[index + 1];
      index += 1;
      continue;
    }

    if (current === '--levels' || current === '-l') {
      args.levels = parseLevels(argv[index + 1]);
      index += 1;
      continue;
    }

    if (!current.startsWith('-') && !args.input) {
      args.input = current;
    }
  }

  if (!args.input) {
    const defaultFile = path.resolve(process.cwd(), 'world.osm.pbf');
    if (fs.existsSync(defaultFile)) {
      args.input = defaultFile;
    }
  }

  return args;
}

export function resolveConfig(rawArgs) {
  const args = parseArgs(rawArgs);

  if (args.help) {
    return { help: true };
  }

  if (!args.input) {
    throw new Error('Input file is required. Example: node index.js world.osm.pbf or node src/index.js --input path/to/file.osm.pbf');
  }

  const inputFile = path.resolve(args.input);

  if (!inputFile.toLowerCase().endsWith('.osm.pbf')) {
    throw new Error('Input file must use the .osm.pbf extension.');
  }

  const outputDir = path.resolve(args.output || path.join(path.dirname(inputFile), path.basename(inputFile, '.osm.pbf')));
  const levels = parseLevels(args.levels);

  if (!levels.length) {
    throw new Error('At least one admin level must be configured.');
  }

  return {
    inputFile,
    outputDir,
    levels,
    tempDir: path.join(outputDir, '.tmp'),
  };
}
