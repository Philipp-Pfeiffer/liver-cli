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