import { describe, test, expect } from 'vitest';
import type { PuzzleState } from '../solver/types';
import {
  topColor,
  topConsecutiveCount,
  emptySlots,
  isValidMove,
  applyMove,
  isGoal,
  stateKey,
} from '../solver/bfs';

describe('topColor', () => {
  test('returns the top (last) element of a non-empty tube', () => {
    expect(topColor(['B', 'A'])).toBe('A');
  });
  test('returns null for an empty tube', () => {
    expect(topColor([])).toBeNull();
  });
  test('returns the sole element of a single-element tube', () => {
    expect(topColor(['A'])).toBe('A');
  });
});

describe('topConsecutiveCount', () => {
  test('returns 1 when top is unique', () => {
    expect(topConsecutiveCount(['B', 'A'])).toBe(1);
  });
  test('counts multiple consecutive same colors from top', () => {
    expect(topConsecutiveCount(['B', 'A', 'A'])).toBe(2);
  });
  test('returns tube length when all same color', () => {
    expect(topConsecutiveCount(['A', 'A', 'A', 'A'])).toBe(4);
  });
  test('returns 0 for empty tube', () => {
    expect(topConsecutiveCount([])).toBe(0);
  });
});

describe('emptySlots', () => {
  test('returns 4 for empty tube', () => {
    expect(emptySlots([])).toBe(4);
  });
  test('returns 0 for full tube', () => {
    expect(emptySlots(['A', 'A', 'A', 'A'])).toBe(0);
  });
  test('returns 2 for two-element tube', () => {
    expect(emptySlots(['A', 'B'])).toBe(2);
  });
});

describe('isValidMove', () => {
  test('allows move to an empty tube', () => {
    expect(isValidMove([['B', 'A'], []], 0, 1)).toBe(true);
  });
  test('allows move when destination top matches source top', () => {
    expect(isValidMove([['B', 'A'], ['A']], 0, 1)).toBe(true);
  });
  test('rejects move when colors differ', () => {
    expect(isValidMove([['B', 'A'], ['B']], 0, 1)).toBe(false);
  });
  test('rejects move when destination lacks space for all consecutive layers', () => {
    // src: ['B','A','A'] – 2 A's on top; dst: ['C','C','C','A'] – top=A, 0 empty slots
    expect(isValidMove([['B', 'A', 'A'], ['C', 'C', 'C', 'A']], 0, 1)).toBe(false);
  });
  test('rejects self-move', () => {
    expect(isValidMove([['A'], ['B']], 0, 0)).toBe(false);
  });
  test('rejects move from empty tube', () => {
    expect(isValidMove([[], ['B', 'A']], 0, 1)).toBe(false);
  });
  test('rejects move where source top is ?', () => {
    // Internal: ['A', '?'] means bottom=A, top=? — ? on top
    expect(isValidMove([['A', '?'], ['B']], 0, 1)).toBe(false);
  });
  test('rejects move into tube where destination top is ?', () => {
    expect(isValidMove([['A'], ['A', '?']], 0, 1)).toBe(false);
  });
});

describe('applyMove', () => {
  test('moves single top layer to empty tube', () => {
    const next = applyMove([['B', 'A'], []], 0, 1);
    expect(next[0]).toEqual(['B']);
    expect(next[1]).toEqual(['A']);
  });
  test('moves multiple consecutive top layers together', () => {
    const next = applyMove([['B', 'A', 'A'], []], 0, 1);
    expect(next[0]).toEqual(['B']);
    expect(next[1]).toEqual(['A', 'A']);
  });
  test('does not mutate the original state', () => {
    const state: PuzzleState = [['B', 'A'], []];
    const snapshot = JSON.stringify(state);
    applyMove(state, 0, 1);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('isGoal', () => {
  test('all full single-color tubes is a goal', () => {
    expect(isGoal([['A', 'A', 'A', 'A'], ['B', 'B', 'B', 'B']])).toBe(true);
  });
  test('empty tube is treated as solved', () => {
    expect(isGoal([['A', 'A', 'A', 'A'], []])).toBe(true);
  });
  test('partial tube (length < 4) is not a goal', () => {
    expect(isGoal([['A', 'A', 'A', 'A'], ['B']])).toBe(false);
  });
  test('mixed-color tube is not a goal', () => {
    expect(isGoal([['B', 'A', 'A', 'A'], ['A', 'B', 'B', 'B']])).toBe(false);
  });
});

describe('stateKey', () => {
  test('same state produces the same key', () => {
    const s: PuzzleState = [['A', 'B'], ['C']];
    expect(stateKey(s)).toBe(stateKey(s));
  });
  test('different states produce different keys', () => {
    const s1: PuzzleState = [['A', 'B'], ['C']];
    const s2: PuzzleState = [['A'], ['B', 'C']];
    expect(stateKey(s1)).not.toBe(stateKey(s2));
  });
});

import { solve } from '../solver/bfs';

describe('solve – phase 1 (no unknowns)', () => {
  test('returns empty moves for an already-solved state', () => {
    const state: PuzzleState = [['A', 'A', 'A', 'A'], ['B', 'B', 'B', 'B'], []];
    const result = solve(state);
    expect(result.type).toBe('solved');
    if (result.type === 'solved') expect(result.moves).toEqual([]);
  });

  test('solves a simple 3-tube 2-color puzzle', () => {
    // Internal bottom-to-top: tube0=[B,A,B,A], tube1=[A,B,A,B], tube2=[]
    const state: PuzzleState = [
      ['B', 'A', 'B', 'A'],
      ['A', 'B', 'A', 'B'],
      [],
    ];
    const result = solve(state);
    expect(result.type).toBe('solved');
  });

  test('returns unsolvable when no buffer tube exists', () => {
    // No empty tube, no solution possible
    const state: PuzzleState = [
      ['A', 'B', 'A', 'B'],
      ['B', 'A', 'B', 'A'],
    ];
    const result = solve(state);
    expect(result.type).toBe('unsolvable');
  });

  test('solution moves applied to initial state reach goal', () => {
    const initial: PuzzleState = [
      ['B', 'A', 'B', 'A'],
      ['A', 'B', 'A', 'B'],
      [],
    ];
    const result = solve(initial);
    expect(result.type).toBe('solved');
    if (result.type !== 'solved') return;

    let state = initial;
    for (const move of result.moves) {
      state = applyMove(state, move.from, move.to);
    }
    expect(isGoal(state)).toBe(true);
  });
});

describe('solve – phase 2 (unknowns present)', () => {
  test('returns partial result when ? is present', () => {
    // tube0 internal: ['?','?','?','A'] → top=A, below=?
    const state: PuzzleState = [
      ['?', '?', '?', 'A'],
      ['B', 'B', 'B', 'B'],
      [],
    ];
    const result = solve(state);
    expect(result.type).toBe('partial');
  });

  test('reveal hint points to tube where moving top exposes ?', () => {
    // tube0 internal: ['?','A'] → top=A, below=?
    const state: PuzzleState = [
      ['?', 'A'],
      ['B', 'B', 'B', 'B'],
      [],
    ];
    const result = solve(state);
    expect(result.type).toBe('partial');
    if (result.type !== 'partial') return;
    expect(result.revealHints.length).toBeGreaterThan(0);
    expect(result.revealHints[0].tubeIndex).toBe(0);
  });
});
