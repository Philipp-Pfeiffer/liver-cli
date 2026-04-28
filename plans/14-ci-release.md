# Phase 14: CI & Release

## Ziel
GitHub Actions CI/CD und Release-Prozess einrichten.

## Schritt 14.1: GitHub Actions Workflow

Erstelle `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]
        node: ['22', '24']
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'npm'
      - run: npm ci
      - run: npm run test

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - run: test -f dist/index.js
```

## Schritt 14.2: Release Workflow

Erstelle `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          registry-url: 'https://registry.npmjs.org'
      - run: npm ci
      - run: npm run build
      - run: npm run test

      - name: Extract changelog
        id: changelog
        run: |
          VERSION=${GITHUB_REF#refs/tags/v}
          echo "Extracting changelog for v${VERSION}"
          awk "/^## \\[${VERSION}\]/{flag=1;next}/^## \\[/{flag=0}flag" CHANGELOG.md > RELEASE_NOTES.md
          cat RELEASE_NOTES.md

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v1
        with:
          body_path: RELEASE_NOTES.md

      - name: Publish to npm
        run: |
          if [[ "${GITHUB_REF}" == *"-rc."* ]]; then
            npm publish --access public --tag next
          else
            npm publish --access public
          fi
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Schritt 14.3: CHANGELOG erstellen

Erstelle `/home/p-pfeiffer/dev/liver-cli/CHANGELOG.md`:

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial implementation of liver CLI
- BAC tracking with Watson and Widmark formulas
- Session management
- Drink logging
- Statistics
- Configuration system

## [0.1.0] - 2026-04-28

### Added
- Initial release
- Basic CLI structure
```

## Schritt 14.4: README erstellen

Erstelle `/home/p-pfeiffer/dev/liver-cli/README.md`:

```markdown
# liver

BAC tracking CLI

## Installation

```bash
npm install -g liver
```

## Usage

```bash
# Setup profile (once)
liver profile set --weight 78 --height 184 --sex m --age 22

# Save presets
liver preset save augustiner --vol 500 --abv 5.2

# Track drinking
liver session start --name "Friday Night" --stomach full
liver add augustiner
liver status
liver session end

# Statistics
liver stats --month 2026-04
```

## Commands

See `liver --help` for full command reference.

## Disclaimer

All BAC calculations are estimates and not legally or medically valid.
```

## Schritt 14.5: LICENSE erstellen

Erstelle `/home/p-pfeiffer/dev/liver-cli/LICENSE-MIT`:

```
MIT License

Copyright (c) 2026 liver contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## Schritt 14.6: Scripts

Erstelle `/home/p-pfeiffer/dev/liver-cli/scripts/rebuild-wasm.sh`:

```bash
#!/bin/bash
set -e

echo "Rebuilding ethanol-rs WASM..."

# Clone ethanol-rs if not present
if [ ! -d "vendor/ethanol-rs/src" ]; then
  echo "Please clone ethanol-rs into vendor/ethanol-rs/"
  exit 1
fi

cd vendor/ethanol-rs
wasm-pack build --target nodejs --release --features wasm

echo "WASM rebuild complete. Commit the pkg/ directory."
```

Mache es ausführbar: `chmod +x scripts/rebuild-wasm.sh`

## Schritt 14.7: Finaler Build und Test

```bash
npm run build
npm run lint
npm run test
```

## Erfolgskriterien

- [ ] GitHub Actions Workflows sind konfiguriert
- [ ] CI läuft auf Ubuntu und macOS mit Node 22 und 24
- [ ] Release-Workflow erstellt GitHub Releases und publiziert npm
- [ ] CHANGELOG existiert
- [ ] README existiert
- [ ] LICENSE existiert
- [ ] Alle Tests passen
- [ ] Lint ist sauber
- [ ] Build produziert funktionierendes Binary

## Abschluss

Die liver CLI ist nun vollständig implementiert und einsatzbereit. Alle 14 Phasen sind abgeschlossen.

## Nächste Schritte (optional)

- ethanol-rs gegen echten WASM-Build ersetzen
- Shell-Completion hinzufügen
- i18n Unterstützung
- Windows Support

## Zusammenfassung

Das Projekt ist in 14 Phasen strukturiert:
1. Projekt-Setup
2. Datenbank & Schema
3. WASM Integration
4. Time & Config
5. Error-System
6. Profile & Presets
7. Session Management
8. Drink Management
9. Computation Commands
10. Stats Command
11. Output Formatting
12. CLI Integration
13. Testing
14. CI & Release

Jede Phase hat klare Erfolgskriterien und Tests. Die Spezifikation ist die normative Quelle.
