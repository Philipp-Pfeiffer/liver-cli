import { describe, it, expect, afterAll } from 'vitest';
import { execSync } from 'child_process';
import { cpSync, existsSync, mkdtempSync, rmSync, symlinkSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { tmpdir } from 'os';

// Regression test for the build: dist/ must be self-contained with respect to
// the ethanol-rs WASM bindings (vendor/ is copied into dist/vendor by tsup).
// We copy dist/ into a temp package that has NO vendor/ next to it, so only
// dist/vendor can satisfy the loader.
const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const work = mkdtempSync(join(tmpdir(), 'liver-dist-'));
const pkg = join(work, 'pkg');

afterAll(() => {
  rmSync(work, { recursive: true, force: true });
});

describe('build: vendor/ ships inside dist/', () => {
  it('dist/vendor contains the WASM bindings and their package.json', () => {
    const v = join(root, 'dist/vendor/ethanol-rs-pkg');
    expect(existsSync(join(v, 'ethanol_rs_wasm.js'))).toBe(true);
    expect(existsSync(join(v, 'ethanol_rs_wasm_bg.wasm'))).toBe(true);
    expect(existsSync(join(v, 'package.json'))).toBe(true);
  });

  it('dist/ runs a BAC computation without a vendor/ folder next to it', () => {
    cpSync(join(root, 'dist'), join(pkg, 'dist'), { recursive: true });
    copyFileSync(join(root, 'package.json'), join(pkg, 'package.json'));
    symlinkSync(join(root, 'node_modules'), join(pkg, 'node_modules'), 'dir');
    expect(existsSync(join(pkg, 'vendor'))).toBe(false);
    expect(existsSync(join(work, 'vendor'))).toBe(false);

    const db = join(work, 'db.sqlite');
    const run = (cmd: string) =>
      JSON.parse(execSync(`LIVER_DB=${db} node ${join(pkg, 'dist/index.js')} ${cmd}`, { encoding: 'utf-8' }));

    run('profile set --weight 78 --height 184 --sex m --age 30');
    run('session start --at "2026-05-01T18:00:00Z"');
    run('add --vol 500 --abv 5 --at "2026-05-01T18:00:00Z" --duration 30m');
    const bac = run('bac --at "2026-05-01T19:00:00Z"');
    expect(bac.bac_promille).toBeGreaterThan(0.1);
    expect(bac.bac_promille).toBeLessThan(0.8);
  });
});
