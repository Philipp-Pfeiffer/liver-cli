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

function formatHuman(data: Record<string, unknown>): string {
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