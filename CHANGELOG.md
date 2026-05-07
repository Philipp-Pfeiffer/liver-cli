# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Engine — Migration zu ethanol-rs (WASM)** — TS-Engine durch ethanol-rs WASM ersetzt. First-Order-Kinetics (ka-Modell) statt linearer Absorption. Peak-Timing physiologisch korrekt (T+15-45min). Bioavailability asymptotisch 100%.
- Vendoring: ethanol-rs @ `0818749` als git submodule, WASM-Build committed in `vendor/ethanol-rs/pkg/`
- Build-Toolchain: `wasm-pack@0.13.1`, Rust target `wasm32-unknown-unknown`

### Added
- Suite B acceptance-band tests (21 tests across 8 modules) per Spec v1.2.0 §1.6 — validates ethanol-rs engine against peer-reviewed pharmacokinetic literature
- `pnpm test:bands` — dedicated test script for pharmacokinetic validation suite
- `src/engine/wasm-loader.ts` — Sync WASM-Adapter mit `initWasm()` Boot-Hook
- `tests/unit/wasm-bridge.test.ts` — 5 Anti-Stub-Smoke-Tests (Watson≠Widmark, Peak nach t=0, Superposition, Stomach-State, Absorbing-Count)
- `vendor:build` / `vendor:check` npm scripts

### Fixed
- `src/commands/stats.ts` — `generateSessionCurve` nutzte `-offset` statt `0`, was alle Curve-Punkte auf T0 referenzierte. Jetzt korrekte zeitliche Variabilität.

### Engineering
- `STOMACH_MAP`, `SEX_MAP`, `KA_BY_STOMACH` in `src/engine/types.ts`
- `initWasm()` wird in `src/engine/index.ts` beim Import aufgerufen

## [0.1.2] - 2026-05-03

### Fixed
- **Engine — Eliminations-Rate β-Unit-Bug** — `ELIMINATION_RATE` korrigiert von `0.015` (Prozent/h) auf `0.0015` (Prozent/h ≡ 0.015 ‰/h). Sober-Erreichung jetzt bei ~T+20h für 0.5 l Bier statt unphysiologischen ~T+2h. Spec §1.6.
- **Engine — Curve-Generation** — `getCurve()` nutzte `-offset` statt `0` als Drink-Age-Parameter, was alle Curve-Punkte auf T0 referenzierte (flat-zero-Curve). Curves zeigen jetzt korrekte zeitliche Variabilität.
- **Errors — DATABASE_CORRUPTED** — Build-Time-Bug behoben: Constant war im gebauten Binary nicht erreichbar (`ReferenceError`). Korruptes DB-File liefert jetzt sauberen JSON-Error mit Exit 3 und überschreibt das File nicht.
- **Errors — chrono-Validator** — Invalide Datumsstrings (`"2026-13-45"`, leerer String) wurden stumm akzeptiert. Vor-chrono-Validator wirft jetzt `BAD_TIME_FORMAT` (Exit 1).
- **Errors — SESSION_NOT_ACTIVE** — fehlender Import in `commands/compute.ts` ergänzt.
- **Schema — Listen-Output** — `drink list` returnt `{drinks, count}`, `session list` returnt `{sessions, count}` (vorher: `{items, count}`). Spec §0.4 v1.0.9.
- **Stats — Day-Bucketing** — Tag-Grenzen nach Berlin-Mitternacht statt UTC. Drinks ab 23:00 Berlin-Zeit landen im richtigen Tag. Spec §9.2.
- **Sessions — kein implizites Auto-Close beim `session start`** — `>1s`-Auto-Close-Drift zurückgerollt. Aktive Session + `session start` ohne `--force` → `SESSION_ALREADY_ACTIVE`. Spec §11.7.
- **Concurrency — `BEGIN IMMEDIATE` für Write-Transactions** — Race-Conditions zwischen Read- und Write-Phase eliminiert. 50× parallel `add` hält die Invariante `count(persisted) == count(Exit-0)`. Spec §12.5.
- **Time — `formatISOLocal()` Vorzeichen + Date-Annotation** — Lokale ISO-Timestamps in `status.now`, `sober_at`, `bac.at`, `curve[].at`, `curve.meta.from`/`to` zeigten falsches Offset-Vorzeichen (`-02:00` statt `+02:00`) und annotierten UTC-Zeit mit Lokal-Offset. Konsumenten die diese Felder parsten, erhielten 4 h verschobene Werte. Spec §4.2.

### Changed
- Spec v1.0.9: Sober-Approach-Bound auf T+24h korrigiert (§1.6); Auto-Close-Window referenziert immer Wall-Clock-Now, nie historische `--at` (§11.6); Listen-Schema entity-spezifisch (§0.4).
- npm package name from `liver` to `liver-cli` (`liver` already taken on registry).

### Documentation
- ADR-002: Engine-Modell-Choice für v0.1.x (lineares Absorptions-Modell, exponentielles ka deferred zu v0.2.0).

## [0.1.0] - 2026-04-28

### Added
- Initial release
- Basic CLI structure
