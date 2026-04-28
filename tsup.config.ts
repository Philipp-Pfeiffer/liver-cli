import { defineConfig } from 'tsup';
import { copyFileSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const srcMigrations = join(__dirname, 'src/db/migrations');
const destMigrations = join(__dirname, 'dist/migrations');

function copyMigrations() {
  mkdirSync(destMigrations, { recursive: true });
  for (const file of readdirSync(srcMigrations)) {
    const srcFile = join(srcMigrations, file);
    if (statSync(srcFile).isFile()) {
      copyFileSync(srcFile, join(destMigrations, file));
    }
  }
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
  },
});
