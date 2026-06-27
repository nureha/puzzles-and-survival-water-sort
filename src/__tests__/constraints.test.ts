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
      ['A', '', '', ''],
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
});
