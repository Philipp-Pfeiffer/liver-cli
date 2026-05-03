# liver

BAC tracking CLI

## Installation

```bash
npm install -g liver-cli
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