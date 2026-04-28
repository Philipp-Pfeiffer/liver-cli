# Phase 1: Projekt-Setup

## Ziel
Projekt-Skelett erstellen, Tooling konfigurieren, erste Dateien anlegen.

## Schritt 1.1: package.json erstellen

Erstelle `/home/p-pfeiffer/dev/liver-cli/package.json`:

```json
{
  "name": "liver",
  "version": "0.1.0",
  "description": "BAC tracking CLI",
  "type": "module",
  "bin": {
    "liver": "./bin/liver"
  },
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "lint": "biome check .",
    "lint:fix": "biome check . --write",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "engines": {
    "node": ">=22.0.0"
  },
  "dependencies": {
    "commander": "^12.0.0",
    "better-sqlite3": "^11.0.0",
    "chrono-node": "^2.7.6"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.10",
    "@types/node": "^22.0.0",
    "biome": "^1.8.0",
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^2.0.0"
  }
}
```

## Schritt 1.2: tsconfig.json erstellen

Erstelle `/home/p-pfeiffer/dev/liver-cli/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

## Schritt 1.3: biome.json erstellen

Erstelle `/home/p-pfeiffer/dev/liver-cli/biome.json`:

```json
{
  "$schema": "https://biomejs.dev/schemas/1.8.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "tab",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "all"
    }
  }
}
```

## Schritt 1.4: tsup.config.ts erstellen

Erstelle `/home/p-pfeiffer/dev/liver-cli/tsup.config.ts`:

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'node22',
  splitting: false,
  sourcemap: true,
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
```

## Schritt 1.5: bin/liver erstellen

Erstelle `/home/p-pfeiffer/dev/liver-cli/bin/liver`:

```bash
#!/usr/bin/env node
import('../dist/index.js');
```

Mache es ausführbar: `chmod +x bin/liver`

## Schritt 1.6: Verzeichnisstruktur anlegen

```bash
mkdir -p src/{commands,engine,db,config,time,errors,output}
mkdir -p tests/{unit,integration,fixtures}
mkdir -p vendor/ethanol-rs
mkdir -p scripts
```

## Schritt 1.7: Gitignore erstellen

Erstelle `/home/p-pfeiffer/dev/liver-cli/.gitignore`:

```gitignore
node_modules/
dist/
*.log
.DS_Store
coverage/
*.sqlite
*.sqlite-journal
```

## Schritt 1.8: Erste src/index.ts erstellen

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/index.ts`:

```typescript
#!/usr/bin/env node

console.log(JSON.stringify({ status: "liver CLI v0.1.0 - not yet implemented" }));
process.exit(0);
```

## Schritt 1.9: Dependencies installieren

```bash
npm install
```

## Schritt 1.10: Build testen

```bash
npm run build
./bin/liver
```

Erwartete Ausgabe: `{"status":"liver CLI v0.1.0 - not yet implemented"}`

## Schritt 1.11: Lint testen

```bash
npm run lint
```

Sollte keine Fehler werfen.

## Erfolgskriterien

- [ ] `npm install` läuft durch
- [ ] `npm run build` erzeugt `dist/index.js`
- [ ] `./bin/liver` gibt JSON aus
- [ ] `npm run lint` ist sauber
- [ ] Alle Verzeichnisse existieren
- [ ] Keine uncommitted Dateien außer `node_modules/`

## Nächste Phase

**Phase 2: Datenbank & Schema** (`02-database-schema.md`)
