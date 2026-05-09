import type { LiverError } from '../errors/index.js';

export interface OutputOptions {
  human?: boolean;
  noColor?: boolean;
  verbose?: boolean;
}

let colorEnabled = true;
let verboseEnabled = false;

export function configureOutput(options: OutputOptions): void {
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

function formatBACHuman(data: Record<string, unknown>): string | undefined {
  const bac = data.bac_promille as number | undefined;
  const ci = data.bac_promille_ci95 as [number, number] | undefined;
  const basis = data.ci_basis as string | undefined;

  if (bac !== undefined && ci !== undefined) {
    const [lo, hi] = ci;
    const warning = basis === 'weight_estimated' ? '⚠ Gewicht geschätzt – ' : '';
    return `${warning}BAC: ${bac.toFixed(2)} ‰  (95% KI: ${lo.toFixed(2)}–${hi.toFixed(2)})`;
  }
  return undefined;
}

function formatHuman(data: Record<string, unknown>): string {
  const bacLine = formatBACHuman(data);
  const skipKeys = new Set<string>();
  if (bacLine) {
    skipKeys.add('bac_percent');
    skipKeys.add('bac_promille_ci95');
    skipKeys.add('ci_basis');
  }

  const lines = Object.entries(data)
    .filter(([key]) => !skipKeys.has(key))
    .map(([key, value]) => {
      if (key === 'bac_promille' && bacLine) {
        return bacLine;
      }
      if (Array.isArray(value)) {
        return `${bold(key)}:\n${value.map(v => `  - ${JSON.stringify(v)}`).join('\n')}`;
      }
      return `${bold(key)}: ${JSON.stringify(value)}`;
    });

  return lines.join('\n');
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

export { outputSVG, type SVGCurveData } from './svg.js';
