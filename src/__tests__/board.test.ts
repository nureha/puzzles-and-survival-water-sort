import { describe, test, expect } from 'vitest';
import { isStartState, applyRevealToEntry } from '../board';
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
