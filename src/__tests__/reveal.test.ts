import { describe, test, expect } from 'vitest';
import { detectReveal } from '../reveal';
import type { UITube } from '../solver/types';

describe('detectReveal', () => {
  test('? が具体色へ変わったら true', () => {
    const oldTubes: UITube[] = [['A', '?', '', '']];
    const nextTubes: UITube[] = [['A', 'B', '', '']];
    expect(detectReveal(oldTubes, nextTubes)).toBe(true);
  });

  test('空セルへの初期入力は false', () => {
    const oldTubes: UITube[] = [['A', '', '', '']];
    const nextTubes: UITube[] = [['A', 'B', '', '']];
    expect(detectReveal(oldTubes, nextTubes)).toBe(false);
  });

  test('既知色の別色への訂正は false', () => {
    const oldTubes: UITube[] = [['A', 'B', '', '']];
    const nextTubes: UITube[] = [['A', 'C', '', '']];
    expect(detectReveal(oldTubes, nextTubes)).toBe(false);
  });

  test('変化なしは false', () => {
    const t: UITube[] = [['A', '?', '', '']];
    expect(detectReveal(t, t)).toBe(false);
  });

  test('? が空へ変わったら false', () => {
    const oldTubes: UITube[] = [['A', '?', '', '']];
    const nextTubes: UITube[] = [['A', '', '', '']];
    expect(detectReveal(oldTubes, nextTubes)).toBe(false);
  });
});
