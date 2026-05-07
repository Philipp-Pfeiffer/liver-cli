# Migration v0.1.x → v0.2.0

## Übersicht

v0.2.0 führt Active Drink Modeling ein. Die wichtigste Änderung für API-Consumer ist das Property-Renaming im JSON-Output.

## Mapping-Tabelle

| v0.1.x Feld | v0.2.0 Ersatz | Bemerkung |
|-------------|---------------|-----------|
| `bac_after_promille` | `bac_projected_peak_promille` | `bac_after` ist deprecated, Wert identisch |
| — | `bac_before_promille` | Neu: BAC vor dem Drink |
| — | `bac_projected_peak_at` | Neu: ISO-Timestamp des Peak |
| — | `bac_at_stop_promille` | Neu: nur in `stop`-Response |
| — | `drink_in_progress` | Neu: boolean |
| — | `projection_basis` | Neu: `"planned_duration"` \| `"volume_default"` \| `"finalized"` |
| — | `default_duration_source` | Neu: `"volume_table"` \| `"config_override"` \| `"fallback_20min"` |
| — | `absorbing_drinks` | Neu: int, aus Engine |
| — | `trajectory` | Neu: `"rising"` \| `"falling"` \| `"stable"` |
| — | `auto_closed_drinks` | Neu: in `status`-Response |
| — | `force_closed_drinks` | Neu: in `start --force`-Response |

## Breaking Changes

1. **`start` ohne `--duration`** setzt jetzt eine volume-basierte Default-Duration (z.B. 45min für 0.5L Bier). Vorher war `finished_at = NULL`.
2. **`bac_after_promille`** ist deprecated. Der Wert ist jetzt `bac_projected_peak_promille` statt BAC zum Startzeitpunkt.
3. **Single-Open-Drink-Rule**: Zweites `start` ohne `stop` wirft `E_DRINK_ALREADY_OPEN` statt `DRINK_ALREADY_RUNNING`.

## CLI-Changes

- `liver start` ohne `--duration` → nutzt Volume-Tabelle
- `liver start --force` → erlaubt Überschreiben des laufenden Drinks
- `liver drink update --id <ID> --duration 60m` → nachträgliche Korrektur
- `liver config set default_duration_minutes 30` → globaler Default
- `liver config set auto_close_grace_minutes 10` → Grace-Period für Auto-Close

## Rückwärts-Kompatibilität

- `bac_after_promille` ist noch im Response enthalten (Alias)
- `finished_at = null` wird von v0.1.x-DBs weiterhin unterstützt (Adapter-Logik)
