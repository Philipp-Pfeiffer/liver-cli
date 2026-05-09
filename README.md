# liver — BAC Tracking CLI

> ⚠️ **v0.2.0 has critical BAC calculation bugs.** Use **v0.2.1** or **v0.1.2** until resolved.

A command-line tool for tracking Blood Alcohol Concentration (BAC) over time. Supports sessions, presets, statistics, and SVG export of BAC curves.

## Installation

```bash
npm install -g liver-cli
```

## Setup

```bash
# Set your profile (required before using other commands)
liver profile set --weight 78 --height 184 --sex m --age 22

# Save drink presets
liver preset set augustiner --vol 500 --abv 5.2
liver preset set shot --vol 40 --abv 40
```

## Commands

### Profile

| Command | Description |
|---------|-------------|
| `liver profile set [options]` | Set your profile |
| `liver profile show` | Show current profile |

**`profile set` options:**
- `--weight <kg>` — Weight in kg (30–250)
- `--height <cm>` — Height in cm (120–230)
- `--sex <m\|f\|o>` — Sex (male/female/other)
- `--age <n>` — Age (16–120)
- `--formula <watmark\|watson>` — Preferred BAC formula
- `--weight-source <measured\|estimated>` — Weight source (default: `estimated`)

> `--weight-source` (default: `estimated`) gibt an, ob das `--weight` Profil-Gewicht
> per Waage gemessen (`measured`) oder geschätzt (`estimated`) wurde. Der Wert steuert
> die Breite der 95%-Konfidenzintervalle auf BAC-Outputs (CV 0.11 vs. 0.19, ±22% vs. ±37%).
> Bei `estimated` wird `liver --human` einen `⚠ Gewicht geschätzt`-Prefix vor BAC-Werten anzeigen.
> Quelle: ADR-003 §4 (Maskell & Cooper 2020).

### Preset

| Command | Description |
|---------|-------------|
| `liver preset set <name>` | Create/update a drink preset |
| `liver preset list` | List all presets |
| `liver preset show <name>` | Show a preset |
| `liver preset rm <name>` | Remove a preset |

**`preset set` options:**
- `--vol <ml>` — Volume in ml (0–5000)
- `--abv <pct>` — ABV in percent (0–100)

### Session

| Command | Description |
|---------|-------------|
| `liver session start [options]` | Start a drinking session |
| `liver session end [options]` | End current session |
| `liver session show` | Show current session |
| `liver session list [options]` | List sessions |
| `liver session stomach <state>` | Set stomach state |
| `liver session rename <id>` | Rename a session |

**`session start` options:**
- `--name <str>` — Session name
- `--stomach <empty\|some\|full>` — Initial stomach state (default: some)

**`session stomach` options:**
- `--at <T>` — Backdated time

### Drinks

| Command | Description |
|---------|-------------|
| `liver add [preset] [options]` | Add a drink |
| `liver start [preset] [options]` | Start drinking (adds a running drink) |
| `liver stop [options]` | Stop current drink |
| `liver drink list` | List all drinks |
| `liver drink rm <id>` | Remove a drink |

**`add` / `start` options:**
- `--vol <ml>` — Volume in ml
- `--abv <pct>` — ABV in percent
- `--at <T>` — Time (default: now)
- `--duration <Xm\|Xh>` — Drink duration (e.g. `25m`)
- `--stomach <empty\|some\|full>` — Stomach state at time of drink
- `--session new` — Create new session for backdated drink

**`stop` options:**
- `--at <T>` — Stop time

### BAC Status

| Command | Description |
|---------|-------------|
| `liver status` | Current BAC status |
| `liver bac [options]` | BAC at specific time |
| `liver curve [options]` | BAC curve over time |
| `liver sober [options]` | Time until sober |

**`bac` options:**
- `--at <T>` — Time to check BAC for

**`curve` options:**
- `--from <T>` — Start time (default: session start)
- `--to <T>` — End time (default: sober time)
- `--step <minutes>` — Step in minutes (default: 5)
- `--export svg` — Export as SVG

**`sober` options:**
- `--at <T>` — Time to calculate from

### Statistics

| Command | Description |
|---------|-------------|
| `liver stats [options]` | Drinking statistics |

**`stats` options:**
- `--month <YYYY-MM>` — Specific month
- `--year <YYYY>` — Specific year
- `--from <T>` — From date
- `--to <T>` — To date
- `--all` — All time (default: last 30 days)

### Config

| Command | Description |
|---------|-------------|
| `liver config set <key> <value>` | Set config value |
| `liver config get <key>` | Get config value |
| `liver config list` | List all config |

**Config keys:**
- `zones.sweet_spot_min` — Sweet spot minimum (default: 0.4 ‰)
- `zones.sweet_spot_max` — Sweet spot maximum (default: 0.8 ‰)
- `engine.default_formula` — Default formula (default: watson)

### Global Options

| Option | Description |
|--------|-------------|
| `-V, --version` | Output version |
| `--human` | Human-readable output |
| `--no-color` | Disable colors |
| `-v, --verbose` | Verbose logging |
| `--formula <watson\|widmark>` | BAC formula override |

## Output Formats

### JSON (Default)

All commands output structured JSON to stdout by default. Use `--human` for a condensed text representation.

**BAC-emittierende Commands** (`status`, `bac`, `curve`, `sober`, `stats`) enthalten ab v0.3.0 zusätzlich Konfidenzintervalle:

```json
{
  "bac_promille": 0.42,
  "bac_promille_ci95": [0.33, 0.51],
  "ci_basis": "weight_measured"
}
```

- `bac_promille_ci95` — 95% Konfidenzintervall als `[low, high]` Tupel
- `ci_basis` — `weight_measured` oder `weight_estimated`, je nach `profile.weight_source`

Die Intervalle verwenden CV = 0.11 für `measured` und CV = 0.19 für `estimated` (Maskell & Cooper 2020).

### SVG Export

`liver curve` can render the BAC curve as a standalone SVG:

```bash
liver curve --export svg > meine-kurve.svg
liver curve --from "20:00" --to "01:00" --step 5m --export svg > abend.svg
```

The SVG is:
- **Valid XML** — viewable directly in browsers, Markdown viewers, or via `xmllint`
- **Resolution-independent** — no pixel density to choose
- **Dependency-free** — no additional tools or `node_modules` calls needed

**Visualized:**
- BAC curve over time (blue line)
- Zone background bands: Below Sweet Spot (green), Sweet Spot (yellow), Caution (orange), Danger (red)
  — configured via `liver config set zones.sweet_spot_min/max`
- Drink markers as dashed vertical lines with labels
- Peak annotation (red dot + value)
- X-axis in local time (Europe/Berlin), Y-axis in ‰
- Disclaimer and zone legend

**Limits:**
- Curve cap from §10.3 applies: `(to − from) / step ≤ 1000` points, otherwise `CURVE_TOO_LARGE`.

**Available since:** v0.2.0.

An example output is available at [`docs/samples/curve-example.svg`](docs/samples/curve-example.svg).

## Examples

### Track a drinking session

```bash
# Start session
liver session start --name "Friday Night" --stomach full

# Add drinks
liver add augustiner              # instant
liver add augustiner --duration 25m
liver session stomach some       # stomach emptying
liver start shot                  # running drink
liver stop                       # stop it

# Check status
liver status
liver curve --from 19:30 --step 5m

# End session
liver session end
```

### Backdated logging

```bash
liver add bier --at "yesterday 21:00" --session new --name "Yesterday"
```

## Testing

```bash
pnpm test          # all tests
pnpm test:bands    # Suite B — validates engine against peer-reviewed pharmacokinetic literature (Spec §1.6)
```

## Timezone Handling

All naive timestamps (without explicit timezone offset) are interpreted as **Europe/Berlin** time. This applies to all `--at`, `--from`, and `--to` options across commands.

Examples:
- `liver add bier --at "2026-05-08T21:00"` → interpreted as 21:00 CEST/CET
- `liver bac --at "2026-05-08T21:00+02:00"` → interpreted as explicit +02:00 offset

DST transitions are validated: non-existent times (e.g., `2026-03-29T02:30` during spring forward) are rejected with a clear error.

## Disclaimer

All BAC calculations are estimates and not legally or medically valid. Use responsibly.