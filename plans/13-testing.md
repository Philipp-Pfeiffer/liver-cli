# Phase 13: Testing

## Ziel
Umfassende Testabdeckung für alle Komponenten sicherstellen.

## Schritt 13.1: Unit Tests vervollständigen

Stelle sicher, dass folgende Test-Dateien existieren und alle Tests passen:

- `tests/unit/db.test.ts` - DB Schema und Constraints
- `tests/unit/time.test.ts` - Zeit-Parsing und Formatierung
- `tests/unit/config.test.ts` - Config Management
- `tests/unit/errors.test.ts` - Error-Klassen und Validierung
- `tests/unit/profile.test.ts` - Profile Commands
- `tests/unit/preset.test.ts` - Preset Commands
- `tests/unit/session.test.ts` - Session Management
- `tests/unit/drink.test.ts` - Drink Management
- `tests/unit/compute.test.ts` - BAC Berechnung
- `tests/unit/stats.test.ts` - Stats Aggregation
- `tests/unit/output.test.ts` - Output Formatierung

## Schritt 13.2: Integration Tests erweitern

Erstelle `/home/p-pfeiffer/dev/liver-cli/tests/integration/workflow.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const LIVER_DB = join(homedir(), '.liver', 'db.sqlite');

function run(cmd: string): Record<string, unknown> {
  const result = execSync(`node dist/index.js ${cmd}`, { encoding: 'utf-8' });
  return JSON.parse(result);
}

describe('full workflow', () => {
  beforeEach(() => {
    if (existsSync(LIVER_DB)) {
      rmSync(LIVER_DB);
    }
  });
  
  it('should complete typical evening workflow', () => {
    // Setup
    run('profile set --weight 78 --height 184 --sex m --age 22');
    run('preset save augustiner --vol 500 --abv 5.2');
    run('preset save shot --vol 40 --abv 40');
    
    // Session
    const session = run('session start --name "Maibock" --stomach full');
    expect(session.session_id).toBeGreaterThan(0);
    
    // Drinks
    const drink1 = run('add augustiner');
    expect(drink1.drink_id).toBeGreaterThan(0);
    
    const drink2 = run('add augustiner --duration 25m');
    expect(drink2.drink_id).toBeGreaterThan(drink1.drink_id as number);
    
    // Stomach switch
    run('session stomach some');
    
    // Start/Stop
    const start = run('start shot');
    expect(start.drink_id).toBeGreaterThan(0);
    
    const stop = run('stop');
    expect(stop.drink_id).toBe(start.drink_id);
    
    // Status
    const status = run('status');
    expect(status.bac_promille).toBeGreaterThan(0);
    expect(status.disclaimer).toBeDefined();
    
    // Sober
    const sober = run('sober');
    expect(sober.minutes_until_sober).toBeGreaterThan(0);
    
    // End session
    run('session end');
    
    // Stats
    const stats = run('stats');
    expect(stats.total_drinks).toBe(3);
    expect(stats.total_sessions).toBe(1);
  });
  
  it('should handle errors correctly', () => {
    // No profile
    expect(() => run('status')).toThrow();
    
    // Setup
    run('profile set --weight 78 --height 184 --sex m --age 22');
    
    // No active session
    expect(() => run('status')).toThrow();
    
    // Unknown preset
    expect(() => run('add unknown')).toThrow();
  });
  
  it('should auto-close sessions', () => {
    run('profile set --weight 78 --height 184 --sex m --age 22');
    run('preset save beer --vol 500 --abv 5');
    
    const session = run('session start');
    run('add beer');
    run('session end');
    
    // New session should work
    const session2 = run('session start');
    expect(session2.session_id).not.toBe(session.session_id);
  });
});
```

## Schritt 13.3: Test-Fixtures

Erstelle `/home/p-pfeiffer/dev/liver-cli/tests/fixtures/profile.json`:

```json
{
  "weight_kg": 78,
  "height_cm": 184,
  "sex": "m",
  "age": 22,
  "preferred_formula": "watson"
}
```

## Schritt 13.4: Test-Runner konfigurieren

Erstelle `/home/p-pfeiffer/dev/liver-cli/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
```

## Schritt 13.5: Tests ausführen

```bash
npm run test
```

## Erfolgskriterien

- [ ] Alle Unit-Tests passen
- [ ] Alle Integration-Tests passen
- [ ] Testabdeckung > 80% für Commands und Engine
- [ ] Keine flaky Tests
- [ ] Tests sind isoliert (keine DB-Leaks)

## Nächste Phase

**Phase 14: CI & Release** (`14-ci-release.md`)
