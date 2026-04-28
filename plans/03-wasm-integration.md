# Phase 3: WASM Integration

## Ziel
ethanol-rs als Vendored WASM einbinden, Adapter-Layer implementieren.

## WICHTIG
Diese Phase setzt voraus, dass du ethanol-rs WASM-Build-Output hast. Da wir von Grund auf neu bauen:

### Option A (Empfohlen): Stub-Engine
Implementiere zunächst einen TypeScript-Stub der Engine, der die gleiche API hat wie ethanol-rs. Später wird dieser gegen WASM ersetzt.

### Option B: ethanol-rs klonen und bauen
Nur wenn du Rust-Toolchain hast und den echten WASM-Build machen willst.

## Schritt 3.1: Engine-Interface definieren

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/engine/types.ts`:

```typescript
export type Sex = 'male' | 'female';
export type BACFormula = 'watson' | 'widmark';

export interface ProfileParams {
  weightKg: number;
  heightCm: number;
  sex: Sex;
  age: number;
}

export interface DrinkParams {
  volumeMl: number;
  abv: number;  // Fraction (0.0-1.0)
  durationMinutes: number;
}

export interface DrinkInput extends DrinkParams {
  startedAtMinutesAgo: number;
  stomachFullness: 'empty' | 'some' | 'full';
}

export interface BACResult {
  bacPercent: number;
  minutesUntilSober: number;
}

export interface CurvePoint {
  offsetMinutes: number;
  bacPercent: number;
}

export interface CurveResult {
  points: CurvePoint[];
}
```

## Schritt 3.2: Stub-Engine implementieren

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/engine/stub.ts`:

```typescript
import type {
  ProfileParams,
  DrinkInput,
  BACResult,
  CurveResult,
  BACFormula,
} from './types.js';

// Simplifizierter Widmark als Stub
export function calculateBAC(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
  nowOffsetMinutes: number,
): number {
  if (drinks.length === 0) return 0;
  
  // R-Faktor (Widmark-ähnlich)
  const r = profile.sex === 'female' ? 0.55 : 0.68;
  const bodyWater = profile.weightKg * r;
  
  let totalAlcohol = 0;
  for (const drink of drinks) {
    const alcoholGrams = drink.volumeMl * drink.abv * 0.789;
    totalAlcohol += alcoholGrams;
  }
  
  // Absorption: vereinfacht
  const absorbed = totalAlcohol * 0.9;
  const bacPercent = absorbed / (bodyWater * 10);
  
  // Abbau: ~0.15‰ pro Stunde = 0.015% pro Stunde
  const elapsedHours = nowOffsetMinutes / 60;
  const eliminated = elapsedHours * 0.015;
  
  const result = Math.max(0, bacPercent - eliminated);
  return result;
}

export function minutesUntilSober(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
): number {
  const currentBAC = calculateBAC(profile, drinks, formula, 0);
  // 0.015% pro Stunde abbauen
  const hours = currentBAC / 0.015;
  return Math.ceil(hours * 60);
}

export function generateCurve(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
  fromOffsetMinutes: number,
  toOffsetMinutes: number,
  stepMinutes: number,
  sweetSpotMin: number,
  sweetSpotMax: number,
): CurveResult {
  const points = [];
  for (let offset = fromOffsetMinutes; offset <= toOffsetMinutes; offset += stepMinutes) {
    const bacPercent = calculateBAC(profile, drinks, formula, -offset);
    points.push({ offsetMinutes: offset, bacPercent });
  }
  return { points };
}
```

## Schritt 3.3: Engine-Adapter implementieren

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/engine/index.ts`:

```typescript
import type {
  ProfileParams,
  DrinkInput,
  BACResult,
  CurveResult,
  BACFormula,
} from './types.js';
import {
  calculateBAC as stubCalculateBAC,
  minutesUntilSober as stubMinutesUntilSober,
  generateCurve as stubGenerateCurve,
} from './stub.js';

// Später wird hier der WASM-Import stehen
// import * as wasm from '../../vendor/ethanol-rs/pkg/ethanol_rs.js';

export function calculateBACAtOffset(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
  offsetMinutes: number,
): number {
  return stubCalculateBAC(profile, drinks, formula, offsetMinutes);
}

export function getMinutesUntilSober(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
): number {
  return stubMinutesUntilSober(profile, drinks, formula);
}

export function getCurve(
  profile: ProfileParams,
  drinks: DrinkInput[],
  formula: BACFormula,
  fromOffset: number,
  toOffset: number,
  stepMinutes: number,
  sweetMin: number,
  sweetMax: number,
): CurveResult {
  return stubGenerateCurve(
    profile, drinks, formula,
    fromOffset, toOffset, stepMinutes,
    sweetMin, sweetMax,
  );
}

export function resolveFormula(
  profileFormula: BACFormula | null | undefined,
  overrideFormula: BACFormula | undefined,
): BACFormula {
  return overrideFormula ?? profileFormula ?? 'watson';
}
```

## Schritt 3.4: Engine-Tests

Erstelle `/home/p-pfeiffer/dev/liver-cli/tests/unit/engine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateBACAtOffset, getMinutesUntilSober, resolveFormula } from '../../src/engine/index.js';
import type { ProfileParams, DrinkInput } from '../../src/engine/types.js';

const profile: ProfileParams = {
  weightKg: 78,
  heightCm: 184,
  sex: 'male',
  age: 22,
};

const drink: DrinkInput = {
  volumeMl: 500,
  abv: 0.052,
  durationMinutes: 0,
  startedAtMinutesAgo: 60,
  stomachFullness: 'full',
};

describe('engine', () => {
  it('should calculate BAC > 0 after drinking', () => {
    const bac = calculateBACAtOffset(profile, [drink], 'watson', 0);
    expect(bac).toBeGreaterThan(0);
  });
  
  it('should calculate decreasing BAC over time', () => {
    const bacNow = calculateBACAtOffset(profile, [drink], 'watson', 0);
    const bacLater = calculateBACAtOffset(profile, [drink], 'watson', 120);
    expect(bacLater).toBeLessThan(bacNow);
  });
  
  it('should return 0 BAC when sober', () => {
    const bac = calculateBACAtOffset(profile, [], 'watson', 0);
    expect(bac).toBe(0);
  });
  
  it('should compute minutes until sober', () => {
    const mins = getMinutesUntilSober(profile, [drink], 'watson');
    expect(mins).toBeGreaterThan(0);
  });
  
  it('should resolve formula correctly', () => {
    expect(resolveFormula('watson', undefined)).toBe('watson');
    expect(resolveFormula('widmark', undefined)).toBe('widmark');
    expect(resolveFormula(undefined, 'widmark')).toBe('widmark');
    expect(resolveFormula('watson', 'widmark')).toBe('widmark');
    expect(resolveFormula(null, undefined)).toBe('watson');
  });
});
```

## Schritt 3.5: Tests ausführen

```bash
npm run test
```

## Erfolgskriterien

- [ ] Engine-Interface ist definiert
- [ ] Stub-Engine berechnet BAC > 0 nach Drink
- [ ] BAC nimmt mit der Zeit ab
- [ ] Leere Drink-Liste = BAC 0
- [ ] Formula-Resolution funktioniert
- [ ] Tests passen
- [ ] Lint ist sauber

## Nächste Phase

**Phase 4: Time & Config** (`04-time-and-config.md`)
