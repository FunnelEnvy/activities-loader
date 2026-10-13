#!/usr/bin/env node

/**
 * Local Build Setup Script
 *
 * This script prepares the activities-loader for local builds by:
 * 1. Copying the config files and libs/ from a source root into src/
 * 2. Installing dependencies in src/libs
 *
 * The source root is the first of these that applies:
 * 1. --source <path>, resolved against the current directory
 * 2. the ALTLOADER_SRC environment variable
 * 3. a sibling hpe-web-dev clone's activities/, when it exists
 * 4. a sibling hpe-altloader clone
 *
 * An explicit root (1 or 2) that does not exist is an error, with no fallback.
 * Activity directories are not copied. Before a group build, copy each group
 * directory's contents into src/activities/, as CI does.
 *
 * Usage: node scripts/setup-local.js [--source <path>]
 * Or:    npm run setup:local -- --source <path>
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const srcPath = path.resolve(rootDir, 'src');

const filesToCopy = [
  'activities.json',
  'audiences.json',
  'locations.json',
  'sites.json',
  'analytics_events.json',
];

const foldersToCopy = [
  'libs',
];

function log(message) {
  console.log(`[setup-local] ${message}`);
}

function error(message) {
  console.error(`[setup-local] ERROR: ${message}`);
  process.exit(1);
}

function copyFolderSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyFolderSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function readSourceArg() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    let value = null;
    if (args[i] === '--source') {
      value = args[i + 1];
    } else if (args[i].startsWith('--source=')) {
      value = args[i].slice('--source='.length);
    } else {
      continue;
    }
    // An explicit --source never falls back, so an empty value is an error too.
    if (!value || value.startsWith('--')) {
      error('--source needs a path');
    }
    return value;
  }
  return null;
}

// Pick the source root by the first rule that applies. Exits before src/ is touched
// when no rule yields an existing root.
function resolveSourceRoot() {
  const sourceArg = readSourceArg();
  if (sourceArg) {
    const root = path.resolve(process.cwd(), sourceArg);
    if (!fs.existsSync(root)) {
      error(`--source path not found: ${root}`);
    }
    return { root, rule: '--source' };
  }

  if (process.env.ALTLOADER_SRC) {
    const root = path.resolve(process.cwd(), process.env.ALTLOADER_SRC);
    if (!fs.existsSync(root)) {
      error(`ALTLOADER_SRC path not found: ${root}`);
    }
    return { root, rule: 'ALTLOADER_SRC' };
  }

  const siblings = [
    { root: path.resolve(rootDir, '..', 'hpe-web-dev', 'activities'), rule: 'sibling hpe-web-dev/activities' },
    { root: path.resolve(rootDir, '..', 'hpe-altloader'), rule: 'sibling hpe-altloader' },
  ];
  for (const sibling of siblings) {
    if (fs.existsSync(sibling.root)) {
      return sibling;
    }
  }

  error('No source root found. Tried:\n' +
        siblings.map(s => `  ${s.root}`).join('\n') + '\n' +
        'Pass --source <path> or set ALTLOADER_SRC.');
}

function main() {
  log('Starting local build setup...');

  const { root: sourceRoot, rule } = resolveSourceRoot();
  log(`Using source root: ${sourceRoot} (${rule})`);

  // Clean and create src directory
  if (fs.existsSync(srcPath)) {
    log('Removing existing src/ directory...');
    fs.rmSync(srcPath, { recursive: true, force: true });
  }
  fs.mkdirSync(srcPath, { recursive: true });
  log('Created fresh src/ directory');

  // Copy files
  for (const file of filesToCopy) {
    const srcFile = path.join(sourceRoot, file);
    const destFile = path.join(srcPath, file);

    if (!fs.existsSync(srcFile)) {
      error(`Required file not found: ${srcFile}`);
    }

    fs.copyFileSync(srcFile, destFile);
    log(`Copied ${file}`);
  }

  // Copy folders
  for (const folder of foldersToCopy) {
    const srcFolder = path.join(sourceRoot, folder);
    const destFolder = path.join(srcPath, folder);

    if (!fs.existsSync(srcFolder)) {
      error(`Required folder not found: ${srcFolder}`);
    }

    copyFolderSync(srcFolder, destFolder);
    log(`Copied ${folder}/`);
  }

  // Install dependencies in src/libs
  const libsPath = path.join(srcPath, 'libs');
  if (fs.existsSync(path.join(libsPath, 'package.json'))) {
    log('Installing dependencies in src/libs...');
    try {
      // --no-package-lock keeps npm from writing package-lock.json or rewriting yarn.lock
      // at the repo root, which is a yarn workspace that includes src/libs.
      execSync('npm install --no-package-lock', {
        cwd: libsPath,
        stdio: 'inherit'
      });
      log('Dependencies installed successfully');
    } catch (err) {
      error(`Failed to install dependencies: ${err.message}`);
    }
  }

  log('Setup complete! You can now run: node build.js --lib');
  log('To build activities, copy each group directory\'s contents into src/activities/, then run: npm run build');
}

main();
