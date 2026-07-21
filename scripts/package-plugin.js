/**
 * package-plugin.js
 * Bundles the built panel + host scripts into a .zxp installer.
 * Run: node scripts/package-plugin.js
 *
 * Requires ZXPSignCmd from Adobe Exchange (or a signing workaround for dev).
 */

const fs = require('fs');
const path = require('path');

const PLUGIN_NAME = 'HandwritingAnimation';
const DIST_DIR = path.resolve(__dirname, '../dist');
const HOST_DIR = path.resolve(__dirname, '../host');
const ASSETS_DIR = path.resolve(__dirname, '../assets');
const OUT_DIR = path.resolve(__dirname, '../release');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dest) {
  ensureDir(dest);
  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    if (fs.statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function buildPluginPackage() {
  console.log('📦 Packaging plugin…');
  ensureDir(OUT_DIR);

  const packageDir = path.join(OUT_DIR, PLUGIN_NAME);
  ensureDir(packageDir);

  // Copy built panel
  copyDir(DIST_DIR, packageDir);

  // Copy host scripts
  copyDir(HOST_DIR, path.join(packageDir, 'host'));

  // Copy manifest
  const csxsDest = path.join(packageDir, 'CSXS', 'manifest.xml');
  ensureDir(path.dirname(csxsDest));
  fs.copyFileSync(
    path.join(HOST_DIR, 'manifest', 'CSXS-manifest.xml'),
    csxsDest,
  );

  // Copy assets
  if (fs.existsSync(ASSETS_DIR)) {
    copyDir(ASSETS_DIR, path.join(packageDir, 'assets'));
  }

  console.log(`✅ Plugin packaged to: ${packageDir}`);
  console.log('');
  console.log('To install in After Effects (dev mode):');
  console.log(`  Copy "${packageDir}" to:`);
  console.log('  macOS: ~/Library/Application Support/Adobe/CEP/extensions/');
  console.log('  Windows: %APPDATA%\\Adobe\\CEP\\extensions\\');
  console.log('');
  console.log('Enable unsigned extensions:');
  console.log('  macOS: defaults write com.adobe.CSXS.10 PlayerDebugMode 1');
  console.log('  Windows: HKCU\\Software\\Adobe\\CSXS.10 → PlayerDebugMode = 1');
}

buildPluginPackage();