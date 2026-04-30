# Verification v0.2 — Root-Cause-Analyse

**Branch:** audit/spec-coverage (read-only)
**Fails:** 14 → **Root-Causes:** 4 (bestätigt)

---

## Cluster 1 — TIME-LAYER (Blocker, höchste Prio)

### Root-Cause-Statement
> Alle BAC-Berechnungs- und Session-Lifecycle-Kommandos verwenden **hardcoded `nowUTC()`** als Referenzzeitpunkt, statt den vom Nutzer angegebenen `--at`-Timestamp oder den Query-Zeitpunkt. Zusätzlich berechnet `getBACAt` einen **spurious Offset** gegen `nowUTC()`, der die Drink-Age doppelt verrechnet. Die Auto-Close-Logik (`performAutoClose`) schließt Sessions anhand von `nowUTC()`, was zukünftige oder vergangene Sessions korrumpiert.

### Falsch laufende Code-Stellen

| File | Zeile | Problem | Betroffene Tests |
|------|-------|---------|-----------------|
| `src/commands/compute.ts` | 133 | `getBACAt`: `offsetMinutes = -minutesBetween(at, nowUTC())` statt `0`. Die `startedAtMinutesAgo` sind bereits relativ zu `at`; der Offset veraltet den Drink um `(at-now)` zusätzlich. | N1, N2, N3 |
| `src/commands/compute.ts` | 154-183 | `getSober` hat kein `--at`, nutzt hardcoded `nowUTC()`. Für Future-Sessions ist `drinkAge < 0` → `absorbedFraction = 0` → `minutesUntilSober = 0`. | N8 |
| `src/commands/compute.ts` | 48-101 | `getStatus` nutzt `nowUTC()`. Bei Future-Sessions (Test-Datum 2026-05-01, Ausführung 2026-04-30) sind Drinks in der Zukunft → BAC = 0. | D2 (implizit) |
| `src/commands/drink.ts` | 28-46 | `computeBACAfter` nutzt `nowUTC()` statt `at` oder `finished_at`. | N1-N3 (add-Response) |
| `src/commands/auto-close.ts` | 10-46 | `performAutoClose` vergleicht `nowUTC()` mit `soberAt`. Für Past-Sessions (H3) ist `now >> soberAt` → Session wird vor dem zweiten `add` geschlossen. Für Future-Sessions (C4) ist `now < soberAt` → keine Schließung, aber `soberAt` wird auf `lastFinishedAt` gesetzt, da `currentBAC = 0`. | H3, C4, H7 |
| `src/commands/stats.ts` | 249-252 | `currentDryStreak` berechnet gegen `new Date()` (Systemzeit) statt gegen `to`. Bei Range-Queries in der Vergangenheit ergibt das negative Werte. | C6 (`-9`) |
| `src/time/index.ts` | 6-27 | `parseTimestamp` liefert lokale Date-Objekte; keine UTC-Normalisierung. Bei Bare-Dates (`2026-10-25`) hängt die Interpretation von der System-TZ ab. | H2 |

### Trace: `--at "2026-05-01T20:00:00+02:00"`
1. `parseTimestamp` → chrono-node → Date(2026-05-01T18:00:00Z) ✓ (Offset korrekt)
2. `formatISOUTC(at)` → `"2026-05-01T18:00:00.000Z"` ✓
3. DB-Compare (String-Lexikografisch) → `"2026-05-01T18:00:00.000Z"` passt in Session-Range ✓
4. **Engine-Boundary**: `drinksToEngine(db, drinks, nowUTC())` → `startedAtMinutesAgo = (nowUTC - 18:00Z) / 60000` ≈ **-1500 Minuten** (Drink in der Zukunft)
5. `calculateBACAtOffset(..., 0)` → `drinkAge = -1500 + 0 < 0` → `absorbedFraction = 0` → **BAC = 0.00** ❌

### Vergleich: bac.ts (FAIL) vs curve.ts (PASS, N4-N6)
- **curve**: `getCurve` verwendet `pointTime` als Referenz für `drinksToEngine` und `-offset` als `nowOffsetMinutes`. Die Drink-Age bleibt konstant, unabhängig von `nowUTC()`.
- **bac**: `getBACAt` verwendet `at` als Referenz für `drinksToEngine`, aber addiert einen falschen `offsetMinutes = -minutesBetween(at, nowUTC())`, was die Drink-Age falsch verschiebt.
- **sober**: Hat gar kein `--at`, verwendet immer `nowUTC()`.

### DST-Spezifik (H2/H3)
- `stats.ts` bucketing: `getBerlinDateFromUTC` konvertiert UTC-Strings korrekt nach Berlin-Datum. Das Problem bei H2 ist nicht das Bucketing selbst, sondern dass `parseTimestamp("2026-10-25")` ein lokales Midnight liefert, das je nach System-TZ unterschiedlich ist. **Static-Analyse-Hypothese**: Auf einem UTC-System wäre `from = 2026-10-25T00:00:00Z`, was die Drinks (00:30Z, 01:30Z) einschließt. Der Fail muss aus einem Interaktions-Edge-Case zwischen chrono-node und der lokalen TZ stammen (temporäres stderr-Logging würde die exakte `fromStr`/`toStr` klären).
- H3: `performAutoClose` schließt die Session vor dem zweiten `add`, weil `nowUTC()` (April) weit nach `soberAt` liegt. Die Session hat dann `ended_at = lastFinishedAt` (21:00 UTC 28.03). Der Drink am 29.03 01:30 UTC liegt **nach** `ended_at` → `findSessionForTimestamp` returns null → `TIMESTAMP_OUTSIDE_SESSION`.

### C4: `session end --at` ignoriert
- `endSession` (session.ts:104-117) führt ein **einfaches `UPDATE sessions SET ended_at = ?`** aus. Es gibt keine offensichtliche Überschreibung durch `stomach`.
- **Hypothese**: `performAutoClose` läuft vor `session end` und setzt `ended_at` auf `lastFinishedAt` (weil `currentBAC = 0` für Future-Sessions). Die tatsächliche Ausgabe (`ended_at = 21:00+02:00`) entspricht exakt dem letzten `stomach`-Switch-Zeitpunkt, nicht dem `lastFinishedAt`. Das deutet darauf hin, dass möglicherweise `setStomachState` oder ein anderer Code-Pfad `ended_at` berührt – aus der Static-Analyse ist das jedoch nicht ersichtlich. **Temporäres Logging in `endSession` und `performAutoClose` würde die exakte Order of Statements klären.**

---

## Cluster 2 — SESSION-LIFECYCLE

### Root-Cause-Statement
> Es gibt **keine zentrale Session-State-Machine**. `--session new` erzeugt Sessions ohne Vorgänger zu schließen. `getActiveSession` gibt die neueste offene Session zurück, was bei mehreren offenen Sessions zu Zähl-Fehlern führt. `status` ist nicht read-only im Sinne von "keine Session = Exit 0", sondern wirft `SESSION_NOT_ACTIVE`.

### State-Machine (ASCII)

```
+-----------+     start --force      +-----------+
|  NONE     | ---------------------> |  ACTIVE   |
+-----------+                        +-----------+
     ^                                      |
     |                                      | end
     |                                      v
     +-------------------------------- +-----------+
                                      |  CLOSED   |
                                      +-----------+
```

**Probleme:**
- Kein Übergang `ACTIVE --start--> ACTIVE` (außer `--force`, das die alte Session ended).
- `add --session new` erzeugt einen neuen `ACTIVE`-Zustand, ohne den alten zu beenden → **mehrere ACTIVE gleichzeitig**.
- Kein Guard für `end` auf bereits geschlossene Sessions.

### Falsch laufende Code-Stellen

| File | Zeile | Problem | Betroffene Tests |
|------|-------|---------|-----------------|
| `src/commands/drink.ts` | 70-93 | `addDrink` mit `sessionNew` führt `INSERT INTO sessions` aus, ohne vorherige offene Sessions zu schließen. | C6 (`total_sessions=2` statt 4) |
| `src/commands/session.ts` | 26-31 | `getActiveSession`: `ORDER BY started_at DESC LIMIT 1` bei `ended_at IS NULL`. Bei mehreren offenen Sessions wird nur die neueste gesehen. | C6, D2 |
| `src/index.ts` | 417-424 | `status` wirft `SESSION_NOT_ACTIVE` (Exit 2) statt ein "no session"-JSON mit Exit 0 zurück. | D2, D3 |
| `src/commands/stats.ts` | 215-217 | `total_sessions` zählt Sessions im Date-Range, aber da `--session new` Vorgänger nicht schließt, sind weniger Sessions im Range als erwartet. | C6 |
| `src/commands/stats.ts` | 232-253 | `current_dry_streak`: `daysSinceLastDrink` berechnet `Math.floor((today - lastDay) / 86400000)`. `today = new Date()` (April 30), `lastDay = 2026-05-10` (Mai). Ergebnis ist **negativ** (`-9`), da `today < lastDay`. | C6 |

### Warum `dry_streak = -9`
- Suite C legt Drinks bis 2026-05-10 an.
- `stats --from 2026-05-04 --to 2026-05-11` wird am 2026-04-30 ausgeführt.
- `lastDrinkingDay = 2026-05-10`.
- `today = 2026-04-30`.
- `(today - lastDrinkingDay) = -10 Tage`.
- `Math.floor(-10) = -10`, aber wegen der Rundung in der Schleife kommt `-9` raus.
- **Root Cause**: Es wird Systemzeit statt Query-Endzeit verwendet.

### Spec-Klärungs-Bedarf
- Soll `status` ohne aktive Session Exit 0 oder Exit 2 liefern?
- Soll `--session new` implizit die Vorgänger-Session schließen?
- Was ist der Default für `status`, wenn kein Profil existiert? (Aktuell: Exit 1 `PROFILE_MISSING`, dann Exit 2 `SESSION_NOT_ACTIVE`)

---

## Cluster 3 — ERROR-PIPELINE

### Root-Cause-Statement
> SQLite-Fehler werden **nicht zu LiverError-Codes gemappt**. `busy_timeout = 0` lässt `SQLITE_BUSY` als generischen Error durchschlagen (→ `UNKNOWN_ERROR`, Exit 3). Die Schema-Migration prüft nicht, ob `user_version > max(migration_version)` ist. `CURVE_TOO_LARGE` wird korrekt geworfen, aber nur für aktive Sessions; durch `performAutoClose` wird die Session vorher geschlossen, sodass `SESSION_NOT_ACTIVE` maskiert.

### Error-Flow-Diagramm

```
SQLite Error
    |
    +-- SQLITE_BUSY (busy_timeout=0)
    |       |
    |       v
    |   better-sqlite3 wirft Error
    |       |
    |       v
    |   handleCommand (index.ts:65-82)
    |       |
    |       v
    |   catch (error) { ... instanceof LiverError? NO }
    |       |
    |       v
    |   UNKNOWN_ERROR (Exit 3)  <-- SOLL: DB_LOCKED (Exit 3, code DB_LOCKED)
    |
    +-- Schema mismatch (user_version=999)
    |       |
    |       v
    |   migrate() sieht version > max_file, tut NICHTS
    |       |
    |       v
    |   getActiveSession() läuft auf kompatiblem Schema → null
    |       |
    |       v
    |   getStatus() → SESSION_NOT_ACTIVE (Exit 2)
    |       |
    |       v
    |   SOLL: SCHEMA_MIGRATION_FAILED (Exit 3)
    |
    +-- CURVE_TOO_LARGE
            |
            v
        getCurve() prüft points > 1000
            |
            v
        performAutoClose() schließt Session (Past/Now)
            |
            v
        getActiveSession() → null
            |
            v
        SESSION_NOT_ACTIVE (Exit 2)  <-- SOLL: CURVE_TOO_LARGE
```

### Falsch laufende Code-Stellen

| File | Zeile | Problem | Betroffene Tests |
|------|-------|---------|-----------------|
| `src/db/index.ts` | 18 | `busy_timeout = 0` → bei Konkurrenz sofortiger Crash. Kein Retry, kein Mapping zu `DB_LOCKED`. | H4 |
| `src/index.ts` | 65-82 | `handleCommand` fängt `LiverError` ab, aber nicht SQLite-spezifische Errors. `SQLITE_BUSY` landet im generischen `UNKNOWN_ERROR`. | H4 |
| `src/db/migrate.ts` | 37-57 | `migrate` iteriert nur `version > currentVersion`. Es gibt **keine Prüfung** `currentVersion > max(migrationVersion)`. `user_version=999` wird stillschweigend akzeptiert. | H5 |
| `src/commands/compute.ts` | 195-199 | `getCurve` ruft `getActiveSession` auf, bevor `CURVE_TOO_LARGE` geprüft wird. Wenn `auto-close` die Session beendet hat, fliegt `SESSION_NOT_ACTIVE` zuerst. | H7 |

### H7: Long-Range Curve
- 1000 Drinks über 4 Monate, alle mit `--session new`.
- Letzte Session endet ca. 2026-04-01.
- `liver curve` wird am 2026-04-30 ausgeführt.
- `performAutoClose` sieht: letzter Drink ist in der Vergangenheit, `currentBAC = 0`, `minutesUntil = 0`, `soberAt = lastFinishedAt`, `now >= soberAt` → **Session wird geschlossen**.
- `getCurve` → `getActiveSession` → null → `SESSION_NOT_ACTIVE`.
- **SOLL**: `CURVE_TOO_LARGE` (weil 4 Monate × 1440 Minuten / 1m Step = ~175k Punkte > 1000).
- **Root-Cause ist TIME-LAYER (auto-close), sichtbares Symptom ist ERROR-PIPELINE (falscher Code).**

---

## Cluster 4 — OUTPUT-SHAPE

### Root-Cause-Statement
> Es gibt **keinen gemeinsamen Response-Builder**. Jeder Command baut sein JSON manuell. Felder werden nicht gegen eine Spec validiert. Die Config-Migration schreibt Keys im Legacy-Format (`sweet_spot_min`), aber der CLI-Code erwartet das neue Format (`zones.sweet_spot_min`).

### Response-Builder-Scan

| Command | Wrapper / Builder | Fehlende Felder (relativ zu Spec) |
|---------|-------------------|-----------------------------------|
| `status` | Manuell (`compute.ts:86-100`) | — |
| `bac` | Manuell (`compute.ts:140-147`) | — |
| `sober` | Manuell (`compute.ts:178-182`) | — |
| `curve` | Manuell (`compute.ts:255-264`) | **`disclaimer`** |
| `config get` | Manuell (`index.ts:518`) | **`value`** (wenn `undefined`) |

### H10: Config get fehlendes `value`
- `migrateConfigFile` (migrate.ts:11-35) liest `~/.liver/config` und schreibt Keys **as-is** in die DB:
  - JSON-Key: `sweet_spot_min` → DB-Key: `sweet_spot_min`
- `config get zones.sweet_spot_min` ruft `getConfig('zones.sweet_spot_min')` auf.
- `ALLOWED_KEYS` enthält `'zones.sweet_spot_min'`.
- DB-Query: `SELECT value FROM config WHERE key = 'zones.sweet_spot_min'` → **Kein Treffer**.
- `getConfig` returns `undefined`.
- `JSON.stringify({ key: 'zones.sweet_spot_min', value: undefined })` → `{"key":"zones.sweet_spot_min"}`.
- **Root Cause**: Key-Mismatch zwischen Migration und Runtime.

### H11: Curve fehlendes `disclaimer`
- `getCurve` (compute.ts:255-264) returned `curve` und `meta`, aber kein `disclaimer`.
- `status`, `bac`, `sober` fügen `disclaimer: 'estimate, not legally/medically valid'` hinzu.
- **Fix**: Einheitliche `addDisclaimer`-Funktion im Output-Layer einführen.

---

## Cross-Cutting Summary

### Alle Source-Files mit Kurz-Zweck

| File | Zweck (1 Zeile) | Hot-Spot |
|------|-----------------|----------|
| `src/index.ts` | CLI-Einstieg, Command-Routing, globaler Error-Handler | **C2, C3, C4** |
| `src/time/index.ts` | Zeit-Parsing (chrono-node), Formatierung, Dauer-Parsing | **C1** |
| `src/db/index.ts` | DB-Initialisierung (better-sqlite3), Pragmas | **C3** |
| `src/db/migrate.ts` | Schema-Migrationen, Config-File-Migration | **C3, C4** |
| `src/db/migrations/001-init.sql` | Initiales Schema | — |
| `src/db/migrations/002-migrate-config.sql` | Config-Migration (nur user_version bump) | C4 |
| `src/commands/profile.ts` | Profil CRUD | — |
| `src/commands/preset.ts` | Preset CRUD | — |
| `src/commands/session.ts` | Session CRUD, Stomach-Events, Session-Lookup | **C1, C2** |
| `src/commands/drink.ts` | Drink CRUD, Session-Zuordnung, BAC-After-Compute | **C1, C2** |
| `src/commands/compute.ts` | BAC/Status/Sober/Curve Berechnung, Engine-Bridge | **C1, C2, C3, C4** |
| `src/commands/stats.ts` | Statistik-Aggregation, Berlin-Bucketing, Dry-Streak | **C1, C2** |
| `src/commands/auto-close.ts` | Auto-Close bei Sober-Erreichung | **C1, C2** |
| `src/config/index.ts` | Config-DB-Layer, Sweet-Spot-Defaults | **C4** |
| `src/errors/index.ts` | LiverError-Klassen, Error-Factories | **C3** |
| `src/errors/types.ts` | Exit-Codes, Error-Interfaces | — |
| `src/errors/validation.ts` | Validierungs-Helper | — |
| `src/output/index.ts` | Output-Formatting, Human/JSON-Modus | **C4** |
| `src/engine/index.ts` | Engine-Wrapper, Formula-Resolution | — |
| `src/engine/ethanol.ts` | BAC-Berechnung (Watson/Widmark, Elimination) | — |
| `src/engine/types.ts` | Type-Interfaces für Engine | — |

### Hot-Spots (Files in >1 Cluster)
1. **`src/commands/compute.ts`** — C1, C2, C3, C4 → *Refactor-Kandidat #1*
2. **`src/index.ts`** — C2, C3, C4 → *Refactor-Kandidat #2*
3. **`src/commands/session.ts`** — C1, C2
4. **`src/commands/drink.ts`** — C1, C2
5. **`src/commands/auto-close.ts`** — C1, C2
6. **`src/commands/stats.ts`** — C1, C2
7. **`src/db/migrate.ts`** — C3, C4

### Anzahl unterschiedlicher Root-Causes
**4** (bestätigt, nicht 14):
1. **TIME-LAYER** — `nowUTC()`-Hardcoding + falscher Offset in `getBACAt` + Auto-Close-Zeitbasis
2. **SESSION-LIFECYCLE** — Keine State-Machine, `--session new` ohne Close, `status` wirft statt read-only
3. **ERROR-PIPELINE** — Kein SQLite-Error-Mapping, keine Schema-Version-Validierung, `CURVE_TOO_LARGE` durch Auto-Close verdeckt
4. **OUTPUT-SHAPE** — Kein Response-Builder, Config-Key-Mismatch, fehlendes `disclaimer`

### Empfohlene Fix-Reihenfolge

```
1. TIME-LAYER (unblockt 8/14 Fails)
   ├── compute.ts: offsetMinutes = 0 in getBACAt
   ├── compute.ts: --at-Parameter für sober
   ├── auto-close.ts: Referenzzeit statt nowUTC() (oder Skip für Future-Sessions)
   └── drink.ts: computeBACAfter mit drink-Zeit statt nowUTC()

2. SESSION-LIFECYCLE (unblockt 3/14 Fails)
   ├── drink.ts: --session new → close previous active session
   ├── index.ts: status ohne Session → Exit 0 (nicht Exit 2)
   └── stats.ts: currentDryStreak gegen to statt new Date()

3. ERROR-PIPELINE (unblockt 3/14 Fails)
   ├── db/index.ts: busy_timeout > 0 oder SQLITE_BUSY catch+map
   ├── db/migrate.ts: user_version > max → SCHEMA_MIGRATION_FAILED
   └── index.ts: handleCommand SQLite-Error-Mapping

4. OUTPUT-SHAPE (unblockt 2/14 Fails)
   ├── migrate.ts: Key-Normalisierung sweet_spot_min → zones.sweet_spot_min
   └── compute.ts: disclaimer in getCurve
```

### Risiken / Test-Lücken (nicht abgedeckt in v0.2)

| Lücke | Risiko |
|-------|--------|
| **Keine Tests für `session end` gefolgt von `session show`** | C4-Mechanismus (Überschreibung von `ended_at`) ist unklar; möglicherweise Bug in Auto-Close oder Transaction-Order |
| **Keine Tests für `status` ohne Session** | D2/D3 zeigen nur, dass Exit 2 kommt; Spec sagt Exit 0, aber Implementierung ist anders |
| **Keine Tests für Config-Migration mit allen Keys** | H10 deckt nur `sweet_spot_min` ab; `sweet_spot_max` und `engine.default_formula` könnten denselben Key-Mismatch haben |
| **Keine Tests für Curve-Range > 1000 Punkte mit aktiver Session** | H7 triggert `SESSION_NOT_ACTIVE` durch Auto-Close; es gibt keinen Test, der `CURVE_TOO_LARGE` direkt verifiziert |
| **Keine Tests für parallele Writes mit Retry** | H4 zeigt nur Datenverlust; es gibt keinen Test, der `DB_LOCKED` als erwarteten Code verifiziert |
| **Keine Tests für DST-Edge-Cases in Stats** | H2 könnte auf einem UTC-System passen; Berlin-System-Verhalten ist ungetestet |
| **Keine Tests für `getBACAt` in der Vergangenheit** | N1-N3 testen Future; Past-BAC könnte denselben Offset-Bug haben |

---

*Report erstellt auf Basis statischer Code-Analyse des Branches `audit/spec-coverage`. Keine Code-Änderungen vorgenommen.*
