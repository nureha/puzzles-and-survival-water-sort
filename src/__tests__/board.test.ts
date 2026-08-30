import { describe, test, expect } from 'vitest';
import { isStartState, applyRevealToEntry, applyRevealToInitial } from '../board';
import type { UITube } from '../solver/types';

describe('isStartState', () => {
  test('満杯と空のみは true（? を含む満杯も可）', () => {
    expect(isStartState([['A', 'A', 'A', 'A'], ['', '', '', ''], ['B', '?', '?', '?']])).toBe(true);
  });
  test('半端なボトルがあると false', () => {
    expect(isStartState([['A', 'B', '', '']])).toBe(false);
  });
});

describe('applyRevealToEntry', () => {
  test('newTubes がスタート状態なら丸ごと返す', () => {
    const entry: UITube[] = [['?', '?', '?', '?']];
    const oldT: UITube[] = [['?', '?', '?', '?']];
    const newT: UITube[] = [['A', '?', '?', '?']]; // 満杯のまま → スタート状態
    expect(applyRevealToEntry(entry, oldT, newT)).toEqual(newT);
  });

  test('途中盤面の ?→色 を entry の該当 ? セルへ反映', () => {
    const entry: UITube[] = [['C', 'C', '?', '?']];
    const oldT: UITube[] = [['', '', '?', '?']]; // C ブロックを露出手で移動済み（途中盤面）
    const newT: UITube[] = [['', '', 'A', '?']]; // 露出した ? を A と判明
    expect(applyRevealToEntry(entry, oldT, newT)).toEqual([['C', 'C', 'A', '?']]);
  });

  test('entry の該当セルが ? でなければ書き込まない（誤上書き防止）', () => {
    const entry: UITube[] = [['C', 'C', 'D', '?']];
    const oldT: UITube[] = [['', '', '?', '?']];
    const newT: UITube[] = [['', '', 'A', '?']];
    expect(applyRevealToEntry(entry, oldT, newT)).toEqual([['C', 'C', 'D', '?']]);
  });

  test('途中盤面の訂正（旧値と entry が一致）を反映', () => {
    const entry: UITube[] = [['C', 'C', 'A', '?']]; // 以前 A と判明・保存済み
    const oldT: UITube[] = [['', '', 'A', '?']]; // 露出後、上に A が出ている途中盤面
    const newT: UITube[] = [['', '', 'B', '?']]; // A → B に訂正
    expect(applyRevealToEntry(entry, oldT, newT)).toEqual([['C', 'C', 'B', '?']]);
  });

  test('訂正で entry が旧値と一致しなければ書き込まない（誤上書き防止）', () => {
    const entry: UITube[] = [['C', 'C', 'D', '?']]; // entry は D（旧値 A と不一致）
    const oldT: UITube[] = [['', '', 'A', '?']];
    const newT: UITube[] = [['', '', 'B', '?']];
    expect(applyRevealToEntry(entry, oldT, newT)).toEqual([['C', 'C', 'D', '?']]);
  });
});

// UITube は上→下（index 3 が底）。internal は下→上。
describe('applyRevealToInitial', () => {
  test('1個の判明色を元レイアウトの同じ内部インデックスへ埋め戻す', () => {
    const initial: UITube[] = [['', '', 'A', '?']]; // internal ['?','A']
    const oldT: UITube[] = [['', '', '', '?']]; // A を移動済みの途中盤面 internal ['?']
    const newT: UITube[] = [['', '', '', 'B']]; // 露出した ? を B と判明
    expect(applyRevealToInitial(initial, oldT, newT)).toEqual([['', '', 'A', 'B']]);
  });

  test('同時に複数判明しても全部埋め戻す', () => {
    const initial: UITube[] = [['', '', 'A', '?'], ['', '', 'C', '?']];
    const oldT: UITube[] = [['', '', '', '?'], ['', '', '', '?']];
    const newT: UITube[] = [['', '', '', 'B'], ['', '', '', 'D']];
    expect(applyRevealToInitial(initial, oldT, newT)).toEqual([
      ['', '', 'A', 'B'],
      ['', '', 'C', 'D'],
    ]);
  });

  test('元レイアウトで既に具体色のセルは書き換えない', () => {
    const initial: UITube[] = [['', '', 'A', 'C']]; // 底は既知の C
    const oldT: UITube[] = [['', '', '', '?']];
    const newT: UITube[] = [['', '', '', 'B']];
    expect(applyRevealToInitial(initial, oldT, newT)).toEqual([['', '', 'A', 'C']]);
  });

  test('途中盤面で既に具体色だったセルは書き換えない（判明のみ反映）', () => {
    const initial: UITube[] = [['', '', '?', '?']]; // internal ['?','?']
    const oldT: UITube[] = [['', '', 'A', '?']]; // internal ['?','A'] — 上のセルは既知
    const newT: UITube[] = [['', '', 'B', '?']]; // A→B の訂正（判明ではない）
    expect(applyRevealToInitial(initial, oldT, newT)).toEqual([['', '', '?', '?']]);
  });

  test('本数・長さが食い違っても例外を投げず、対応するセルだけ埋め戻す', () => {
    const initial: UITube[] = [['', '', 'A', '?'], ['', '', '', 'D']];
    const oldT: UITube[] = [['', '', '', '?']]; // 1本しかない
    const newT: UITube[] = [['', '', '', 'B']];
    expect(() => applyRevealToInitial(initial, oldT, newT)).not.toThrow();
    expect(applyRevealToInitial(initial, oldT, newT)).toEqual([
      ['', '', 'A', 'B'],
      ['', '', '', 'D'],
    ]);
  });

  test('途中盤面のほうが長くても元レイアウトの長さ分だけ見る', () => {
    const initial: UITube[] = [['', '', '', '?']]; // internal ['?']
    const oldT: UITube[] = [['A', 'B', 'C', '?']]; // internal ['?','C','B','A']
    const newT: UITube[] = [['A', 'B', 'C', 'E']];
    expect(applyRevealToInitial(initial, oldT, newT)).toEqual([['', '', '', 'E']]);
  });
});
