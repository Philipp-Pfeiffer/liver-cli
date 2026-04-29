# Spec-Coverage-Audit: liver v1.0.6

**Branch:** `audit/spec-coverage`  
**Datum:** 2026-04-29  
**Spec-Version:** v1.0.6 (Cleanup-Pass 6)  
**Audit-Ergebnis:** 27 ⚠️ / 12 ❌ / rest ✅

---

## §0.1 Command-Übersicht

| § | Sektion | Status | File:Line oder Notiz |
|---|---|---|---|
| 0.1 | `liver profile set --weight <kg> --height <cm> --sex <m\|f\|o> --age <int> [--formula <watson\|widmark>]` | ✅ implementiert | `src/index.ts:111-125` |
| 0.1 | `liver profile show` | ✅ implementiert | `src/index.ts:128-140` |
| 0.1 | `liver preset set <name> --vol <ml> --abv <pct>` | ⚠️ implementiert, aber spec-abweichend | `src/index.ts:146` heißt `preset save`, nicht `preset set` (v1.0.6 Änderung) |
| 0.1 | `liver preset list` | ✅ implementiert | `src/index.ts:160-169` |
| 0.1 | `liver preset show <name>` | ✅ implementiert | `src/index.ts:172-181` |
| 0.1 | `liver preset rm <name>` | ✅ implementiert | `src/index.ts:184-193` |
| 0.1 | `liver session start [--name <str>] [--stomach <empty\|some\|full>] [--at <T>]` | ✅ implementiert | `src/index.ts:199-218` |
| 0.1 | `liver session end [--at <T>]` | ✅ implementiert | `src/index.ts:221-232` |
| 0.1 | `liver session show [--id <id>]` | ✅ implementiert | `src/index.ts:235-253` |
| 0.1 | `liver session list [--year <YYYY> \| --month <YYYY-MM>]` | ✅ implementiert | `src/index.ts:256-267` |
| 0.1 | `liver session stomach <empty\|some\|full> [--at <T>]` | ✅ implementiert | `src/index.ts:270-281` |
| 0.1 | `liver session rename <id> --name <str>` | ❌ nicht implementiert | — |
| 0.1 | `liver add <preset> [--at <T>] [--duration <Xm\|Xh>] [--session new [--name <str>] [--stomach <state>]]` | ⚠️ implementiert, aber spec-abweichend | `src/index.ts:285-326`; `--session new` fehlt, `--stomach` fehlt |
| 0.1 | `liver add --vol <ml> --abv <pct> [--at <T>] [--duration <Xm\|Xh>] [--session new [...]]` | ⚠️ implementiert, aber spec-abweichend | `src/index.ts:285-326`; `--session new` fehlt, `--stomach` fehlt |
| 0.1 | `liver start <preset>` | ⚠️ implementiert, aber spec-abweichend | `src/index.ts:329-367`; `--at` fehlt, `--duration` fehlt, `--stomach` fehlt |
| 0.1 | `liver start --vol <ml> --abv <pct>` | ⚠️ implementiert, aber spec-abweichend | `src/index.ts:329-367`; `--at` fehlt, `--duration` fehlt, `--stomach` fehlt |
| 0.1 | `liver stop [--at <T>]` | ✅ implementiert | `src/index.ts:370-381` |
| 0.1 | `liver drink list` | ✅ implementiert | `src/index.ts:386-395` |
| 0.1 | `liver drink rm <id>` | ✅ implementiert | `src/index.ts:398-407` |
| 0.1 | `liver status` | ✅ implementiert | `src/index.ts:411-420` |
| 0.1 | `liver bac --at <T>` | ✅ implementiert | `src/index.ts:423-434` |
| 0.1 | `liver curve [--from <T>] [--to <T>] [--step <Xm>]` | ✅ implementiert | `src/index.ts:437-456` |
| 0.1 | `liver sober` | ✅ implementiert | `src/index.ts:459-468` |
| 0.1 | `liver stats [--month <YYYY-MM> \| --year <YYYY> \| --from <T> --to <T> \| --all]` | ✅ implementiert | `src/index.ts:471-494` |
| 0.1 | `liver config set <key> <value>` | ✅ implementiert | `src/index.ts:500-507` |
| 0.1 | `liver config get <key>` | ✅ implementiert | `src/index.ts:510-517` |
| 0.1 | `liver config list` | ✅ implementiert | `src/index.ts:520-527` |
| 0.1 | `liver export` | ❌ nicht implementiert | §14 Limitations: "Backup via cp" — aber Smoke-Test fordert es |
| 0.1 | `liver import` | ❌ nicht implementiert | §14 Limitations: "Backup via cp" — aber Smoke-Test fordert es |
| 0.1 | `liver db info` | ❌ nicht implementiert | — |
| 0.1 | `liver --version` | ✅ implementiert | `src/index.ts:22` |
| 0.1 | `liver --help` | ✅ implementiert | commander default |
| 0.1 | `liver <command> --help` | ✅ implementiert | commander default |

---

## §0.2 Globale Flags

| § | Sektion | Status | File:Line oder Notiz |
|---|---|---|---|
| 0.2 | `--human` | ✅ implementiert | `src/index.ts:23` |
| 0.2 | `--no-color` / `NO_COLOR=1` | ✅ implementiert | `src/index.ts:24`, `src/output/index.ts:13` |
| 0.2 | `--verbose` / `-v` | ✅ implementiert | `src/index.ts:25` |
| 0.2 | `--formula <watson\|widmark>` | ✅ implementiert | `src/index.ts:26` |

---

## §0.3 Behavior Rules

| § | Sektion | Status | File:Line oder Notiz |
|---|---|---|---|
| 0.3 | Nur EIN offener Drink; `--force` macht implizites `stop` | ✅ implementiert | `src/commands/drink.ts:118-128` |
| 0.3 | `add` während offenem Drink erlaubt | ✅ implementiert | `addDrink` prüft nicht auf laufenden Drink |
| 0.3 | Drink-ID-Output bei `add`/`start` | ✅ implementiert | `src/commands/drink.ts:87-96`, `src/commands/drink.ts:145-154` |
| 0.3 | Lowercase-Normalisierung für Preset-Namen | ✅ implementiert | `src/commands/preset.ts:19`, `src/commands/preset.ts:37` |
| 0.3 | Default-Zeit für `add`/`start`/`stop` = `now` | ✅ implementiert | `src/commands/drink.ts:60`, `src/commands/drink.ts:112`, `src/commands/drink.ts:162` |
| 0.3 | Volumen-Eingabe immer in Millilitern | ✅ implementiert | überall `volumeMl` |
| 0.3 | Nachträgliches Loggen via `--at <past>`; `TIMESTAMP_OUTSIDE_SESSION` | ✅ implementiert | `src/commands/drink.ts:64-67` |
| 0.3 | Mid-Session Stomach-Switch | ✅ implementiert | `src/commands/session.ts:134-161` |
| 0.3 | Stomach-Default bei `session start`: letzter bekannter State, sonst `some` | ⚠️ implementiert, aber spec-abweichend | `src/index.ts:202` hardcoded default `'some'`; prüft nicht letzten State |
| 0.3 | Session-Auto-End lazy on next command | ✅ implementiert | `src/commands/auto-close.ts:10-47` |
| 0.3 | Profile fehlt → `PROFILE_MISSING` | ✅ implementiert | `src/commands/compute.ts:51`, `src/commands/profile.ts:50-55` |
| 0.3 | Disclaimer in `status`/`bac`/`sober`/`curve` | ✅ implementiert | überall in `src/commands/compute.ts` |
| 0.3 | Config-Namespace: Dot-Notation `zones.*`, `engine.*` | ⚠️ implementiert, aber spec-abweichend | `src/config/index.ts:14-17` hat nur `zones.*`; `engine.default_formula` fehlt |
| 0.3 | Duration-Strictness: Unit-Suffix-Pflicht | ⚠️ implementiert, aber spec-abweichend | `src/time/index.ts:64-69`: `0` erlaubt, aber bare Number ohne Suffix → `INVALID_DURATION` ✅; jedoch wird Error als String geworfen, nicht als `LiverError` |
| 0.3 | Historical-Backfill: `--session new` für retroaktive Sessions | ❌ nicht implementiert | §5.3 v1.0.6; `src/commands/drink.ts:64-67` wirft immer `TIMESTAMP_OUTSIDE_SESSION` |

---

## §0.4 Output-Schemas

| § | Sektion | Status | File:Line oder Notiz |
|---|---|---|---|
| 0.4 | `add`/`start` Output-Schema (inkl. `bac_after_promille`) | ✅ implementiert | `src/commands/drink.ts:86-96`, `src/commands/drink.ts:145-154` |
| 0.4 | `status` Output-Schema | ✅ implementiert | `src/commands/compute.ts:85-99` |
| 0.4 | `bac --at <T>` Output-Schema | ✅ implementiert | `src/commands/compute.ts:139-146` |
| 0.4 | `sober` Output-Schema | ✅ implementiert | `src/commands/compute.ts:177-181` |
| 0.4 | `curve` Output-Schema (§10.4) | ✅ implementiert | `src/commands/compute.ts:254-263` |
| 0.4 | `stats` Output-Schema (§9.6) | ✅ implementiert | `src/commands/stats.ts:301-321` |
| 0.4 | Single-Object Reads (`profile show`, `preset show`, `session show`) | ✅ implementiert | spiegeln DB-Schema |
| 0.4 | Listen-Commands (`preset list`, `drink list`, `session list`) | ✅ implementiert | `{items, count}` |
| 0.4 | Mutator-Commands (`profile set`, `preset set`, `preset rm`, `session end`, `drink rm`, `config set`) | ⚠️ implementiert, aber spec-abweichend | `preset save` statt `preset set`; `preset rm` gibt `{ok, name}` statt `{ok, preset_id}` zurück (Spec sagt `"<entity>_id": <id>` bzw. `"name": <preset-name>` — beides akzeptabel?) |
| 0.4 | `stop` Output (`drink_id`, `finished_at`, `duration_secs`) | ✅ implementiert | `src/commands/drink.ts:179-183` |

---

## §1. Engine & WASM

| § | Sektion | Status | File:Line oder Notiz |
|---|---|---|---|
| 1.1 | ethanol-rs Vendoring | ❌ nicht implementiert | Kein `vendor/ethanol-rs/pkg/` vorhanden; stattdessen Stub in `src/engine/stub.ts` |
| 1.2 | Engine-Layer-Architektur (dünner Adapter) | ⚠️ implementiert, aber spec-abweichend | Stub statt echtem WASM; Interface existiert in `src/engine/index.ts` |
| 1.3 | Compute-Mapping (`calculate_bac_at_offset`, `minutes_until_sober`, `generate_curve`) | ⚠️ implementiert, aber spec-abweichend | Stub-Implementierung in `src/engine/stub.ts`; Watson vs Widmark liefert **identische Werte** (Stub ignoriert `formula` Parameter!) |
| 1.4 | Liver-Eigenleistung (Timestamp-Konverter, Sweet-Spot, Promille, ABV-Konversion, Stomach-Switching, Persistenz) | ✅ implementiert | `src/commands/compute.ts`, `src/config/index.ts` |
| 1.5 | Default-Formel Watson; `--formula` Override; `profile.preferred_formula` | ⚠️ implementiert, aber spec-abweichend | Override funktioniert, aber Engine liefert für beide Formeln gleiche Werte (Stub) |
| 1.5 | Sweet-Spot Defaults `min=0.4`, `max=0.8` | ✅ implementiert | `src/config/index.ts:74-75` |
| 1.5 | `bac_after_promille` = BAC jetzt nach Insert | ✅ implementiert | `src/commands/drink.ts:27-45` |

---

## §2. Output-Vertrag

| § | Sektion | Status | File:Line oder Notiz |
|---|---|---|---|
| 2.1 | stdout = JSON only; stderr = Logs | ✅ implementiert | `src/output/index.ts:40-55` |
| 2.2 | Default = JSON; `--human` opt-in | ✅ implementiert | `src/output/index.ts:40-46` |
| 2.3 | Logs off-by-default; `--verbose` opt-in | ✅ implementiert | `src/output/index.ts:28-31` |
| 2.4 | Color: TTY-Auto + `--no-color` + `NO_COLOR` | ✅ implementiert | `src/output/index.ts:13`, `src/output/index.ts:17-26` |
| 2.5 | `--human`: Zeitangaben `HH:MM` | ⚠️ implementiert, aber spec-abweichend | `src/output/index.ts:58-67` formatHuman ist generisch, nicht spezifisch für Zeit |

---

## §3. Error-Vertrag

| § | Sektion | Status | File:Line oder Notiz |
|---|---|---|---|
| 3.1 | Error-JSON-Format (`code`/`message`/`hint`/`context`) | ✅ implementiert | `src/errors/index.ts:5-44` |
| 3.2 | Exit-Codes (0/1/2/3/4) | ✅ implementiert | `src/errors/types.ts` |
| 3.3 | `PROFILE_MISSING` (Exit 1) | ✅ implementiert | `src/errors/index.ts:47-54` |
| 3.3 | `INVALID_WEIGHT` (Exit 1) | ✅ implementiert | `src/errors/index.ts:56-57` |
| 3.3 | `INVALID_HEIGHT` (Exit 1) | ✅ implementiert | `src/errors/index.ts:59-60` |
| 3.3 | `AGE_OUT_OF_RANGE` (Exit 1) | ✅ implementiert | `src/errors/index.ts:62-63` |
| 3.3 | `INVALID_SEX` (Exit 1) | ✅ implementiert | `src/errors/index.ts:65-66` |
| 3.3 | `INVALID_VOLUME` (Exit 1) | ✅ implementiert | `src/errors/index.ts:68-69` |
| 3.3 | `INVALID_ABV` (Exit 1) | ✅ implementiert | `src/errors/index.ts:71-72` |
| 3.3 | `INVALID_DURATION` (Exit 1) | ⚠️ implementiert, aber spec-abweichend | `src/time/index.ts:68` wirft String `'INVALID_DURATION'`, nicht `LiverError`. `src/index.ts:72-104` fängt es nicht als spezifischen Error ab → fällt durch zu `UNKNOWN_ERROR` (Exit 3) |
| 3.3 | `INVALID_TIME_ORDER` (Exit 1) | ❌ nicht implementiert | `src/commands/drink.ts:172-183` prüft nicht `finished_at < started_at` bei `stop --at <past>` |
| 3.3 | `INVALID_STOMACH_STATE` (Exit 1) | ✅ implementiert | `src/errors/index.ts:80-81` |
| 3.3 | `INVALID_PRESET_NAME` (Exit 1) | ✅ implementiert | `src/errors/index.ts:83-88` |
| 3.3 | `INVALID_SESSION_NAME` (Exit 1) | ✅ implementiert | `src/errors/index.ts:90-91` |
| 3.3 | `UNKNOWN_PRESET` (Exit 1) | ✅ implementiert | `src/errors/index.ts:93-94` |
| 3.3 | `BAD_TIME_FORMAT` (Exit 1) | ⚠️ implementiert, aber spec-abweichend | `src/time/index.ts:9` wirft String `'BAD_TIME_FORMAT'`, nicht `LiverError`. Fällt durch zu `UNKNOWN_ERROR` (Exit 3) |
| 3.3 | `CURVE_TOO_LARGE` (Exit 1) | ✅ implementiert | `src/errors/index.ts:99-105` |
| 3.3 | `SESSION_ALREADY_ACTIVE` (Exit 2) | ✅ implementiert | `src/errors/index.ts:108-109` |
| 3.3 | `SESSION_NOT_ACTIVE` (Exit 2) | ✅ implementiert | `src/errors/index.ts:111-112` |
| 3.3 | `DRINK_ALREADY_RUNNING` (Exit 2) | ✅ implementiert | `src/errors/index.ts:114-115` |
| 3.3 | `NO_DRINK_TO_STOP` (Exit 2) | ✅ implementiert | `src/errors/index.ts:117-118` |
| 3.3 | `TIMESTAMP_OUTSIDE_SESSION` (Exit 2) | ✅ implementiert | `src/errors/index.ts:120-121` |
| 3.3 | `DRINK_NOT_FOUND` (Exit 2) | ✅ implementiert | `src/errors/index.ts:123-124` |
| 3.3 | `WASM_LOAD_FAILED` (Exit 3) | ✅ implementiert | `src/errors/index.ts:127-128` (aber nie geworfen, da kein WASM) |
| 3.3 | `DB_LOCKED` (Exit 3) | ✅ implementiert | `src/errors/index.ts:130-131` (aber nie geworfen, da kein Retry-Logik) |
| 3.3 | `ENGINE_PANIC` (Exit 3) | ✅ implementiert | `src/errors/index.ts:133-134` |
| 3.3 | `SCHEMA_MIGRATION_FAILED` (Exit 3) | ✅ implementiert | `src/errors/index.ts:136-137` |
| 3.3 | `CONFIG_FILE_CORRUPT` (Exit 4) | ✅ implementiert | `src/errors/index.ts:140-141` |
| 3.3 | `INVALID_CONFIG_KEY` (Exit 4) | ✅ implementiert | `src/errors/index.ts:143-144` |

---

## §4. Time & Datums-Semantik

| § | Sektion | Status | File:Line oder Notiz |
|---|---|---|---|
| 4.1 | UTC ISO als TEXT in SQLite | ✅ implementiert | `src/time/index.ts:28-30` |
| 4.2 | Hardcoded `Europe/Berlin` für `--human` | ✅ implementiert | `src/time/index.ts:3` |
| 4.3 | chrono-node EN-Default | ✅ implementiert | `src/time/index.ts:5-6` |
| 4.4 | Default-Tag bei reiner Uhrzeit = letzter vergangener Match | ✅ implementiert | `src/time/index.ts:15-23` |
| 4.5 | DST: keine Sonderbehandlung | ✅ implementiert | Kein Code, nur Doku |

---

## §5. Stomach-Timeline-Resolver

| § | Sektion | Status | File:Line oder Notiz |
|---|---|---|---|
| 5.1 | Resolver-Algorithmus | ✅ implementiert | `src/commands/session.ts:163-184` |
| 5.2 | `session start --stomach X` schreibt Event bei `started_at` | ✅ implementiert | `src/commands/session.ts:62-84` |
| 5.2 | Tie-Breaker `at <= drink.started_at` | ✅ implementiert | `src/commands/session.ts:170` (`at <= ?`) |
| 5.2 | Determinismus bei identen `at` (`ORDER BY at DESC, rowid DESC`) | ✅ implementiert | `src/commands/session.ts:171` |
| 5.3 | Drink außerhalb Session → `TIMESTAMP_OUTSIDE_SESSION` | ✅ implementiert | `src/commands/drink.ts:64-67` |
| 5.3 | `--session new` für retroaktive Backfill-Sessions | ❌ nicht implementiert | v1.0.6 Neu; `add` hat kein `--session` Flag |
| 5.3 | `session stomach --at <T>` außerhalb Session → `TIMESTAMP_OUTSIDE_SESSION` | ✅ implementiert | `src/commands/session.ts:144-153` |

---

## §7. Datenbank

| § | Sektion | Status | File:Line oder Notiz |
|---|---|---|---|
| 7.1 | Plain SQL + better-sqlite3; Migrations | ✅ implementiert | `src/db/index.ts`, `src/db/migrate.ts` |
| 7.2 | `profile` Tabelle | ✅ implementiert | `src/db/migrations/001-init.sql` |
| 7.2 | `presets` Tabelle | ✅ implementiert | `src/db/migrations/001-init.sql` |
| 7.2 | `sessions` Tabelle | ✅ implementiert | `src/db/migrations/001-init.sql` |
| 7.2 | `stomach_events` Tabelle | ✅ implementiert | `src/db/migrations/001-init.sql` |
| 7.2 | `drinks` Tabelle | ✅ implementiert | `src/db/migrations/001-init.sql` |
| 7.2 | `config` Tabelle (Dot-Namespacing) | ⚠️ implementiert, aber spec-abweichend | `src/config/index.ts` nutzt Datei statt SQLite-Tabelle. Spec §7.2 zeigt `config` als DB-Tabelle, aber §1.2 erwähnt `~/.liver/config` Reader/Writer. Inkonsistenz in Spec. |
| 7.2 | Kanonische Keys: `zones.sweet_spot_min`, `zones.sweet_spot_max` | ✅ implementiert | `src/config/index.ts:14-16` |
| 7.2 | Kanonischer Key: `engine.default_formula` | ❌ nicht implementiert | `src/config/index.ts:14-17` hat nur `zones.*`; `engine.default_formula` fehlt |

---

## §8. Validierung

| § | Sektion | Status | File:Line oder Notiz |
|---|---|---|---|
| 8 | `weight_kg`: 30–250 → `INVALID_WEIGHT` | ✅ implementiert | `src/errors/validation.ts:14-16` |
| 8 | `height_cm`: 120–230 → `INVALID_HEIGHT` | ✅ implementiert | `src/errors/validation.ts:18-20` |
| 8 | `age`: 16–120 → `AGE_OUT_OF_RANGE` | ✅ implementiert | `src/errors/validation.ts:22-24` |
| 8 | `sex`: m/f/o → `INVALID_SEX` | ✅ implementiert | `src/errors/validation.ts:26-28` |
| 8 | `preferred_formula`: watson/widmark/NULL → `INVALID_CONFIG_KEY` | ⚠️ implementiert, aber spec-abweichend | `src/commands/profile.ts:32-34` wirft generischen Error `'INVALID_CONFIG_KEY'` (String), nicht `LiverError` |
| 8 | `volume_ml`: 0 < x ≤ 5000 → `INVALID_VOLUME` | ✅ implementiert | `src/errors/validation.ts:30-32` |
| 8 | `abv`: 0 < x ≤ 100 → `INVALID_ABV` | ✅ implementiert | `src/errors/validation.ts:34-36` |
| 8 | `duration`: 0 ≤ x ≤ 24h → `INVALID_DURATION` | ⚠️ implementiert, aber spec-abweichend | Range-Check ✅ in `src/errors/validation.ts:38-40`, aber Parser in `src/time/index.ts:64-69` wirft String-Error, nicht `LiverError`. Auch: bare Number ohne Suffix → `INVALID_DURATION` ✅ |
| 8 | `finished_at`: ≥ started_at → `INVALID_TIME_ORDER` | ❌ nicht implementiert | `src/commands/drink.ts:172-183` (stopDrink) prüft nicht diese Bedingung |
| 8 | `stomach_state`: empty/some/full → `INVALID_STOMACH_STATE` | ✅ implementiert | `src/errors/validation.ts:42-44` |
| 8 | `preset.name`: 1–32 Zeichen `[a-z0-9_-]` → `INVALID_PRESET_NAME` | ✅ implementiert | `src/errors/validation.ts:46-48` |
| 8 | `session.name`: 0–64 Zeichen → `INVALID_SESSION_NAME` | ✅ implementiert | `src/errors/validation.ts:50-52` |

---

## §9. Stats

| § | Sektion | Status | File:Line oder Notiz |
|---|---|---|---|
| 9.1 | Default-Zeitraum: letzte 30 Tage rollend | ✅ implementiert | `src/commands/stats.ts:197-201` |
| 9.1 | Overrides: `--month`, `--year`, `--from/--to`, `--all` | ✅ implementiert | `src/commands/stats.ts:175-201` |
| 9.2 | Day-Bucketing: `Europe/Berlin`-Mitternacht | ✅ implementiert | `src/commands/stats.ts:38-96` |
| 9.3 | `drinking_days` | ✅ implementiert | `src/commands/stats.ts:210` |
| 9.3 | `dry_days` | ✅ implementiert | `src/commands/stats.ts:212-213` |
| 9.3 | `longest_dry_streak` (all-time) | ✅ implementiert | `src/commands/stats.ts:238-247` |
| 9.3 | `current_dry_streak` (all-time) | ✅ implementiert | `src/commands/stats.ts:249-252` |
| 9.3 | `total_drinks` | ✅ implementiert | `src/commands/stats.ts:311` |
| 9.3 | `total_sessions` | ✅ implementiert | `src/commands/stats.ts:312` |
| 9.3 | `total_pure_alcohol_g` | ✅ implementiert | `src/commands/stats.ts:313` |
| 9.3 | `avg_peak_promille` (arithmetisches Mittel der Peaks) | ✅ implementiert | `src/commands/stats.ts:292-294` |
| 9.3 | `avg_session_promille` (time-weighted: Σ∫BAC dt / Σ Dauer) | ✅ implementiert | `src/commands/stats.ts:295-297` |
| 9.3 | `max_session_promille` (höchster Peak) | ✅ implementiert | `src/commands/stats.ts:298` |
| 9.3 | `by_preset` Aggregat | ✅ implementiert | `src/commands/stats.ts:317-320` |
| 9.4 | Empty-Range = Erfolg mit Nullen | ✅ implementiert | `src/commands/stats.ts:260-299` |

---

## §10. Curve

| § | Sektion | Status | File:Line oder Notiz |
|---|---|---|---|
| 10.1 | Command: `curve [--from <T>] [--to <T>] [--step <minutes>]` | ✅ implementiert | `src/index.ts:437-456` |
| 10.2 | Default `--from` = Session-Start | ✅ implementiert | `src/commands/compute.ts:206` |
| 10.2 | Default `--to` = `sober_at` | ✅ implementiert | `src/commands/compute.ts:208-219` |
| 10.2 | Default `--step` = 5 min | ✅ implementiert | `src/commands/compute.ts:221` |
| 10.2 | Ohne Session + ohne `--from`/`--to` → `SESSION_NOT_ACTIVE` | ✅ implementiert | `src/commands/compute.ts:194-198` |
| 10.3 | Hard-Cap 1000 Punkte → `CURVE_TOO_LARGE` | ✅ implementiert | `src/commands/compute.ts:226-231` |
| 10.3 | Step-Suggestion in Error | ✅ implementiert | `src/commands/compute.ts:228-230` |
| 10.4 | Output-Schema (`curve[]` + `meta`) | ✅ implementiert | `src/commands/compute.ts:254-263` |
| 10.4 | `bac_promille`: 2 Nachkommastellen | ✅ implementiert | `src/commands/compute.ts:249` |
| 10.4 | `zone`: sober/below_sweet_spot/sweet_spot/caution/danger | ✅ implementiert | `src/commands/compute.ts:39-45` |

---

## §11. Session-Lifecycle

| § | Sektion | Status | File:Line oder Notiz |
|---|---|---|---|
| 11.1 | Lazy on next command | ✅ implementiert | `src/index.ts:49` ruft `performAutoClose` in jedem Command |
| 11.2 | Threshold: `now ≥ last_drink.finished_at + minutes_until_sober × 60s` | ✅ implementiert | `src/commands/auto-close.ts:32-34` |
| 11.3 | `ended_at` = berechneter Sober-Zeitpunkt (nicht `now`) | ✅ implementiert | `src/commands/auto-close.ts:38` setzt `soberAt` |
| 11.4 | `auto_closed_session: <id>` im Output | ✅ implementiert | `src/index.ts:53-56` |
| 11.5 | Transactional | ✅ implementiert | `src/commands/auto-close.ts:37-42` |

---

## §12. Concurrency & DB-Locking

| § | Sektion | Status | File:Line oder Notiz |
|---|---|---|---|
| 12.1 | `PRAGMA journal_mode = WAL` | ✅ implementiert | `src/db/index.ts:16` |
| 12.1 | `PRAGMA synchronous = NORMAL` | ✅ implementiert | `src/db/index.ts:17` |
| 12.2 | `PRAGMA busy_timeout = 0` (kein Retry) | ✅ implementiert | `src/db/index.ts:18` |
| 12.2 | `DB_LOCKED` bei Lock-Konflikt | ❌ nicht implementiert | Nie geworfen; better-sqlite3 wirft eigenen Error |
| 12.3 | Migrations transactional | ✅ implementiert | `src/db/migrate.ts` |
| 12.3 | `session start --stomach X` transactional | ✅ implementiert | `src/commands/session.ts:62-84` |
| 12.3 | `session start --force` (close-old + open-new) transactional | ✅ implementiert | `src/commands/session.ts:62-84` |
| 12.3 | `drink rm` transactional (nur bei Cache-Update) | N/A | Kein Cache-Update implementiert, daher Single-Statement ✅ |
| 12.3 | Lazy-Auto-Close transactional | ✅ implementiert | `src/commands/auto-close.ts:37-42` |

---

## §13. Test-Coverage-Anforderungen

| § | Sektion | Status | File:Line oder Notiz |
|---|---|---|---|
| 13.2 | Golden-Fixture-Tests für JSON-Outputs | ⚠️ implementiert, aber spec-abweichend | `tests/integration/golden-fixtures.test.ts` prüft Schemata und Werte > 0, aber keine committed Fixtures |
| 13.2 | Auto-Close-Integration-Test | ✅ implementiert | `tests/integration/auto-close.test.ts` |
| 13.2 | Sex-Differenzierungs-Test | ✅ implementiert | `tests/integration/sex-differentiation.test.ts` |
| 13.2 | Day-Bucketing-Test | ✅ implementiert | `tests/integration/day-bucketing.test.ts` |
| 13.2 | Property-Round-Trip-Test für `config` | ✅ implementiert | `tests/integration/config-roundtrip.test.ts` |
| 13.2 | Command-Surface-Test | ✅ implementiert | `tests/integration/command-surface.test.ts` |
| 13.2 | Spec-Coverage-Mapping (Pflicht vor PR) | ✅ implementiert | Diese Datei |

---

## Zusammenfassung der Findings

### 🔴 P0 — Kritisch (12)

1. **`preset save` → `preset set`** (§0.1 v1.0.6) — Naming-Drift
2. **`--session new` an `add`** (§0.1, §5.3 v1.0.6) — Fehlendes Feature
3. **`--stomach` an `add` und `start`** (§0.1) — Fehlendes Flag
4. **`--at` und `--duration` an `start`** (§0.1) — Fehlendes Flag
5. **`liver session rename <id> --name <str>`** (§0.1) — Fehlender Command
6. **`liver db info`** (§0.1) — Fehlender Command
7. **Watson vs Widmark identisch** (§1.3, §1.5) — Engine-Switch unwirksam (Stub ignoriert `formula`)
8. **`INVALID_DURATION` als String-Error** (§3.3) — Fällt durch zu `UNKNOWN_ERROR` (Exit 3 statt 1)
9. **`BAD_TIME_FORMAT` als String-Error** (§3.3) — Fällt durch zu `UNKNOWN_ERROR` (Exit 3 statt 1)
10. **`INVALID_TIME_ORDER` fehlt** (§3.3, §8) — `stop --at <past>` prüft nicht `finished_at < started_at`
11. **`engine.default_formula` Config-Key fehlt** (§7.2 v1.0.6)
12. **`export`/`import` Commands** (§0.1, §14) — Smoke-Test fordert sie; Spec sagt Out-of-Scope. **Klärung nötig.**

### 🟠 P1 — Wichtig (10)

13. **`preferred_formula` Validation wirft String-Error** (§8) — Kein `LiverError`, fällt zu `UNKNOWN_ERROR`
14. **`--human` Zeit-Format nicht spezifisch** (§2.5) — Generische Formatierung statt `HH:MM`
15. **`stomach` Default bei `session start`** (§0.3) — Hardcoded `'some'` statt letzter bekannter State
16. **`listSessions` nutzt LIKE auf ISO-String** (§9.1) — Funktioniert nur für UTC-Präfixe; Berlin-Mitternacht-Grenzen nicht berücksichtigt
17. **Golden-Fixture-Tests ohne committed Fixtures** (§13.2) — Prüfen Werte > 0, aber kein Diff gegen Files
18. **`curve` Punktezahl-Formel** (§10.3) — `Math.ceil(totalMinutes / stepMinutes) + 1` sollte `floor((to-from)/step)+1` sein
19. **Config als Datei statt DB-Tabelle** (§7.2) — Spec zeigt `config` als DB-Tabelle, Implementation nutzt `~/.liver/config`
20. **`db info` Command** — Fehlend, aber nützlich für Debugging
21. **Preset-Mutator Output** (§0.4) — `preset rm` gibt `{ok, name}`; Spec erwähnt `{ok, <entity>_id}` — konsistent?
22. **`auto_close` läuft bei jedem Command** (§11.1) — Auch bei `profile show`? Spec sagt "State berührt"

### 🟡 P2 — Trivial (5)

23. **`listSessions` LIKE-Pattern** — Funktioniert für UTC, aber nicht für Berlin-Zeit
24. **`curve` Offset-Berechnung** — `offsetMinutes` in `getBACAt` nutzt `minutesBetween(at, nowUTC())` — könnte sign-Problem haben
25. **`formatISOLocal`** — Nutzt System-TZ statt hardcoded `Europe/Berlin` (§4.2)
26. **README fehlt Doku-Hinweis zu DST** (§4.5)
27. **Version in `package.json`** = `0.1.0`, Spec erwähnt v1.0.x

---

## Empfohlene Fix-Reihenfolge

1. **Error-Codes als `LiverError` werfen** (`INVALID_DURATION`, `BAD_TIME_FORMAT`, `INVALID_TIME_ORDER`)
2. **`preset save` → `preset set` umbenennen**
3. **Fehlende Flags hinzufügen** (`--stomach`, `--at`, `--duration` an `start`; `--session new` an `add`)
4. **Fehlende Commands hinzufügen** (`session rename`, `db info`)
5. **Engine-Formel-Unterscheidung implementieren** (Watson vs Widmark im Stub)
6. **Config-Key `engine.default_formula` hinzufügen**
7. **`INVALID_TIME_ORDER` bei `stop --at <past>` prüfen**
8. **`export`/`import` Klärung** — Implementieren oder in §14 bestätigen
9. **Golden-Fixtures committed machen**
10. **`stomach` Default aus letztem State lesen**
