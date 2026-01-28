#!/usr/bin/env node

/**
 * Local Build Setup Script
 *
 * This script prepares the activities-loader for local builds by:
 * 1. Copying required files from hpe-altloader into src/
 * 2. Installing dependencies in src/libs
 *
 * Usage: node scripts/setup-local.js
 * Or:    npm run setup:local
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const hpeAltloaderPath = path.resolve(rootDir, '..', 'hpe-altloader');
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

function main() {
  log('Starting local build setup...');

  // Check if hpe-altloader exists
  if (!fs.existsSync(hpeAltloaderPath)) {
    error(`hpe-altloader not found at: ${hpeAltloaderPath}\n` +
          `Please clone hpe-altloader to the same parent directory as activities-loader.`);
  }
  log(`Found hpe-altloader at: ${hpeAltloaderPath}`);

  // Clean and create src directory
  if (fs.existsSync(srcPath)) {
    log('Removing existing src/ directory...');
    fs.rmSync(srcPath, { recursive: true, force: true });
  }
  fs.mkdirSync(srcPath, { recursive: true });
  log('Created fresh src/ directory');

  // Copy files
  for (const file of filesToCopy) {
    const srcFile = path.join(hpeAltloaderPath, file);
    const destFile = path.join(srcPath, file);

    if (!fs.existsSync(srcFile)) {
      error(`Required file not found: ${srcFile}`);
    }

    fs.copyFileSync(srcFile, destFile);
    log(`Copied ${file}`);
  }

  // Copy folders
  for (const folder of foldersToCopy) {
    const srcFolder = path.join(hpeAltloaderPath, folder);
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
      execSync('npm install', {
        cwd: libsPath,
        stdio: 'inherit'
      });
      log('Dependencies installed successfully');
    } catch (err) {
      error(`Failed to install dependencies: ${err.message}`);
    }
  }

  log('Setup complete! You can now run: npm run build -- --lib');
}

main();
