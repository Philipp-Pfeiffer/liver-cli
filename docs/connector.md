# liver als Connector: Kurzreferenz für Worker und Hub-UI

Stand: 30.10.2026, liver-cli 0.3.0 (main, nach dem Build-Fix `fix/build-vendor`). Alle Beispiele
unten stammen aus echten Läufen gegen eine Kopie der DB (Profil 70 kg, 186 cm, m, 19).

## Aufruf

```
liver [--human] [--formula watson|widmark] [-v] <befehl> [optionen]
```

- Binary: `~/.npm-global/bin/liver` → `~/dev/liver-cli/dist/index.js` (global installiert als Symlink
  aufs Repo, `npm install -g ~/dev/liver-cli`). Nach Code-Änderungen reicht `npm run build`.
- DB: `~/.liver/db.sqlite`. **`LIVER_DB=/pfad/db.sqlite`** überschreibt den Pfad (für Tests immer setzen).
- Ausgabe: **eine JSON-Zeile auf stdout**, auch bei Fehlern. `--human` gibt Text aus (Fehler dann auf stderr).
  Nur unerwartete Fehler (`UNKNOWN_ERROR`) und Commander-Fehler (unbekannter Befehl/Option) gehen auf stderr.
- Jeder Aufruf ist ein eigener Prozess, es gibt keinen Server und kein Locking über mehrere Aufrufe
  hinweg (SQLite im WAL-Modus, `busy_timeout = 0` → bei Parallelzugriff `DB_LOCKED`, Exit 3: einfach wiederholen).

## Latenz (gemessen, 10 Läufe, Median, Node 26, 8 Kerne)

| Aufruf | Median |
|---|---|
| `--version` | 97 ms |
| `profile show`, `preset list`, `status`, `drink list` | 100–103 ms |
| `bac --at …` | 143 ms |
| `add --vol --abv --at …` (schreibend) | 118 ms |
| `stats --all` | 220 ms |

Fast alles davon ist Node-Start plus WASM-Laden. Für die Hub-UI heißt das: ein Aufruf pro Aktion ist
in Ordnung, ein Aufruf pro Kurvenpunkt nicht → `curve` benutzen.

## Begriffe

- **Session** = ein Trinkabend. Drinks gehören immer zu einer Session. Es gibt höchstens **eine aktive
  Session** (`ended_at = null`). `start`/`stop` brauchen eine aktive Session; `add` braucht eine
  Session, die den Zeitpunkt `--at` umfasst (auch eine beendete), sonst `TIMESTAMP_OUTSIDE_SESSION`.
- **Auto-Close:** Vor jedem schreibenden bzw. rechnenden Befehl (`status`, `bac`, `curve`, `sober`,
  `stats`, `add`, `start`, `stop`, `session …`) prüft liver, ob die aktive Session vorbei ist: kein
  offener Drink, letzter Drink seit mehr als 15 Min. beendet (hier fest im Code, der Config-Key
  `auto_close_grace_minutes` wirkt nur auf die Anzeige in `status`), BAC jetzt bei 0. Dann setzt es `ended_at = Zeitpunkt der Nüchternheit` und meldet `"auto_closed_session": <id>`.
  **Nur wenn der letzte Drink weniger als 24 h zurückliegt.** Ältere Sessions bleiben für immer offen
  (siehe „Bekannte Macken“).
- **Offener Drink** („Active Drink“): `liver start` legt einen Drink mit geschätztem Ende an
  (`finished_at = start + Standarddauer`, aus dem Volumen, z. B. 500 ml → 45 Min.). Solange
  `finished_at` in der Zukunft liegt, gilt er als offen (`open_drinks` in `status`). `liver stop` setzt
  das echte Ende. Vergisst man `stop`, endet er automatisch zum geschätzten Zeitpunkt.
  Es gibt höchstens einen offenen Drink pro Session (`E_DRINK_ALREADY_OPEN`, mit `--force` wird der
  alte beendet).
- **Lesende Befehle ohne jeden Schreibzugriff:** `profile show`, `preset list|show`, `session list|show`,
  `drink list`, `config get|list`. Alle anderen können über Auto-Close schreiben.

## Zeitangaben (`--at`, `--from`, `--to`, `--finished-at`)

Naive Zeiten gelten als **Europe/Berlin**. Ausgaben: Drinks/Sessions in UTC (`…Z`), berechnete Werte
(`now`, `at`, `sober_at`) in Berliner Ortszeit mit Offset.

| Eingabe | ergibt (am 30.10.2026) |
|---|---|
| `2026-10-30T20:15`, `2026-10-30 20:15`, `20:15`, `today 20:15` | 20:15 Berlin |
| `2026-10-30T19:15:00Z`, `2026-10-30T20:15:00+01:00` | 20:15 Berlin |
| `yesterday 21:00`, `30 minutes ago` | relativ (chrono-node, **nur Englisch**) |
| `gestern abend`, `2026-02-30T20:00` | **`BAD_TIME_FORMAT`** (Exit 1) |

Empfehlung für den Worker: Zeiten selbst auflösen und als ISO mit Offset übergeben.

`--duration` nimmt `30m`, `1h`, `90m` usw. (0 bis 24 h).

## Befehle

### Lesen

| Befehl | Ausgabe (gekürzt) |
|---|---|
| `profile show` | `{"weight_kg":70,"height_cm":186,"sex":"m","age":19,"preferred_formula":null,"weight_source":"estimated"}` |
| `preset list` | `{"items":[{"name":"augustiner","volume_ml":500,"abv":5.2,"created_at":"…"}, …],"count":8}` (alphabetisch) |
| `preset show <name>` | ein Preset-Objekt |
| `session list [--month YYYY-MM \| --year YYYY]` | `{"sessions":[{"id":14,"name":"Samstag Abend","started_at":"2026-05-30T15:30:00.000Z","ended_at":null,"stomach_initial":"some"}, …],"count":14}` (neueste zuerst) |
| `session show [--id N]` | aktive bzw. angegebene Session, sonst `SESSION_NOT_ACTIVE` |
| `drink list` | `{"drinks":[{"id":37,"session_id":14,"started_at":"…Z","finished_at":"…Z","volume_ml":500,"abv":5.2,"preset_name":"schoenbuch-jaeger","updated_at":null}, …],"count":30}` — **alle** Drinks, neueste zuerst, kein Filter |
| `config list` / `config get <key>` | `{"zones.sweet_spot_min":0.3}`; erlaubte Keys: `zones.sweet_spot_min`, `zones.sweet_spot_max`, `engine.default_formula`, `default_duration_minutes`, `auto_close_grace_minutes` |

### Rechnen

`status` (aktive Session, offener Drink):

```json
{"now":"2026-10-30T23:29:41.273+01:00","session_id":15,"session_name":"Test Freitag","bac_percent":0.013,
 "bac_promille":0.13,"trajectory":"rising","absorbing_drinks":1,"minutes_until_sober":194,
 "sober_at":"2026-10-31T02:43:41.273+01:00","zone":"below_sweet_spot","drinks_in_session":1,
 "stomach_state_now":"some","disclaimer":"estimate, not legally/medically valid",
 "bac_promille_ci95":[0.08,0.17],"ci_basis":"weight_estimated",
 "open_drinks":[{"drink_id":38,"started_at":"2026-10-30T21:54:41.000Z","elapsed_minutes":35,"drink_in_progress":true}]}
```

`status` ohne aktive Session:

```json
{"session_id":null,"session_name":null,"bac_promille":0,"bac_promille_ci95":[0,0],"ci_basis":"weight_estimated",
 "minutes_until_sober":0,"warnings":["no_active_session"],"disclaimer":"estimate, not legally/medically valid"}
```

`zone`: `sober` · `below_sweet_spot` · `sweet_spot` (ab 0,3 ‰) · `caution` · … ; `trajectory`: `rising` · `falling` · `stable`.
`auto_closed_drinks` in `status` listet nur Drinks, deren Ende mehr als 15 Min. zurückliegt (rein informativ, schreibt nichts).

| Befehl | Ausgabe |
|---|---|
| `bac --at <T>` | `{"at":"2026-10-30T20:30:00.000+01:00","bac_percent":0.052,"bac_promille":0.52,"zone":"sweet_spot","formula":"watson","disclaimer":"…","bac_promille_ci95":[0.32,0.72],"ci_basis":"weight_estimated"}` — braucht eine Session, die `T` umfasst |
| `sober` | `{"minutes_until_sober":341,"sober_at":"2026-10-31T05:10:42.022+01:00","disclaimer":"…"}` |
| `curve [--from T] [--to T] [--step Min] [--export svg]` | `{"curve":[{"at":"…+01:00","bac_promille":0.32,"bac_promille_ci95":[0.2,0.45],"zone":"sweet_spot"}, …],"drinks":[{"at":"…Z","label":"bier","volume_ml":500,"abv":5}],"meta":{"from":"…","to":"…","step_min":30,"points":4,"formula":"watson","ci_basis":"weight_estimated"},"disclaimer":"…"}`; mit `--export svg` kommt SVG (900×500) auf stdout. **Braucht eine aktive Session.** |
| `stats --all \| --month YYYY-MM \| --year YYYY \| --from T --to T` | `{"period":{…},"drinking_days":7,"dry_days":178,"current_dry_streak":153,"total_drinks":30,"total_sessions":13,"total_pure_alcohol_g":498.66,"avg_peak_promille":0.58,"max_session_promille":3.02,…,"by_preset":[{"name":"hoepfner","count":5,"total_volume_ml":2000,"total_pure_alcohol_g":75.74}, …]}` |

### Schreiben

| Befehl | Ausgabe |
|---|---|
| `session start [--name S] [--stomach empty\|some\|full] [--at T] [--force]` | `{"ok":true,"session_id":15}`; `--force` beendet eine aktive Session zum Zeitpunkt `T` |
| `session end [--at T]` | `{"ok":true,"session_id":15}` |
| `session stomach <state> [--at T]` | Magenzustand ab jetzt ändern |
| `session rename <id> --name S` | |
| `start <preset> [--at T] [--duration 30m] [--stomach …] [--force]` oder `start --vol ML --abv PCT …` | siehe unten |
| `stop [--at T]` | `{"drink_id":38,"finished_at":"2026-10-30T22:24:41.000Z","duration_secs":1800,"bac_at_stop_promille":0.17,"bac_projected_peak_promille":0.34,"bac_projected_peak_at":"2026-10-30T23:10:41.000Z","trajectory":"rising"}` |
| `add <preset> \| add --vol ML --abv PCT` + `[--at T] [--duration 20m] [--stomach …] [--session new --name S]` | siehe unten; ohne `--duration` = sofort getrunken |
| `drink rm <id>` | löscht einen Drink |
| `drink update --id N [--duration 30m] [--finished-at T]` | Ende/Dauer korrigieren |
| `preset set <name> --vol ML --abv PCT` / `preset rm <name>` | Name: `[a-z0-9_-]`, 1–32 Zeichen |
| `profile set --weight --height --sex m\|f\|o --age [--formula] [--weight-source measured\|estimated]` | |

`start augustiner --at "35 minutes ago"`:

```json
{"drink_id":38,"session_id":15,"started_at":"2026-10-30T21:54:41.000Z","finished_at":"2026-10-30T22:39:41.000Z",
 "duration_secs":2700,"volume_ml":500,"abv":5.2,"preset_name":"augustiner","stomach_state":"some",
 "bac_before_promille":0,"bac_projected_peak_promille":0.32,"bac_projected_peak_at":"2026-10-30T23:49:41.000Z",
 "projection_basis":"volume_default","drink_in_progress":true,"bac_after_promille":0.32,"default_duration_source":"volume_table"}
```

`add --vol 330 --abv 5.0 --duration 20m`:

```json
{"drink_id":39,"session_id":15,"started_at":"2026-10-30T22:29:41.691Z","finished_at":"2026-10-30T22:49:41.691Z",
 "volume_ml":330,"abv":5,"preset_name":null,"stomach_state":"some","bac_before_promille":0.22,
 "bac_projected_peak_promille":0.64,"bac_projected_peak_at":"2026-10-30T23:32:41.691Z","drink_in_progress":false,"bac_after_promille":0.64}
```

`bac_after_promille` ist ein veralteter Alias für `bac_projected_peak_promille`.

## Typische Abläufe für den Worker

**„Ich trinke jetzt ein Augustiner“**
1. `liver status` → `session_id` null? → `liver session start --name "<Wochentag> Abend"`.
2. `liver start augustiner` (offener Drink). Ist schon einer offen (`E_DRINK_ALREADY_OPEN`), war das
   wohl das Ende des vorigen: `liver start augustiner --force` (beendet den alten jetzt).
3. Später „fertig“ → `liver stop`.

**„Hatte um 20 Uhr ein Bier“** (nachtragen): `liver add bier --at 2026-10-30T20:00:00+01:00`. Liegt
der Zeitpunkt in keiner Session → `TIMESTAMP_OUTSIDE_SESSION`; dann
`liver add bier --at … --session new --name "Nachtrag"`. Achtung: Das beendet eine gerade aktive Session
zum Zeitpunkt `--at`, und die neue Session bleibt offen → danach `liver session end --at …` setzen.

**„Noch eins vom selben“**
1. `liver status` → aktive `session_id` (sonst Session starten oder nachfragen).
2. `liver drink list` → `drinks[0]` ist der zuletzt **begonnene** Drink (sortiert nach `started_at` absteigend, über alle Sessions).
   Nur verwenden, wenn `drinks[0].session_id` gleich der aktiven Session ist; sonst nachfragen, was es war.
3. `preset_name` gesetzt → `liver start <preset_name> --force` (bzw. `add <preset_name>` beim Nachtragen);
   sonst `liver start --vol <volume_ml> --abv <abv> --force`.
   `--force` beendet einen eventuell noch offenen vorigen Drink zum jetzigen Zeitpunkt.

**„Wie viel hab ich?“ / „Wann bin ich nüchtern?“** → `liver status` (`bac_promille`, `zone`, `sober_at`).

**„Welche Biere gab es heute?“** → `liver drink list` und nach `session_id` bzw. `started_at` filtern
(es gibt keinen Filter in der CLI).

**Abend beenden:** Nicht sofort `session end`, solange noch Alkohol im Blut ist: nach dem Ende einer
Session liefert `bac --at` für spätere Zeitpunkte `SESSION_NOT_ACTIVE`, und `curve` geht nur mit aktiver
Session. Besser offen lassen (Auto-Close setzt das Ende auf den Nüchtern-Zeitpunkt) oder
`liver session end --at <sober_at aus status>`.

## Fehler und Exit-Codes

Fehlerform (stdout, eine Zeile): `{"error":{"code":"…","message":"…","hint":"…","context":{…}}}` (`hint`/`context` optional).

| Exit | Bedeutung | Codes (**fett** = in einem echten Lauf gesehen) |
|---|---|---|
| 0 | ok | |
| 1 | Eingabefehler | **`UNKNOWN_PRESET`** (`add jaegermeister`), **`INVALID_VOLUME`** (auch bei fehlendem `--abv` oder Preset **und** `--vol`), **`INVALID_ABV`**, **`BAD_TIME_FORMAT`**, `INVALID_DURATION`, `INVALID_TIME_ORDER`, `INVALID_STOMACH_STATE`, `INVALID_PRESET_NAME`, **`PROFILE_MISSING`**; Commander: `error: unknown option '--frobnicate'` / `unknown command` (stderr, kein JSON) |
| 2 | Zustandsfehler | **`SESSION_ALREADY_ACTIVE`**, **`SESSION_NOT_ACTIVE`**, **`E_DRINK_ALREADY_OPEN`** (mit `context.drinkId`, `elapsedMin`), **`E_NO_OPEN_DRINK`**, **`TIMESTAMP_OUTSIDE_SESSION`**, **`DRINK_NOT_FOUND`** |
| 3 | intern | `DB_LOCKED` (wiederholen), `DATABASE_CORRUPTED`, `SCHEMA_MIGRATION_FAILED` (DB neuer als die CLI), `UNKNOWN_ERROR` (stderr) |
| 4 | Konfiguration | **`INVALID_CONFIG_KEY`**, `CONFIG_FILE_CORRUPT` |

## Bekannte Macken (Stand 30.10.2026, nicht behoben)

- **Alte offene Session:** In der echten DB ist Session 14 („Samstag Abend“, 30.05.2026) noch offen,
  weil Auto-Close nur greift, wenn der letzte Drink unter 24 h her ist. Folge: `status` meldet
  Session 14 als aktiv, `session start` scheitert mit `SESSION_ALREADY_ACTIVE`, `start`/`add` hängen
  neue Drinks an Session 14. Abhilfe (Philipp entscheidet): einmal
  `liver session end --at 2026-05-31T03:00` (BAC laut Kurve dann ≈ 0). Dasselbe passiert mit
  `add … --session new` für Nachträge, die mehr als 24 h zurückliegen.
  Worker-Regel: Ist die aktive Session älter als ~12 h und ihr letzter Drink lange vorbei, erst
  `session end --at …` setzen, dann neu starten.
- `bac_projected_peak_*` ist bei **rückdatierten** Drinks (`--at` weit in der Vergangenheit) falsch
  (0 ‰ zum Startzeitpunkt oder ein Peak „jetzt“). Bei Echtzeit-Eingaben plausibel. Für die UI besser
  `curve` verwenden.
- `sober --at <vergangener Zeitpunkt>` ignoriert den Zeitpunkt (gibt `minutes_until_sober: 0`).
- Wird ein Drink mit `start --at` rückdatiert und liegt das geschätzte Ende schon in der
  Vergangenheit, schließt der nächste Befehl die Session per Auto-Close, sobald der BAC jetzt 0 ist.
  `start`/`stop` sind für Echtzeit gedacht, Nachträge mit `add --at … --duration …` machen.
- `session end` setzt `ended_at` auch dann auf jetzt, wenn ein Drink noch „läuft“.
- `INVALID_VOLUME` erscheint auch, wenn nur `--abv` fehlt.
