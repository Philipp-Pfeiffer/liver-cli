import { defineConfig } from 'tsup';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'fs';
import { join } from 'path';

const srcMigrations = join(__dirname, 'src/db/migrations');
const destMigrations = join(__dirname, 'dist/migrations');

// ethanol-rs WASM bindings (wasm-pack, --target nodejs). They are loaded at
// runtime via require() relative to dist/index.js, so they must ship inside
// dist/. The package.json in that folder must be copied too: it has no
// "type": "module", which keeps ethanol_rs_wasm.js CommonJS (the root
// package.json of liver-cli is "type": "module").
const srcVendor = join(__dirname, 'vendor/ethanol-rs-pkg');
const destVendor = join(__dirname, 'dist/vendor/ethanol-rs-pkg');
const REQUIRED_VENDOR_FILES = ['ethanol_rs_wasm.js', 'ethanol_rs_wasm_bg.wasm', 'package.json'];

function copyMigrations() {
  mkdirSync(destMigrations, { recursive: true });
  for (const file of readdirSync(srcMigrations)) {
    const srcFile = join(srcMigrations, file);
    if (statSync(srcFile).isFile()) {
      copyFileSync(srcFile, join(destMigrations, file));
    }
  }
}

function copyVendor() {
  for (const file of REQUIRED_VENDOR_FILES) {
    if (!existsSync(join(srcVendor, file))) {
      throw new Error(`vendor/ethanol-rs-pkg/${file} missing — run "npm run vendor:build"`);
    }
  }
  rmSync(destVendor, { recursive: true, force: true });
  mkdirSync(destVendor, { recursive: true });
  cpSync(srcVendor, destVendor, { recursive: true });
}

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node22',
  splitting: false,
  sourcemap: true,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node\n',
  },
  async onSuccess() {
    copyMigrations();
    copyVendor();
  },
});
