# Engine Physiology Notes

## Overview

liver-cli uses the ethanol-rs WASM engine, which models alcohol pharmacokinetics with first-order absorption (ka) and first-order elimination (β). This differs from static Widmark/Watson estimates in important ways.

## Why Engine BAC differs from Widmark

### Absorption Lag

Widmark assumes instantaneous distribution. The engine models absorption as a first-order process with rate ka. For low-volume / quick drinks, this means:

- Peak BAC arrives ~25-45 min after consumption (ka_some ≈ 2.5/h, ka_empty ≈ 4.0/h)
- Peak BAC is LOWER than Widmark estimate because elimination begins during absorption

### Example: 500ml × 2.5% (Real-World C5 Case)

- 9.86 g ethanol
- Widmark (80kg, r=0.68): peak ≈ 0.181‰
- Engine (some stomach, ka=2.5/h, β=0.15/h): peak ≈ 0.12‰
- Ratio: ~0.66 — physiologically expected for short-bolus drinks

## When Engine and Widmark Diverge Most

- Short drinks (<10 min) with low volume
- Empty stomach (faster ka, less divergence)
- High elimination rate profiles

## When They Converge

- Long drinks (>1h) → engine peak approaches Widmark
- Multiple drinks over time → cumulative effect dominates over absorption-lag

## Test Suite C Bands

Suite C bands [0.10, 0.30]‰ for C5 are wide enough to accommodate this physiological reality. They catch factor-2+ bugs without flagging legitimate physiological behavior.

## References

- Widmark, E.M.P. (1932). Die theoretischen Grundlagen und die praktische Verwendbarkeit der gerichtlich-medizinischen Alkoholbestimmung.
- Watson, P.E. et al. (1981). Total body water volumes for adult males and females estimated from simple anthropometric measurements.
- Jones, A.W. (2010). Evidence-based survey of the elimination rates of ethanol from blood with applications in forensic casework.
