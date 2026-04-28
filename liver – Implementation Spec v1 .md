# liver – Implementation Spec v1.0

<aside>
✅

**Spec Closed v1.0.4.** 9 Batches abgeschlossen (B1–B7 + M1–M9 + Y1–Y7) + 4 Cleanup-Passes (Tabellen-Render, Bug-Fixes, Pharma-Konvention, Command-Reference). Bereit für Coding-Agent-Hand-Off.
**Source-of-Truth-Hierarchie:** Diese Spec ist normativ. [ADR-001: liver – Architecture & Spec](https://www.notion.so/ADR-001-liver-Architecture-Spec-160a90b88e63445d9850d882db12a45f?pvs=21) liefert Architektur-Rationale; bei Widerspruch zwischen beiden Dokumenten gilt **diese Spec**.

</aside>

## Status

🟢 **Closed** — 9/9 Batches abgeschlossen. Alle B-, M-, Y-Items gelockt.

---

## 0. Command Reference (Was wird gebaut)

<aside>
📌

Diese Sektion definiert das **User-Facing Surface** des Tools: alle Commands, ihre Flags, Outputs und Behavior Rules. Architektur, Error-Handling und Schemas folgen ab §1.

</aside>

### 0.1 Command-Übersicht

```bash
# ─── Profile (einmalig) ──────────────────────
liver profile set --weight <kg> --height <cm> --sex <m|f|o> --age <int> [--formula <watson|widmark>]
liver profile show

# ─── Presets ──────────────────────────────────
liver preset save <name> --vol <ml> --abv <pct>
liver preset list
liver preset show <name>
liver preset rm <name>

# ─── Sessions ─────────────────────────────────
liver session start [--name <str>] [--stomach <empty|some|full>] [--at <T>]
liver session end [--at <T>]
liver session show [--id <id>]
liver session list [--year <YYYY> | --month <YYYY-MM>]
liver session stomach <empty|some|full> [--at <T>]

# ─── Drinks ───────────────────────────────────
liver add <preset> [--at <T>] [--duration <Xm|Xh>]
liver add --vol <ml> --abv <pct> [--at <T>] [--duration <Xm|Xh>]
liver start <preset>
liver start --vol <ml> --abv <pct>
liver stop [--at <T>]
liver drink list
liver drink rm <id>

# ─── Auswertung (alles JSON) ──────────────────
liver status
liver bac --at <T>
liver curve [--from <T>] [--to <T>] [--step <Xm>]
liver sober
liver stats [--month <YYYY-MM> | --year <YYYY> | --from <T> --to <T> | --all]

# ─── Config ───────────────────────────────────
liver config set <key> <value>
liver config get <key>
liver config list

# ─── Meta ─────────────────────────────────────
liver --version
liver --help
liver <command> --help
```

### 0.2 Globale Flags

- `--human` — Tabellen/Farben statt JSON (§2.2, §2.5)
- `--no-color` / `NO_COLOR=1` — monochrom (§2.4)
- `--verbose` / `-v` — Performance-Logs auf stderr (§2.3)
- `--formula <watson|widmark>` — Override für `bac` / `status` / `curve` / `sober` / `stats` (§1.5)

### 0.3 Behavior Rules

- **Nur EIN offener Drink** (`start` ohne `stop`) gleichzeitig. Zweiter `start` ohne `stop` → `DRINK_ALREADY_RUNNING`. `--force` macht implizites `stop`.
- **`add` während offenem Drink erlaubt** (z.B. Shot zwischen Bier-Sips).
- **Drink-ID-Output:** jedes `add`/`start` gibt `drink_id` zurück → Agent kann gezielt mit `drink rm <id>` löschen.
- **Lowercase-Normalisierung** für Preset-Namen (`Augustiner` ≡ `augustiner`, §7.2).
- **Default-Zeit** für `add`/`start`/`stop` = `now`.
- **Volumen-Eingabe** immer in Millilitern.
- **Nachträgliches Loggen via `--at <past>`:** Drink wird der Session zugeordnet, in deren Zeitspanne der Timestamp fällt. Liegt in keiner Session → `TIMESTAMP_OUTSIDE_SESSION` (§5.3).
- **Mid-Session Stomach-Switch:** `session stomach <state>` — Drinks erben State zum Zeitpunkt ihres `started_at` aus `stomach_events` (§5).
- **Stomach-Default bei `session start`:** ohne `--stomach` letzter bekannter State, sonst `some`.
- **Session-Auto-End:** lazy on next command, threshold = `last_drink.finished_at + minutes_until_sober` (§11). Explizites `session end` setzt `ended_at = now` (oder `--at <T>`).
- **Profile fehlt** → jeder Compute-Command failt mit `PROFILE_MISSING`.
- **Disclaimer:** jeder `status`/`bac`/`sober`/`curve`-Output enthält das `disclaimer`-Field.

### 0.4 Per-Command Output-Schemas

**`liver add` / `liver start`** (returns `drink_id`):

```json
{
  "drink_id": 142,
  "session_id": 42,
  "started_at": "2026-04-28T19:30:00+02:00",
  "finished_at": "2026-04-28T19:30:00+02:00",
  "volume_ml": 500,
  "abv": 5.2,
  "preset_name": "augustiner",
  "stomach_state": "full",
  "bac_after_promille": 0.31
}
```

**`liver status`:**

```json
{
  "now": "2026-04-28T19:12:00+02:00",
  "session_id": 42,
  "session_name": "Maibock-Abend",
  "bac_percent": 0.046,
  "bac_promille": 0.46,
  "trajectory": "rising",
  "absorbing_drinks": 1,
  "minutes_until_sober": 182,
  "sober_at": "2026-04-28T22:14:00+02:00",
  "zone": "below_sweet_spot",
  "drinks_in_session": 2,
  "stomach_state_now": "full",
  "disclaimer": "estimate, not legally/medically valid"
}
```

**`liver bac --at <T>`:**

```json
{
  "at": "2026-04-28T22:00:00+02:00",
  "bac_percent": 0.038,
  "bac_promille": 0.38,
  "zone": "below_sweet_spot",
  "formula": "watson",
  "disclaimer": "estimate, not legally/medically valid"
}
```

**`liver sober`:**

```json
{
  "minutes_until_sober": 182,
  "sober_at": "2026-04-28T22:14:00+02:00",
  "disclaimer": "estimate, not legally/medically valid"
}
```

**`liver curve`** → siehe §10.4. **`liver stats`** → siehe §9.6.

**Single-Object Reads** (`profile show`, `preset show <name>`, `session show`):

- Schema spiegelt die Tabelle aus §7.2 1:1 (gleiche Field-Names).

**Listen-Commands** (`preset list`, `drink list`, `session list`):

- Returnen `{"items": [...], "count": <int>}`.

**Mutator-Commands ohne Domain-Output** (`profile set`, `preset save`, `preset rm`, `session end`, `drink rm`, `config set`):

- Returnen `{"ok": true, "<entity>_id": <id>}` (bzw. `"name": <preset-name>`).
- `stop` returnt zusätzlich `drink_id` + `finished_at` + `duration_secs`.

### 0.5 User-Workflow (typischer Abend)

```bash
# Setup einmalig:
liver profile set --weight 78 --height 184 --sex m --age 22
liver preset save augustiner --vol 500 --abv 5.2
liver preset save shot --vol 40 --abv 40

# Abend:
liver session start --name "Maibock" --stomach full
liver add augustiner                      # 19:30, instant
liver add augustiner --duration 25m       # 20:05, mit duration
liver session stomach some                # Magen leert sich
liver start shot                          # 20:30, läuft
liver stop                                # 20:31, fertig
liver status                              # aktuelle BAC
liver curve --from 19:30 --step 5m        # Verlauf
liver session end                         # explizit beenden
```

### 0.6 Argument-Format-Konventionen

- **`<T>` (Timestamp):** chrono-node-Input (§4.3) — `19:30`, `2026-04-28T19:30+02:00`, `yesterday 21:00`, `2h ago`. Default-Tag bei reiner Uhrzeit per §4.4.
- **`<duration>`:** `Xm` (Minuten) oder `Xh` (Stunden). `15m`, `2h`, `0` (instant). Range 0–24h (§8).
- **`<id>`:** Integer, sichtbar in `drink list` / `session list`.
- **Preset-`<name>`:** 1–32 Zeichen `[a-z0-9_-]`, lowercase (§7.2). Eingabe wird auto-lowercased.
- **Session-`<name>`:** optional, 0–64 Zeichen.

---

## 1. Engine & WASM

### 1.1 ethanol-rs Vendoring

- Build: `wasm-pack build --target nodejs --release --features wasm`
- Output committed in `vendor/ethanol-rs/pkg/`
- Gepinnter Commit-SHA in `vendor/ethanol-rs/COMMIT.txt`
- `scripts/rebuild-wasm.sh` für manuelle Updates
- Rust-Toolchain ist nur erforderlich beim WASM-Rebuild, nicht für `npm install`

### 1.2 Engine-Layer-Architektur

Dünner direkter Adapter, **kein** abstraktes `ComputeEngine`-Interface. Premature Abstraction vermeiden. Engine-Wechsel ist später ein Refactor von `engine/ethanol.ts`.

Logische Module (innere Struktur darf der Coding-Agent frei wählen):

- **CLI** — Command-Dispatcher, Output-Marshalling
- **DB** — better-sqlite3 + Migrations
- **Engine** — ethanol-rs WASM-Adapter + Stomach-Resolver + Zone-Config
- **Time** — chrono-node-Wrapper + Display-Formatter
- **Config** — `~/.liver/config` Reader/Writer

### 1.3 Compute-Mapping (ethanol-rs → liver)

| **liver-Output** | **ethanol-rs-Funktion** | **Notes** |
| --- | --- | --- |
| `bac --at <T>` | `calculate_bac_at_offset(..., offset_secs)` | offset = T − now (negative = past) |
| `status.minutes_until_sober` / `sober_at` | `minutes_until_sober(...)` | sober_at = now + minutes |
| `curve --from --to --step` | `generate_curve(..., from, to, step, sweet_min, sweet_max)` | Eine WASM-Boundary für ganze Kurve |
| Session-Auto-Detection | implizit in `calculate_bac` | BAC ≤ 0.001% |

### 1.4 Liver-Eigenleistung (= unser Wertschöpfungs-Layer)

- **Timestamp ↔ `offset_secs`-Konverter** — DB hat absolute Zeitstempel; ethanol-rs will Offsets relativ zu „jetzt".
- **Sweet-Spot-Config-Layer** — ethanol-rs erwartet Schwellen als Parameter; liver speichert sie persistent.
- **Promille-Output** — ethanol-rs liefert BAC in Prozent; ×10 für DE-übliches Promille.
- **ABV-Einheits-Konversion** — liver speichert `abv` als Prozent (0–100); ethanol-rs erwartet Fraction (0.0–1.0). Adapter dividiert durch 100 am WASM-Boundary.
- **Mid-Session-Stomach-Switching-Semantik** — liver-Konzept (Timeline aus `stomach_events`), nicht ethanol-rs.
- **Persistenz + Sessions** — ethanol-rs ist stateless; liver hält Drinks/Sessions/Profile in SQLite.

### 1.5 Engine-Konfiguration

- **Default-Formel:** Watson. Override via `--formula widmark` per Command. Optional: `profile.preferred_formula` als Stored Default.
- **Sweet-Spot Defaults:** `min = 0.4 ‰`, `max = 0.8 ‰` (Liberal). Override via `liver config set zones.sweet_spot_min 0.X` / `zones.sweet_spot_max 0.X`.
- **Trajectory-Threshold:** ethanol-rs-Default unverändert übernommen; kein liver-Override in v0.x.
- **`bac_after_promille` (Output von `add`/`start`):** = BAC *jetzt* nach dem Drink-Insert (Variante 2 — trivialer `calculate_bac`-Call mit aktuellem now).

---

## 2. Output-Vertrag

### 2.1 Streams

- **stdout**: ausschließlich Result-JSON (Success ODER Error). Niemals andere Inhalte.
- **stderr**: Logs, Warnings, Debug, Progress, `--human`-formatierte Ausgabe.
- **Garantie:** `liver <cmd> 2>/dev/null | jq .` liefert immer valides JSON (außer bei katastrophalem WASM-Crash → non-zero Exit + leerer stdout).

### 2.2 Default-Format

- **JSON immer** (Agent Mode). Default ohne Flag.
- `--human` als Opt-In für Mensch-lesbare Tabellen.
- Konsistent mit [ADR-001: liver – Architecture & Spec](https://www.notion.so/ADR-001-liver-Architecture-Spec-160a90b88e63445d9850d882db12a45f?pvs=21).

### 2.3 Logs

- Off-by-default. stderr ist bei Erfolg leer.
- `--verbose` / `-v` schaltet einzeilige Performance-Logs an.
- `LIVER_DEBUG=1` env schaltet ausführliches Debug an.

### 2.4 Color

- TTY-Auto-Detect: Farben in Terminals, keine Farben in Pipes.
- `--no-color` Flag erzwingt monochrom.
- `NO_COLOR=1` env (a11y-Standard) erzwingt monochrom.

### 2.5 Display-Format `--human`

- Zeitangaben: `HH:MM` (keine `:SS`).
- JSON behält volle ISO-Präzision (machine-readable).

---

## 3. Error-Vertrag

### 3.1 Format

```json
{
  "error": {
    "code": "PROFILE_MISSING",
    "message": "No profile configured. Run `liver profile set ...` first.",
    "hint": "liver profile set --weight 78 --height 184 --sex m --age 22",
    "context": { "command": "status" }
  }
}
```

- `code`: SCREAMING_SNAKE_CASE, **stabile Public API unter semver** (umbenennen/entfernen = breaking).
- `message`: human-lesbar, einzeilig.
- `hint`: optional, konkretes Folge-Kommando.
- `context`: optional. **Pflicht bei State-Errors (Exit 2)** mit referenzierten IDs.
- **Single Error pro Response** (KISS). Bei Multi-Field-Validation gewinnt der erste Fehler. Erweiterung in v2 möglich.
- `--human` formatiert Errors lesbar (z.B. `✘ ERROR: <message>\n  → <hint>`).

### 3.2 Exit-Codes

- **`0`** — Success
- **`1`** — User-Error (Input falsch/fehlend). Beispiele: `PROFILE_MISSING`, `INVALID_VOLUME`, `UNKNOWN_PRESET`, `BAD_TIME_FORMAT`, `CURVE_TOO_LARGE`
- **`2`** — State-Error (logischer Konflikt mit DB). Beispiele: `SESSION_NOT_ACTIVE`, `DRINK_ALREADY_RUNNING`, `TIMESTAMP_OUTSIDE_SESSION`, `DRINK_NOT_FOUND`
- **`3`** — Internal-Error (Engine, DB, WASM). Beispiele: `WASM_LOAD_FAILED`, `DB_LOCKED`, `ENGINE_PANIC`, `SCHEMA_MIGRATION_FAILED`
- **`4`** — Config-Error. Beispiele: `CONFIG_FILE_CORRUPT`, `INVALID_CONFIG_KEY`

### 3.3 Initiale Error-Code-Tabelle (erweiterbar)

- **`PROFILE_MISSING`** (Exit 1) — Kein Profile gesetzt bei Compute-Command
- **`INVALID_WEIGHT`** (Exit 1) — Profile-Weight außerhalb 30–250 kg
- **`INVALID_HEIGHT`** (Exit 1) — Profile-Height außerhalb 120–230 cm
- **`AGE_OUT_OF_RANGE`** (Exit 1) — Profile-Age außerhalb 16–120
- **`INVALID_SEX`** (Exit 1) — `sex` nicht in `m`/`f`/`o`
- **`INVALID_VOLUME`** (Exit 1) — `vol ≤ 0` oder `> 5000` ml
- **`INVALID_ABV`** (Exit 1) — `abv ≤ 0` oder `> 100`
- **`INVALID_DURATION`** (Exit 1) — `duration < 0` oder `> 24h`
- **`INVALID_TIME_ORDER`** (Exit 1) — `finished_at < started_at`
- **`INVALID_STOMACH_STATE`** (Exit 1) — State nicht in `empty`/`some`/`full`
- **`INVALID_PRESET_NAME`** (Exit 1) — Preset-Name nicht 1–32 Zeichen `[a-z0-9_-]`
- **`INVALID_SESSION_NAME`** (Exit 1) — Name > 64 Zeichen
- **`UNKNOWN_PRESET`** (Exit 1) — Referenzierter Preset existiert nicht
- **`BAD_TIME_FORMAT`** (Exit 1) — chrono-node Parse-Fail
- **`CURVE_TOO_LARGE`** (Exit 1) — `(to−from)/step > 1000`
- **`SESSION_ALREADY_ACTIVE`** (Exit 2) — `session start` während offene Session existiert (außer `--force`)
- **`SESSION_NOT_ACTIVE`** (Exit 2) — Compute-/State-Command ohne offene Session
- **`DRINK_ALREADY_RUNNING`** (Exit 2) — `start` während bereits ein Drink läuft
- **`NO_DRINK_TO_STOP`** (Exit 2) — `stop` ohne offenen Drink
- **`TIMESTAMP_OUTSIDE_SESSION`** (Exit 2) — Backdated Drink/Stomach-Event außerhalb aller Sessions
- **`DRINK_NOT_FOUND`** (Exit 2) — `drink rm <id>` für nicht-existente ID
- **`WASM_LOAD_FAILED`** (Exit 3) — WASM-Module kann nicht geladen werden
- **`DB_LOCKED`** (Exit 3) — SQLite busy (kein Retry, siehe §12.2)
- **`ENGINE_PANIC`** (Exit 3) — ethanol-rs hat panic'd
- **`SCHEMA_MIGRATION_FAILED`** (Exit 3) — DB-Migration scheitert
- **`CONFIG_FILE_CORRUPT`** (Exit 4) — `~/.liver/config` unparsbar
- **`INVALID_CONFIG_KEY`** (Exit 4) — `config set` mit unbekanntem Key

---

## 4. Time & Datums-Semantik

### 4.1 Speicherung

- **UTC ISO als TEXT** in SQLite (z.B. `2026-04-28T17:30:00Z`).
- Pharmakokinetik braucht nur Δt, UTC ist der korrekte technische Anker.

### 4.2 Display

- **Hardcoded `Europe/Berlin`** für `--human`-Output. Kein Profile-Field, kein `--tz` Override.
- JSON-Output: ISO mit lokalem Offset (`+02:00`/`+01:00` je nach DST).

### 4.3 Parsing

- **chrono-node mit EN-Default**. Parst:
    - ISO-Strings: `2026-04-28T19:30+02:00`
    - Uhrzeit-Kürzel: `19:30` (= heute, oder gestern bei Future → siehe 4.4)
    - Relative: `2h ago`, `yesterday 21:00`
- Keine extra DE-Locale-Pflege.

### 4.4 Default-Tag bei reiner Uhrzeit

- `liver add bier --at 19:30` ohne Datum → **letzter vergangener Match**.
    - 19:30 heute, falls bereits vergangen.
    - Sonst 19:30 gestern.
- liver loggt rückwirkend, nicht prospektiv.

### 4.5 DST

- Keine Sonderbehandlung. UTC-monotone Zeit. Display zeigt im DST-Übergang lokale Wanduhr (Sprung sichtbar).
- Doku-Hinweis im README, kein Code.

---

## 5. Stomach-Timeline-Resolver

### 5.1 Algorithmus

```tsx
function resolveStomachStateAt(
	sessionId: number,
	at: ISOTimestamp,
): "empty" | "some" | "full" {
	const event = db.queryOne(`
		SELECT state FROM stomach_events
		WHERE session_id = ?
		  AND at <= ?
		ORDER BY at DESC, rowid DESC
		LIMIT 1
	`, [sessionId, at])
	if (event) return event.state
	return db.queryOne(
		`SELECT stomach_initial FROM sessions WHERE id = ?`,
		[sessionId]
	)?.stomach_initial ?? "some"
}
```

### 5.2 Regeln

- **`session start --stomach X`** schreibt zwei Dinge in einer Transaction:
    1. `sessions.stomach_initial = X`
    2. `stomach_events(session_id, at = session.started_at, state = X)`
    
    → Damit ist der Resolver einheitlich („nimm letzten Event mit `at <= drink.started_at`") ohne Sonderfall.
    
- **Tie-Breaker:** `at <= drink.started_at` (Event hat Vorrang vor Vor-Zustand bei Gleichheit).
- **Determinismus bei identen `at`:** `ORDER BY at DESC, rowid DESC` → zuletzt eingefügter Event gewinnt (= Override-Verhalten ohne UPSERT).
- **Backdated Drinks:** Resolver nutzt `drink.started_at`, also automatisch historisch korrekt.
- **`session stomach <state>`** akzeptiert optionales `--at <past-timestamp>`. Default = `now`.

### 5.3 Edge Cases

- **Drink außerhalb jeder Session** (`add --at <T>` und `T` liegt in keiner Session) → Fehler `TIMESTAMP_OUTSIDE_SESSION`. Kein Auto-Create.
- **`session stomach --at <T>` außerhalb der Session-Grenzen** → Fehler `TIMESTAMP_OUTSIDE_SESSION`.
- **Falsch geloggter Stomach-Event:** kein Edit-Command in v0.x. Workaround per Doku: erneut `session stomach <correct> --at <T+1min>` setzen — der spätere gewinnt im Resolver. UPSERT bewusst nicht implementiert.

---

## 6. Repo-Struktur

### 6.1 Skelett

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
├── src/                   ← Coding-Agent strukturiert frei, basierend auf den 5 logischen Modulen aus 1.2
├── tests/
│   ├── unit/
│   ├── integration/       ← CLI-end-to-end via spawn
│   └── fixtures/          ← golden JSON outputs
└── bin/
    └── liver              ← #!/usr/bin/env node
```

### 6.2 Tooling

- **Sprache:** TypeScript
- **Module-System:** ESM (`"type": "module"` in `package.json`)
- **Runtime:** Node ≥ 22 LTS
- **Lint + Format:** Biome
- **Tests:** vitest
- **Arg-Parser:** commander
- **Build:** tsup
- **tsconfig:** strict-strict (`strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`)
- **npm-Name:** **TBD** — `liver` falls frei, sonst `@<handle>/liver`

---

## 7. Datenbank

### 7.1 Strategie

- **Plain SQL + better-sqlite3**, kein ORM (Schema = 5 Tabellen, ORM wäre Overkill).
- Migrations als nummerierte SQL-Files in `src/db/migrations/` (`001-init.sql`, `002-...sql`).
- `PRAGMA user_version` als Versions-Counter.
- Bei jedem CLI-Start: lese `user_version`, applye fehlende Migrations in einer Transaction.
- Erstes Init schreibt komplettes Schema in `001-init.sql`.
- `ON DELETE CASCADE` für Session→Drinks und Session→Stomach-Events.

### 7.2 Schema (verbindlich, supersedes [ADR-001: liver – Architecture & Spec](https://www.notion.so/ADR-001-liver-Architecture-Spec-160a90b88e63445d9850d882db12a45f?pvs=21))

- **`profile`** — Singleton (genau 1 Row).
    - `weight_kg` (REAL, NOT NULL, 30–250)
    - `height_cm` (REAL, NOT NULL, 120–230)
    - `sex` (TEXT, NOT NULL, `m`/`f`/`o`)
    - `age` (INTEGER, NOT NULL, 16–120)
    - `preferred_formula` (TEXT, NULL = Watson-Default, sonst `watson`/`widmark`)
- **`presets`** — Stamm-Trinkgut.
    - `name` (TEXT, PK, lowercase, 1–32 Zeichen `[a-z0-9_-]`)
    - `volume_ml` (REAL, NOT NULL, 0–5000)
    - `abv` (REAL, NOT NULL, 0–100, Prozent)
    - `created_at` (TEXT, NOT NULL, UTC ISO)
- **`sessions`** — Trink-Sessions.
    - `id` (INTEGER, PK AUTOINCREMENT)
    - `name` (TEXT, NULL, 0–64 Zeichen)
    - `started_at` (TEXT, NOT NULL, UTC ISO)
    - `ended_at` (TEXT, NULL — `NULL` = aktive Session)
    - `stomach_initial` (TEXT, NOT NULL, `empty`/`some`/`full`)
- **`stomach_events`** — Mid-Session-Switches (Timeline).
    - `id` (INTEGER, PK AUTOINCREMENT — = SQLite rowid)
    - `session_id` (INTEGER, NOT NULL, FK → `sessions.id` ON DELETE CASCADE)
    - `at` (TEXT, NOT NULL, UTC ISO)
    - `state` (TEXT, NOT NULL, `empty`/`some`/`full`)
- **`drinks`** — Einzelne Drinks.
    - `id` (INTEGER, PK AUTOINCREMENT)
    - `session_id` (INTEGER, NOT NULL, FK → `sessions.id` ON DELETE CASCADE)
    - `started_at` (TEXT, NOT NULL, UTC ISO)
    - `finished_at` (TEXT, NULL — `NULL` = läuft gerade nach `start` ohne `stop`)
    - `volume_ml` (REAL, NOT NULL, 0–5000)
    - `abv` (REAL, NOT NULL, 0–100)
    - `preset_name` (TEXT, NULL, FK → `presets.name`)
- **`config`** — Key-Value-Store für `liver config set`.
    - `key` (TEXT, PK)
    - `value` (TEXT, NOT NULL — JSON-encoded für Nicht-String-Values)

---

## 8. Validierung

- **`weight_kg`** — `30 ≤ x ≤ 250` → `INVALID_WEIGHT`
- **`height_cm`** — `120 ≤ x ≤ 230` → `INVALID_HEIGHT`
- **`age`** — `16 ≤ x ≤ 120` → `AGE_OUT_OF_RANGE`
- **`sex`** — `m` / `f` / `o` → `INVALID_SEX`
- **`preferred_formula`** — `watson` / `widmark` oder `NULL` → `INVALID_CONFIG_KEY`. (ethanol-rs `BACFormula`-Enum hat nur diese zwei Varianten.)
- **`volume_ml`** — `0 < x ≤ 5000` → `INVALID_VOLUME`
- **`abv`** — `0 < x ≤ 100` → `INVALID_ABV`
- **`duration`** — `0 ≤ x ≤ 24h` → `INVALID_DURATION`
- **`finished_at`** — `≥ started_at` → `INVALID_TIME_ORDER`
- **`stomach_state`** — `empty` / `some` / `full` → `INVALID_STOMACH_STATE`
- **`preset.name`** — 1–32 Zeichen `[a-z0-9_-]`, lowercase → `INVALID_PRESET_NAME`
- **`session.name`** — optional, 0–64 Zeichen → `INVALID_SESSION_NAME`

---

## 9. Stats

### 9.1 Command & Default-Zeitraum

`liver stats` ohne Flag → **letzte 30 Tage rollend** (`now − 30d` bis `now`).

Overrides:

- `--month YYYY-MM` — Kalendermonat
- `--year YYYY` — Kalenderjahr
- `--from <T> --to <T>` — explizit
- `--all` — all-time seit DB-Init

### 9.2 Day-Bucketing

Tag-Grenzen = `Europe/Berlin`-Mitternacht (konsistent mit B5.b). Ein Drink mit `started_at = 2026-04-28T23:30+02:00` zählt zum 28.04.

### 9.3 Metriken

- `drinking_days` — Tage im Range mit ≥ 1 Drink (`started_at` im Tag). Restalkohol-Tage zählen explizit **nicht**.
- `dry_days` — `range_days − drinking_days`.
- `longest_dry_streak` — längste Tageskette ohne Drink, **all-time ab erstem Drink in DB** (nicht range-limitiert).
- `current_dry_streak` — Tage seit letztem Drink, immer all-time aktuell (nicht range-limitiert).
- `total_drinks` — Count of drinks im Range.
- `total_sessions` — Count of sessions deren `started_at` im Range.
- `total_pure_alcohol_g` — `Σ (volume_ml × abv / 100 × 0.789)` über drinks im Range. **`abv` ist in Prozent (0–100) gespeichert, daher die Division durch 100. Faktor 0.789 ist die Ethanol-Dichte (g/ml bei 20°C). Pharmakologische Standard-Einheit für Vergleichbarkeit mit Studien.**
- `avg_peak_promille` — Mittel der Peak-BAC pro Session: 1 Wert pro Session (Max der Curve), dann arithmetisches Mittel über Sessions.
- `avg_session_promille` — time-weighted Mean: `Σ ∫BAC dt / Σ Session-Dauer`. Trapez-Integration auf 5-min-Curve.
- `max_session_promille` — höchster Peak einer einzelnen Session im Range.
- `by_preset` — Aggregat pro Preset: `{name, count, total_volume_ml, total_pure_alcohol_g}`. `total_pure_alcohol_g` nutzt dieselbe `volume_ml × abv / 100 × 0.789`-Formel wie oben.

### 9.4 Empty-Data

Wenn keine Drinks im Range → Erfolg, alle numerischen Metriken = `0`, `by_preset = []`. Kein Fehler.

### 9.5 Berechnung

- Reine Count-/Sum-Aggregate: SQL-only.
- `avg_peak_promille`, `avg_session_promille`, `max_session_promille`: ein `generate_curve`-Call pro Session im Range.
- **Implementation-Hint** (nicht normativ): `peak_promille` und `session_avg_promille` können beim `session end` denormalisiert in `sessions` gespeichert werden, um `--all` performant zu halten. Coding-Agent darf das frei entscheiden.

### 9.6 Output-Schema (verbindlich, supersedes [ADR-001: liver – Architecture & Spec](https://www.notion.so/ADR-001-liver-Architecture-Spec-160a90b88e63445d9850d882db12a45f?pvs=21))

```json
{
  "period": { "from": "2026-03-29", "to": "2026-04-28", "mode": "rolling_30d" },
  "drinking_days": 12,
  "dry_days": 18,
  "longest_dry_streak": 21,
  "current_dry_streak": 0,
  "total_drinks": 38,
  "total_sessions": 11,
  "total_pure_alcohol_g": 246.56,
  "avg_peak_promille": 0.62,
  "avg_session_promille": 0.31,
  "max_session_promille": 1.18,
  "by_preset": [
    { "name": "augustiner", "count": 18, "total_volume_ml": 9000, "total_pure_alcohol_g": 369.25 }
  ]
}
```

- `period.mode` ∈ `rolling_30d` | `month` | `year` | `range` | `all`.
- Einheiten: `total_volume_ml` ist Getränk-Volumen in ml; `total_pure_alcohol_g` ist reines Ethanol in Gramm (pharmakologische Konvention, Faktor 0.789 g/ml).

---

## 10. Curve

### 10.1 Command

`liver curve [--from <T>] [--to <T>] [--step <minutes>]`

### 10.2 Defaults

- `--from`: aktuelle Session `started_at`
- `--to`: geschätztes `sober_at` = `now + minutes_until_sober(...)`
- `--step`: 5 min

Ohne aktive Session und ohne explizites `--from`/`--to` → Fehler `SESSION_NOT_ACTIVE`.

### 10.3 Performance-Cap

- Hard-Cap **1000 Punkte** pro Curve-Call.
- `(to − from) / step > 1000` → Fehler `CURVE_TOO_LARGE` mit `hint`-Field, das eine Step-Empfehlung enthält (`ceil((to−from) / 1000 min)`, gerundet auf nächsten in {1, 5, 10, 30, 60} min).
- Kein Auto-Step. Deterministisch und explizit.

### 10.4 Output-Schema

```json
{
  "curve": [
    { "at": "2026-04-28T19:30:00+02:00", "bac_promille": 0.42, "zone": "sweet_spot" },
    { "at": "2026-04-28T19:35:00+02:00", "bac_promille": 0.51, "zone": "sweet_spot" }
  ],
  "meta": {
    "from": "2026-04-28T19:00:00+02:00",
    "to":   "2026-04-29T01:00:00+02:00",
    "step_min": 5,
    "points": 72,
    "formula": "watson"
  }
}
```

- `bac_promille`: 2 Nachkommastellen (Ausgabe-Rundung; intern volle Präzision).
- `zone`: einer von `sober` / `below_sweet_spot` / `sweet_spot` / `caution` / `danger`.
- `meta.formula`: tatsächlich genutzte Formel nach Override-Resolution.

### 10.5 Neue Error-Codes

- `CURVE_TOO_LARGE` (Exit 1) — siehe oben.

---

## 11. Session-Lifecycle

### 11.1 Auto-Close-Strategie

**Lazy on next command.** Bei jedem `liver`-Aufruf, der State berührt (compute, add, start, stop, status, stats, curve), prüft liver, ob es eine offene Session mit `ended_at IS NULL` gibt, in der seit dem letzten Drink die berechnete Sober-Zeit verstrichen ist.

Kein Background-Daemon, kein cron, kein systemd-Service.

### 11.2 Threshold

Eine Session gilt als beendet, wenn:

```
now ≥ last_drink.finished_at + minutes_until_sober(drinks, profile, formula) × 60s
```

`minutes_until_sober(...)` wird via ethanol-rs für die aktuelle Drink-Sequenz berechnet.

### 11.3 `ended_at`-Wert

Bei Auto-Close wird `ended_at` auf den **berechneten Sober-Zeitpunkt** gesetzt, nicht auf `now`:

```
ended_at = last_drink.finished_at + minutes_until_sober(...) × 60s
```

Dies erhält die korrekte Session-Dauer für Stats (`avg_session_promille`, `max_session_promille`).

### 11.4 Output-Information

Wenn ein CLI-Call eine Session lazy-schließt, enthält der Output ein optionales Feld `auto_closed_session: <id>`:

```json
{
  "status": { "...": "..." },
  "auto_closed_session": 42
}
```

Macht die State-Änderung für Agents transparent. Bei Commands ohne natürliches Output-Objekt hängt das Feld an die Top-Level-Response.

### 11.5 Transactional

Der Lazy-Check + `UPDATE ended_at` läuft in einer Transaction, um Race Conditions mit gleichzeitigen `add`-Calls zu vermeiden (siehe §12.3).

---

## 12. Concurrency & DB-Locking

### 12.1 Journal Mode

- `PRAGMA journal_mode = WAL` einmalig beim ersten DB-Init persistiert.
- `PRAGMA synchronous = NORMAL` (Trade-off: schneller als FULL, sicher genug für Personal-CLI).

### 12.2 Busy Timeout

- `PRAGMA busy_timeout = 0` — **kein Retry**.
- Bei Lock-Konflikt → sofort Fehler `DB_LOCKED` (Exit 3).
- Rationale: Agent-Mode → Caller soll bei `DB_LOCKED` einfach den Command retryen. Schnelles Fail > hängender Prozess.

### 12.3 Transactional Operations (verbindlich)

- **Migrations** — ja
- **`session start --stomach X`** (sessions + stomach_events) — ja
- **`session start --auto`** (close-old + open-new) — ja
- **`drink rm <id>`** mit potential Cache-Update — ja
- **Lazy-Auto-Close** (`session.ended_at` setzen) — ja
- **`add`** (single INSERT in drinks) — nein
- **`start`** / **`stop`** (single UPDATE) — nein
- **`profile set`** / **`config set`** (single UPSERT) — nein

### 12.4 Connection Lifecycle

- Eine `Database`-Connection pro CLI-Call, geöffnet beim Start, geschlossen via `db.close()` vor `process.exit`.
- Keine Connection-Pools. Jeder `liver`-Call ist ein eigener Node-Prozess.

---

## 13. CI & Release

### 13.1 CI

- **Provider:** GitHub Actions
- **OS-Matrix:** `ubuntu-latest`, `macos-latest`. Windows nicht unterstützt.
- **Node-Matrix:** 22 LTS, 24 LTS
- **Jobs:**
    - `lint` — Biome
    - `test` — vitest (unit + integration)
    - `build` — tsup
- **Kein WASM-Rebuild im CI** — Vendored. Manueller Rebuild via `scripts/rebuild-wasm.sh`.

### 13.2 Release

- **Versionierung:** semver. `CHANGELOG.md` im Keep-a-Changelog-Format.
- **Trigger:** Push eines `v*.*.*` Git-Tags startet den Release-Workflow.
- **Publishing:** `npm publish` zur npm-Registry.
- **Pre-Release:** Tags wie `v1.2.0-rc.1` werden mit npm dist-tag `next` veröffentlicht.
- **GitHub Release:** Auto-extrahiert aus dem passenden `CHANGELOG.md`-Abschnitt.

---

## 14. Limitations & Out-of-Scope (v0.x)

Bewusst **nicht** in v0.x enthalten. Jedes Item hat einen Decision-Log-Verweis.

- **Engine-Parameter-Override** (β, Widmark-Faktor, Food-Multiplier) — ethanol-rs exposed es nicht. (M7.a)
- **Body-Fat-%** im Profile — ethanol-rs Public API nutzt nur `weight/sex/height/age`. (Y7)
- **`drink edit`-Command** — Korrektur via `rm` + erneutem `add`. (M6)
- **Stomach-Event Edit / Delete** — Workaround: erneuter `session stomach` mit späterem `--at`. (B6.e)
- **Shell-Completion** — Future Work. (Y3)
- **Export / Import-Command** — Source of Truth ist `~/.liver/db.sqlite`. Backup via `cp`. (Y4)
- **i18n** — English-only für Code, Errors, Help. (Y6)
- **Windows Support** — CI baut nur Linux + macOS. (Y1)
- **Background-Daemon / cron** — Auto-Close ist lazy on next command. (M8.a)
- **Harness-Skill** — deferred zu separatem ADR-002 nach v0.1. (B7)
- **DST-Sonderbehandlung** — UTC-monoton, Display zeigt lokale Wanduhr. (B5.e)
- **Custom-TZ-Override** — hardcoded `Europe/Berlin`. (B5.b)
- **Multi-Field Validation Errors** — nur erster Fehler pro Response. (B3.c)
- **DB-Lock-Retry** — `busy_timeout = 0`, Caller retried bei `DB_LOCKED`. (M9.b)
- **Reise-Skew bei `drinking_days`** — Tag-Grenzen sind hardcoded `Europe/Berlin`-Mitternacht (siehe §9.2). Wer ausserhalb dieser TZ loggt, bekommt verschobene Day-Buckets. Akzeptierte Limitation; Workaround: lokal nicht loggen oder TZ-Korrektur in v1.x. (B5.b + 9.2)

---

## 15. Future Work — Harness Integration

<aside>
⏭️

Harness-Skill wird **nicht** Teil dieser v0.x-Spec. Wird per separatem **ADR-002** nachgezogen, sobald liver lauffähig ist. Erstellung erfolgt freihand durch einen Coding-Agent gegen den hier festgelegten JSON-Contract.

</aside>

**Garantierter Vertrag von liver-Seite:**

- stdout = JSON, non-zero Exit-Code bei Fehler.
- JSON-Schemas (Success + Error) sind in 1.x.x semver-stabil. Field-Removal/Renaming = breaking change.
- liver `--version` exposed Major.Minor.Patch für Skill-Side-Pinning.

---

## Decision Log

### Batch 1 — B1 + B2

- ✅ **B1** WASM-Vendoring (Option A), Build-Command, gepinnter SHA
- ✅ **B2** Direkter Adapter, kein abstraktes Engine-Interface
- ✅ **B2.a** Watson default, `--formula` Override, `profile.preferred_formula`
- ✅ **B2.b** Sweet-Spot Liberal (0.4 / 0.8 ‰), config-overridable
- ✅ **B2.c** `bac_after_promille` = BAC jetzt (Variante 2)
- ✅ **B2.d** ethanol-rs-Default für Trajectory
- ✅ **B2.e** `session start --stomach X` schreibt Event bei `started_at`
- ✅ **B2.f** `session stomach` mit optionalem `--at`

### Batch 2 — B3 + B4

- ✅ **B3** Error-JSON-Format mit `code`/`message`/`hint`/`context`
- ✅ **B3.a** `--human` formatiert auch Errors
- ✅ **B3.b** `context` pflichtig bei State-Errors
- ✅ **B3.c** Erster Fehler bei Validation (KISS)
- ✅ **B3.d** Error-Codes als semver-Public-API
- ✅ **B4** stdout = JSON only, stderr = Logs
- ✅ **B4.a** `--human` schreibt stdout
- ✅ **B4.b** Default = JSON immer, `--human` opt-in
- ✅ **B4.c** Logs off-by-default, `--verbose` opt-in
- ✅ **B4.d** Color: TTY-Auto + `--no-color` + `NO_COLOR`

### Batch 3 — B5 + B6

- ✅ **B5.a** UTC ISO TEXT in DB
- ✅ **B5.b** Hardcoded `Europe/Berlin`, kein TZ-Field, kein Override
- ✅ **B5.c** chrono-node EN-Default only
- ✅ **B5.d** Default-Tag = letzter vergangener Match
- ✅ **B5.e** DST: nur Doku
- ✅ **B6** Resolver-Pseudocode
- ✅ **B6.a** Tie-Breaker `<=`
- ✅ **B6.b** Backdated Drinks → damaliger State
- ✅ **B6.c** Drinks außerhalb Session = Fehler
- ✅ **B6.d** `session stomach --at` außerhalb Session = Fehler
- ✅ **B6.e** Kein UPSERT, kein Delete-Command, Doku-Workaround

### Batch 4 — B7 + M1

- ✅ **B7** Harness-Skill deferred, eigener ADR-002 später, JSON-Contract garantiert
- ✅ **M1** Schlanker Repo-Skelett, Tooling festgelegt

### Batch 5 — M2 + M3

- ✅ **M2** Plain SQL + better-sqlite3, `PRAGMA user_version`-Migrations
- ✅ **M3** Validation-Constraints-Tabelle

### Batch 6 — M4 + M5

- ✅ **M4.a** Default-Zeitraum = letzte 30 Tage rollend
- ✅ **M4.b** `drinking_day` = ≥ 1 Drink (Restalkohol zählt nicht)
- ✅ **M4.c** `longest_dry_streak` all-time ab erstem Drink; zusätzlich `current_dry_streak`
- ✅ **M4.d** Beide Mittel: `avg_peak_promille` + `avg_session_promille`
- ✅ **M4.e** Empty-Range = Erfolg mit Nullen
- ✅ **M5.a** Default-Step 5 min
- ✅ **M5.b** Default `--from` = Session-Start, `--to` = `sober_at`
- ✅ **M5.c** Hard-Cap 1000 Punkte → `CURVE_TOO_LARGE` mit Step-Suggestion (kein Auto-Step)
- ✅ **M5.d** Output mit `curve[]` + `meta`-Block, 2 Nachkommastellen
- ➕ Neuer Error-Code: `CURVE_TOO_LARGE` (Exit 1)

### Batch 7 — M6 + M7

- ✅ **M6** Spar-Bones: nur `liver drink rm <id>`. Kein `edit`-Command. Korrektur = `rm` + erneuter `add`.
- ✅ **M7.a** Skip Engine-Parameter-Override in v0.x. Limitation in Doku.
- ✅ **M7.b** `profile.preferred_formula` als Stored-Default (bestätigt B2.a).

### Batch 8 — M8 + M9

- ✅ **M8.a** Lazy on next command (kein Daemon, kein cron)
- ✅ **M8.b** Threshold = `last_drink.finished_at + minutes_until_sober`
- ✅ **M8.c** `ended_at` = berechneter Sober-Zeitpunkt (nicht `now`)
- ✅ **M8.d** Stille Schließung + `auto_closed_session`-Field im Output
- ✅ **M9.a** WAL + `synchronous = NORMAL`
- ✅ **M9.b** `busy_timeout = 0` → sofortiger `DB_LOCKED`, Caller retried (Agent-friendly)
- ✅ **M9.c** Explizite Liste transactional Operations in Spec §12.3
- ✅ **M9.d** Eine Connection pro CLI-Call

### Cleanup-Pass 4 — Command-Reference (v1.0.4)

- ✅ §0 Command-Reference aus [ADR-001: liver – Architecture & Spec](https://www.notion.so/ADR-001-liver-Architecture-Spec-160a90b88e63445d9850d882db12a45f?pvs=21) extrahiert und in die Spec integriert
- ✅ §0.1 Vollständige Command-Liste inkl. `config`-Subcommands + `--version`/`--help`
- ✅ §0.2 Globale Flags konsolidiert
- ✅ §0.3 Behavior Rules (aus ADR-001 übernommen, mit Verweisen auf §-Sektionen)
- ✅ §0.4 Per-Command Output-Schemas für `add`/`start`/`status`/`bac`/`sober` + Konventionen für Reads/Lists/Mutators
- ✅ §0.5 User-Workflow-Beispiel
- ✅ §0.6 Argument-Format-Konventionen (`<T>`, `<duration>`, `<id>`, `<name>`)

### Batch 9 — Y1–Y7 (Polish & Release)

- ✅ **Y1** GitHub Actions, Linux + macOS, Node 22 + 24, kein WASM-Rebuild im CI
- ✅ **Y2** semver-Tags + `npm publish` + Auto-Release-Notes aus `CHANGELOG.md`
- ✅ **Y3** Shell-Completion: Skip in v0.x → Future Work
- ✅ **Y4** Export/Import: Skip → `cp ~/.liver/db.sqlite` als Backup-Strategie
- ✅ **Y5** Color-Handling: bereits in B4.d gelockt (kein Re-Lock nötig)
- ✅ **Y6** English-only (kein i18n in v0.x)
- ✅ **Y7** Body-Fat-%: Skip — ethanol-rs exposed es nicht

---

✅ **Spec geschlossen.** Bereit für Coding-Agent-Hand-Off.