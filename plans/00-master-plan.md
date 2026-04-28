# liver CLI – Master Implementation Plan

## Ziel
Eine vollständige, production-ready BAC-Tracking CLI in TypeScript/Node.js gemäß der Spezifikation `liver – Implementation Spec v1.0`.

## Architektur-Prinzipien
- **KISS**: Keine unnötigen Abstraktionen
- **Spezifikation ist normativ**: Jede Abweichung m dokumentiert werden
- **JSON-first**: stdout ist immer JSON (außer `--human`)
- **SQLite + Plain SQL**: Kein ORM
- **WASM-Engine**: ethanol-rs als Vendored Dependency

## Repo-Struktur (Ziel)

```
liver/
├── README.md
├── LICENSE-MIT
├── package.json
├── tsconfig.json
├── biome.json
├── vendor/
│   └── ethanol-rs/        ← committed WASM + COMMIT.txt
├── scripts/
│   └── rebuild-wasm.sh
├── src/
│   ├── index.ts           ← CLI Entry Point
│   ├── commands/          ← Ein File pro Command-Group
│   ├── engine/            ← WASM Adapter
│   ├── db/                ← DB Layer + Migrations
│   ├── config/            ← Config Reader/Writer
│   ├── time/              ← chrono-node Wrapper
│   ├── errors/            ← Error Klassen + Exit Codes
│   ├── output/            ← JSON/Human Formatter
│   └── types.ts           ← Shared Types
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
└── bin/
    └── liver              ← #!/usr/bin/env node
```

## Implementierungs-Reihenfolge

| Phase | Name | Datei | Abhängigkeiten |
|-------|------|-------|----------------|
| 1 | Projekt-Setup | `01-project-setup.md` | - |
| 2 | Datenbank & Schema | `02-database-schema.md` | Phase 1 |
| 3 | WASM Integration | `03-wasm-integration.md` | Phase 1 |
| 4 | Time & Config | `04-time-and-config.md` | Phase 1 |
| 5 | Error-System | `05-error-system.md` | Phase 1 |
| 6 | Profile & Presets | `06-profile-presets.md` | Phase 2, 4, 5 |
| 7 | Session Management | `07-session-management.md` | Phase 2, 4, 5 |
| 8 | Drink Management | `08-drink-management.md` | Phase 2, 3, 4, 5, 7 |
| 9 | Computation Commands | `09-computation-commands.md` | Phase 3, 7, 8 |
| 10 | Stats Command | `10-stats-command.md` | Phase 2, 3, 7, 8 |
| 11 | Output Formatting | `11-output-formatting.md` | Phase 5 |
| 12 | CLI Integration | `12-cli-integration.md` | Alle vorherigen |
| 13 | Testing | `13-testing.md` | Phase 12 |
| 14 | CI & Release | `14-ci-release.md` | Phase 1, 13 |

## Wichtige Regeln für Coding Agents

1. **Niemals mehr als eine Phase gleichzeitig bearbeiten**
2. **Jede Phase muss vollständig implementiert und getestet sein, bevor zur nächsten gegangen wird**
3. **Die Spec ist normativ - bei Unklarheiten in den Plan-Dateien gilt die Spec**
4. **TypeScript strict mode: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`**
5. **ESM only (`"type": "module"`)**
6. **Keine Abkürzungen: Wenn ein Plan "implementiere X" sagt, muss X vollständig implementiert werden**
7. **Nach jeder Phase: `npm run lint` und `npm run test` müssen passen**

## Konventionen

- Alle Zeitstempel in der DB: UTC ISO als TEXT
- Alle Zeitstempel im JSON-Output: ISO mit lokalem Offset (`+02:00`)
- `--human` Output: `Europe/Berlin`, Format `HH:MM`
- Volumen: immer Milliliter
- ABV: in Prozent (0-100) in DB, als Fraction (0.0-1.0) an WASM
- BAC: WASM liefert Prozent, liver multipliziert ×10 für Promille

## Globale Flags (in jeder Phase beachten)

- `--human` → Tabellen statt JSON
- `--no-color` / `NO_COLOR=1` → monochrom
- `--verbose` / `-v` → Performance-Logs auf stderr
- `--formula <watson|widmark>` → Override für Compute-Commands

## Exit Codes (überall korrekt setzen)

- `0` = Success
- `1` = User-Error (Input falsch/fehlend)
- `2` = State-Error (logischer Konflikt mit DB)
- `3` = Internal-Error (Engine, DB, WASM)
- `4` = Config-Error

## Next Step

Beginne mit **Phase 1: Projekt-Setup** (`01-project-setup.md`).
