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
    expect(['partial', 'speculative']).toContain(result.type);
  });

  test('reveal hint points to tube where moving top exposes ?', () => {
    // tube0 internal: ['?','A'] → top=A, below=?
    const state: PuzzleState = [
      ['?', 'A'],
      ['B', 'B', 'B', 'B'],
      [],
    ];
    const result = solve(state);
    expect(['partial', 'speculative']).toContain(result.type);
    if (result.type !== 'partial') return;
    expect(result.revealHints.length).toBeGreaterThan(0);
    expect(result.revealHints[0].tubeIndex).toBe(0);
  });

  test('partial の手順は ? を露出させる手で終わる', () => {
    // tube0 internal ['?','A'] → top=A, below=?; tube2（空）が唯一の有効な移動先
    const state: PuzzleState = [
      ['?', 'A'],
      ['B', 'B', 'B', 'B'],
      [],
    ];
    const result = solve(state);
    expect(result.type).toBe('partial');
    if (result.type !== 'partial') return;
    const revealTube = result.revealHints[0].tubeIndex;
    // 最後の手は対象チューブから動かす露出手
    const last = result.moves[result.moves.length - 1];
    expect(last.from).toBe(revealTube);
    // 全手を適用すると対象チューブのトップが ? になる（露出）
    let s: PuzzleState = state;
    for (const m of result.moves) s = applyMove(s, m.from, m.to);
    expect(s[revealTube][s[revealTube].length - 1]).toBe('?');
  });
});

describe('solve – speculative (few unknowns)', () => {
  // tube0 = three A's, tube1 = three B's, tube2 = two ? that must be one A + one B.
  // Both fillings (A-below-B, B-below-A) are solvable, but via different move sequences.
  // Random sampling returned whichever shuffle it happened to hit first, so its output
  // was non-deterministic. Exhaustive enumeration of the small assignment space must be
  // deterministic and always find a solvable filling.
  const twoUnknownBoard = (): PuzzleState => [
    ['A', 'A', 'A'],
    ['B', 'B', 'B'],
    ['?', '?'],
  ];

  test('produces a deterministic speculative solution across repeated runs', () => {
    const first = solve(twoUnknownBoard());
    expect(first.type).toBe('speculative');
    for (let i = 0; i < 12; i++) {
      expect(solve(twoUnknownBoard())).toEqual(first);
    }
  });

  test('speculative moves solve the assigned board', () => {
    const result = solve(twoUnknownBoard());
    expect(result.type).toBe('speculative');
    if (result.type !== 'speculative') return;
    expect(result.moves.length).toBeGreaterThan(0);
  });

  test('returns partial when no filling of the unknowns is solvable', () => {
    // Two full mixed tubes, no buffer: unsolvable regardless of the single ? filling.
    const state: PuzzleState = [
      ['A', 'B', 'A', 'B'],
      ['B', 'A', 'B', '?'],
    ];
    const result = solve(state);
    expect(result.type).toBe('partial');
  });
});

describe('solveMaxReveal – 露出数の最大化', () => {
  // tube0/tube1 とも top が既知・その下が ?。空き試験管2本でどちらも露出できる。
  // 既知色 A:1 B:1 に対し ? が2個 → buildColorPool が null を返すため partial 経路に入る。
  const twoRevealBoard = (): PuzzleState => [
    ['?', 'A'],
    ['?', 'B'],
    [],
    [],
  ];

  test('複数の ? を1手順で露出させる', () => {
    const result = solve(twoRevealBoard());
    expect(result.type).toBe('partial');
    if (result.type !== 'partial') return;
    expect(result.revealHints.map(h => h.tubeIndex).sort()).toEqual([0, 1]);
    expect(result.moves).toHaveLength(2);
  });

  test('revealHints.stepIndex がその手の revealsTube と一致する', () => {
    const result = solve(twoRevealBoard());
    expect(result.type).toBe('partial');
    if (result.type !== 'partial') return;
    for (const hint of result.revealHints) {
      expect(result.moves[hint.stepIndex].revealsTube).toBe(hint.tubeIndex);
    }
  });

  test('revealsTube はその手の適用直後にトップが ? になる試験管を指す', () => {
    const board = twoRevealBoard();
    const result = solve(board);
    expect(result.type).toBe('partial');
    if (result.type !== 'partial') return;
    let s: PuzzleState = board;
    for (const move of result.moves) {
      s = applyMove(s, move.from, move.to);
      const src = s[move.from];
      const exposed = src.length > 0 && src[src.length - 1] === '?';
      expect(move.revealsTube).toBe(exposed ? move.from : undefined);
    }
  });

  test('露出数が同じなら最短手数を返す（余計な手を付けない）', () => {
    // tube0 の A を1手動かすだけで唯一の ? が露出する。
    // 既知 A:2 に対し ? が1個 → pool は [A,A] で長さ不一致 → partial 経路。
    const state: PuzzleState = [
      ['?', 'A'],
      ['A'],
      [],
    ];
    const result = solve(state);
    expect(result.type).toBe('partial');
    if (result.type !== 'partial') return;
    expect(result.moves).toHaveLength(1);
    expect(result.revealHints).toEqual([{ tubeIndex: 0, stepIndex: 0 }]);
  });

  test('露出できない盤面では手順もヒントも空になる', () => {
    // tube1 は既にトップが ? （凍結済み）、tube0 に ? は無い → 露出候補ゼロ。
    const state: PuzzleState = [
      ['A', 'B', 'A', 'B'],
      ['B', 'A', 'B', '?'],
    ];
    const result = solve(state);
    expect(result.type).toBe('partial');
    if (result.type !== 'partial') return;
    expect(result.moves).toEqual([]);
    expect(result.revealHints).toEqual([]);
  });

  // 最大構成に近い盤面。同一内容の試験管が並ぶため状態爆発が起きやすく、
  // 探索予算がそのまま実行時間に効く。Step 6 の予算調整はこのテストで測る。
  test('大きな盤面でも予算内に partial を返す', () => {
    // 既知 A が16個 → buildColorPool が needed < 0 で null → partial 経路。
    // 探索予算に達しても、その時点までの最良結果を返して停止すること。
    const state: PuzzleState = [
      ...Array.from({ length: 16 }, () => ['?', 'A'] as string[]),
      [], [], [], [],
    ];
    const result = solve(state);
    expect(result.type).toBe('partial');
    if (result.type !== 'partial') return;
    expect(result.revealHints.length).toBeGreaterThan(0);
    // 最後の手は必ず露出手
    expect(result.moves[result.moves.length - 1].revealsTube).toBeDefined();
  }, 10_000);
});
