import { describe, test, expect } from 'vitest';
import { formatTubes } from '../report/formatBoard';
import type { UITube } from '../solver/types';

describe('formatTubes', () => {
  test('空のチューブは「空」と表示する', () => {
    const tubes: UITube[] = [['', '', '', '']];
    expect(formatTubes(tubes)).toBe('空');
  });

  test('入っている色を上から順に連結する', () => {
    const tubes: UITube[] = [['A', 'B', '', '']];
    expect(formatTubes(tubes)).toBe('AB');
  });

  test('複数チューブをカンマ区切りで連結する', () => {
    const tubes: UITube[] = [
      ['A', 'B', '', ''],
      ['', '', '', ''],
      ['C', 'D', 'C', 'D'],
    ];
    expect(formatTubes(tubes)).toBe('AB, 空, CDCD');
  });
});
