# Phase 11: Output Formatting

## Ziel
JSON-Output, Human-Readable Tabellen, Farben, Logging implementieren.

## Schritt 11.1: Output Formatter implementieren

Erstelle `/home/p-pfeiffer/dev/liver-cli/src/output/index.ts`:

```typescript
import type { LiverError } from '../errors/index.js';

export interface OutputOptions {
  human?: boolean;
  noColor?: boolean;
  verbose?: boolean;
}

let colorEnabled = true;
let verboseEnabled = false;

export function configureOutput(options: OutputOptions): void {
  // Auto-detect TTY
  colorEnabled = !options.noColor && !process.env.NO_COLOR && process.stdout.isTTY;
  verboseEnabled = options.verbose || process.env.LIVER_DEBUG === '1';
}

function color(text: string, code: string): string {
  if (!colorEnabled) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

export const red = (text: string) => color(text, '31');
export const green = (text: string) => color(text, '32');
export const yellow = (text: string) => color(text, '33');
export const blue = (text: string) => color(text, '34');
export const bold = (text: string) => color(text, '1');

export function logVerbose(message: string): void {
  if (verboseEnabled) {
    console.error(`[verbose] ${message}`);
  }
}

export function logDebug(message: string): void {
  if (process.env.LIVER_DEBUG === '1') {
    console.error(`[debug] ${message}`);
  }
}

export function outputSuccess(data: Record<string, unknown>, options: OutputOptions): void {
  if (options.human) {
    console.error(formatHuman(data));
  } else {
    console.log(JSON.stringify(data));
  }
}

export function outputError(error: LiverError, options: OutputOptions): void {
  if (options.human) {
    const message = red(`✘ ERROR: ${error.message}`);
    const hint = error.hint ? `\n  → ${error.hint}` : '';
    console.error(`${message}${hint}`);
  } else {
    console.log(JSON.stringify(error.toJSON()));
  }
}

function formatHuman(data: Record<string, unknown>): string {
  // Simple human formatter - can be enhanced
  return Object.entries(data)
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return `${bold(key)}:\n${value.map(v => `  - ${JSON.stringify(v)}`).join('\n')}`;
      }
      return `${bold(key)}: ${JSON.stringify(value)}`;
    })
    .join('\n');
}

export function formatTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return '';
  
  const colWidths = headers.map((h, i) => {
    const maxData = Math.max(...rows.map(r => (r[i] ?? '').length));
    return Math.max(h.length, maxData);
  });
  
  const formatRow = (cells: string[]) =>
    cells.map((c, i) => (c ?? '').padEnd(colWidths[i]!)).join('  ');
  
  const lines = [
    bold(formatRow(headers)),
    headers.map((_, i) => '-'.repeat(colWidths[i]!)).join('  '),
    ...rows.map(formatRow),
  ];
  
  return lines.join('\n');
}
```

## Schritt 11.2: Output Tests

Erstelle `/home/p-pfeiffer/dev/liver-cli/tests/unit/output.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { configureOutput, formatTable, red, green } from '../../src/output/index.js';

describe('output formatting', () => {
  it('should format table', () => {
    const table = formatTable(
      ['Name', 'Volume', 'ABV'],
      [
        ['Augustiner', '500', '5.2'],
        ['Shot', '40', '40.0'],
      ],
    );
    
    expect(table).toContain('Name');
    expect(table).toContain('Augustiner');
    expect(table).toContain('500');
  });
  
  it('should handle empty table', () => {
    const table = formatTable(['Name'], []);
    expect(table).toBe('');
  });
  
  it('should disable colors with noColor', () => {
    configureOutput({ noColor: true });
    const text = red('test');
    expect(text).toBe('test');
    expect(text).not.toContain('\x1b[');
  });
});
```

## Schritt 11.3: Tests ausführen

```bash
npm run test
```

## Erfolgskriterien

- [ ] JSON-Output ist valide
- [ ] `--human` gibt lesbare Ausgabe
- [ ] `--no-color` deaktiviert Farben
- [ ] `NO_COLOR=1` deaktiviert Farben
- [ ] `--verbose` schreibt Logs auf stderr
- [ ] `LIVER_DEBUG=1` schreibt Debug-Logs
- [ ] stdout enthält nur JSON (außer `--human`)
- [ ] stderr enthält Logs
- [ ] Tests passen
- [ ] Lint ist sauber

## Nächste Phase

**Phase 12: CLI Integration** (`12-cli-integration.md`)
