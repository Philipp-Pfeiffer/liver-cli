# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-05-09

### Added
- β default now sex- and age-aware (Barinskaia 2009, Dettling 2007, Maskell 2024)
- Fed-state β-multiplier ×1.20/×1.40 for stomach=some/full (Jones 1994)
- Confidence intervals (95% KI) on all BAC outputs (Maskell & Cooper 2020)
- New profile field: weight_source (measured|estimated)
- New acceptance scenario for age 21 reference (§1.6)

### Changed
- Stomach factor "some" documented at 0.80 in TS layer (conservative interpolation between empty=1.00 and full=0.65; Jones 1994 only validated full=0.64). **Absorption-side application deferred until WASM rebuild — see ADR-005 / v0.4.0+.** No runtime behavior change from this entry alone.

## [0.2.1] - 2026-05-08

### Fixed
- **BUILD-1**: `vendor/` directory now included in npm package `files` array.
- **VERSION-1**: Version bumped from non-SemVer `0.2.0.1` to SemVer-compliant `0.2.1`.
- **TEST-1**: Integration tests now assert concrete BAC ranges instead of degenerate `≥ 0` checks.
- **TIME-1**: Timezone handling is now consistently `Europe/Berlin` everywhere. Naive timestamps without explicit timezone are interpreted as Europe/Berlin time.
- **TIME-2**: DST edge-cases (non-existent times like 2026-03-29T02:30) are now rejected with a clear error message.
- **AUTO-CLOSE-1**: `performAutoClose` now respects open drinks — sessions with an unfinished drink are never auto-closed.
- **TEST-2**: D8 auto-close test is now deterministic (no more timing-dependent flakiness).
- **CODE-1**: `peak.ts` now uses `nowUTC()` instead of `new Date()` for consistency.
- **CODE-2**: Removed stale TODO marker from `types.ts`.

### Fixed (from v0.2.0)
- **BAC Calculation — Factor-10 Overestimation** — `calculateBACAtOffset` already returned promille, but callers in `compute.ts`, `drink.ts`, `stats.ts`, and `peak.ts` multiplied by 10 again. Removed double multiplication. 500 ml × 2.5 % now peaks at ~0.12 ‰ instead of ~1.15 ‰.
- **Timezone Consistency — `bac` vs `curve`** — `getBACAt` and `getCurve` now both use `nowUTC()` as reference for `drinksToEngine` and pass `offsetMinutes = (targetTime - now) / 60000` to `calculateBACAtOffset`. Both commands produce identical BAC values (±0.001 ‰) for the same wall-clock point.
- **Auto-Close — Immediate Close after `add` without `--duration`** — `performAutoClose` now enforces a grace period starting at `max(finished_at, started_at + 15 min)`. Prevents sessions from closing immediately after a bolus drink because `minutesUntilSober` can be 0 before absorption begins.

### Added
- `tests/acceptance/plausibility.test.ts` — Suite C with hard acceptance bands for standard drinks (Bier 500 ml, Spirit 40 ml, Wein 200 ml, Colabier 500 ml, Big Beer 1000 ml). Catches factor-5+ BAC bugs.
- `npm run test:plausibility` script and CI gate.

## [0.2.0] - 2026-05-07

> **KNOWN ISSUES (fixed in v0.2.0.1):**
> - **Bug 1:** BAC values overestimated by factor ~5–10× due to double `* 10` conversion in `compute.ts`, `drink.ts`, `stats.ts`, `peak.ts`.
> - **Bug 2:** `liver add` without `--duration` triggers immediate session auto-close because `finished_at = started_at` and `minutesUntilSober` is 0 before absorption starts.
> - **Bug 3:** `liver bac --at` and `liver curve` use different time-reference logic, causing inconsistent BAC values for the same timestamp.

### Added
- **SVG export for `liver curve`** — neuer `--export svg` Flag emittiert den BAC-Verlauf als standalone SVG-XML zu stdout. Output enthält:
  - BAC-Kurve über die Zeit (blau)
  - Sweet-Spot- / Caution- / Danger-Zonen als Hintergrund-Bands
  - Drink-Marker an `started_at` jedes Drinks (gestrichelte Linien + Labels)
  - Peak-Annotation (roter Punkt + Wert), X/Y-Achsen, Legend, Disclaimer
  - Curve-Cap §10.3 gilt unverändert (`CURVE_TOO_LARGE` bei >1000 Punkten)
  - Beispiel: `liver curve --export svg > curve.svg`. Siehe README "SVG Export" und `docs/samples/curve-example.svg`.
- **Phase 3: Active Drink Features** — Volume-Duration-Tabelle, Single-Open-Drink-Rule, `liver drink update`, Peak-Time via Curve-Sampling
- `src/lib/duration.ts` — `VOLUME_DURATION_TABLE` mit 7 Buckets (Shot→Maß+) und `resolveDefaultDuration(volumeMl, config)`
- `src/engine/peak.ts` — `projectedPeakFromCurve()` nutzt `generateCurve` mit 60s-Schritten für numerische Peak-Suche
- `src/commands/drink.ts` — neuer `updateDrink()` Command: `liver drink update --id <ID> [--duration <D>] [--finished-at <T>]`
- Neue Response-Felder in `add`/`start`/`stop`:
  - `bac_before_promille` — BAC vor dem neuen Drink
  - `bac_projected_peak_promille` — projizierter Peak-BAC
  - `bac_projected_peak_at` — ISO-Timestamp des Peaks
  - `bac_at_stop_promille` — BAC zum Stop-Zeitpunkt (nur `stop`)
  - `drink_in_progress` — boolean Open-State
  - `projection_basis` — `"planned_duration"` | `"volume_default"` | `"finalized"`
  - `default_duration_source` — `"config_override"` | `"volume_table"` | `"fallback_20min"`
  - `absorbing_drinks` — Anzahl Drinks in Resorption (via ethanol-rs)
  - `trajectory` — `"rising"` | `"falling"` | `"stable"` (via ethanol-rs)
- **Single-Open-Drink-Rule** — Zweites `start` ohne `stop` wirft `E_DRINK_ALREADY_OPEN`. Mit `--force` wird alter Drink force-closed.
- **Auto-Close-Detection** — `status` listet Drinks als `auto_closed_drinks`, wenn `now > finished_at + grace` (default 15min, config-überschreibbar)
- Config-Keys: `default_duration_minutes`, `auto_close_grace_minutes`, `[duration_table]` TOML-Section
- `MIGRATION-v0.2.0.md` — Mapping-Tabelle alt → neue Felder
- Tests: `tests/unit/duration.test.ts`, `tests/unit/peak.test.ts`, `tests/unit/auto-close.test.ts`, `tests/unit/single-open-drink.test.ts`, `tests/unit/drink-update.test.ts`, `tests/acceptance/active-drink.test.ts` (D1–D10)

### Changed
- **Engine — Migration zu ethanol-rs (WASM)** — TS-Engine durch ethanol-rs WASM ersetzt. First-Order-Kinetics (ka-Modell) statt linearer Absorption. Peak-Timing physiologisch korrekt (T+15-45min). Bioavailability asymptotisch 100%.
- Vendoring: ethanol-rs @ `0818749` als git submodule, WASM-Build committed in `vendor/ethanol-rs/pkg/`
- Build-Toolchain: `wasm-pack@0.13.1`, Rust target `wasm32-unknown-unknown`
- `startDrink` ohne `--duration` nutzt jetzt volume-basierte Default-Duration statt `finished_at = NULL`
- `bac_after_promille` ist deprecated (Alias für `bac_projected_peak_promille`), entfernt in v0.3.0

### Fixed
- `src/commands/stats.ts` — `generateSessionCurve` nutzte `-offset` statt `0`, was alle Curve-Punkte auf T0 referenzierte. Jetzt korrekte zeitliche Variabilität.
- BAC-drop during active absorption (Bug Session 6) — durch volume-basierte Duration + Peak-Projection gefixt

### Engineering
- `STOMACH_MAP`, `SEX_MAP`, `KA_BY_STOMACH` in `src/engine/types.ts`
- `initWasm()` wird in `src/engine/index.ts` beim Import aufgerufen
- Config-Helper (`getConfig`, `setConfig`, `getSweetSpotDefaults`) akzeptieren optional `db`-Parameter für Transaktions-Sicherheit

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
