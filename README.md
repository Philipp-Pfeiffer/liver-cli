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

## Testing

```bash
pnpm test          # all tests
pnpm test:bands    # Suite B — validates engine against peer-reviewed pharmacokinetic literature (Spec §1.6)
```

## Disclaimer

All BAC calculations are estimates and not legally or medically valid.