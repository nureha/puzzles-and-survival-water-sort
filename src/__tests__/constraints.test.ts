import { describe, test, expect } from 'vitest';
import { validateTubes } from '../solver/constraints';
import type { UITube } from '../solver/types';

describe('validateTubes', () => {
  test('returns null for valid fully-filled input', () => {
    const tubes: UITube[] = [
      ['A', 'B', 'A', 'B'],
      ['B', 'A', 'B', 'A'],
      ['', '', '', ''],
    ];
    expect(validateTubes(tubes)).toBeNull();
  });

  test('returns error message when a color appears more than 4 times', () => {
    const tubes: UITube[] = [
      ['A', 'A', 'A', 'A'],
      ['', '', '', 'A'], // empty at top (valid), A at bottom — 5th A total
      ['', '', '', ''],
    ];
    const result = validateTubes(tubes);
    expect(result).not.toBeNull();
    expect(result).toContain('A');
  });

  test('ignores ? and empty cells in count', () => {
    const tubes: UITube[] = [
      ['A', '?', '?', '?'],
      ['A', 'B', 'A', 'B'],
      ['', '', '', ''],
    ];
    expect(validateTubes(tubes)).toBeNull();
  });

  test('returns null for empty tube list', () => {
    expect(validateTubes([])).toBeNull();
  });

  test('returns error when non-empty cell appears after empty cell in same tube', () => {
    const tubes: UITube[] = [
      ['A', '', 'B', ''],
      ['', '', '', ''],
    ];
    const result = validateTubes(tubes);
    expect(result).not.toBeNull();
  });

  test('returns null for valid partial tube (empty at top, colors at bottom)', () => {
    const tubes: UITube[] = [
      ['', '', 'A', 'B'],
      ['', '', '', ''],
    ];
    expect(validateTubes(tubes)).toBeNull();
  });
});
