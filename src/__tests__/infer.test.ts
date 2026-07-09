import { describe, test, expect } from 'vitest';
import { inferUnknowns } from '../solver/infer';
import type { UITube } from '../solver/types';

describe('inferUnknowns', () => {
  // 変化なしケース
  test('? のないチューブはそのまま返す', () => {
    const tubes: UITube[] = [
      ['A', 'B', 'A', 'B'],
      ['B', 'A', 'B', 'A'],
    ];
    expect(inferUnknowns(tubes)).toEqual(tubes);
  });

  // フェーズ1: 残り必要数が1色のみ → 全 ? を確定
  test('残り必要数が1色のみで全 ? が確定できる', () => {
    // A が 3個既知 → あと1個必要。? は1個 → A に確定
    const tubes: UITube[] = [
      ['A', 'A', 'A', ''],
      ['', '', '', '?'],
    ];
    const result = inferUnknowns(tubes);
    expect(result[1][3]).toBe('A');
  });

  // フェーズ1: 隣接制約で候補が1つに絞られる
  test('隣接する既知セルとの連続を除外して候補が1つに絞られる', () => {
    // A×3, B×3 既知。残り: A×1, B×1 で ? が2個
    // tube[0] = ['A', '?', 'B', 'B'] → index1 は A/B のうち A 以外かつ B 以外 → どちらも除外
    //   ただし残り必要 A=1, B=1 で ? が2個なので一意ではない
    // シンプルなケース: ? が1個で残り候補が1色
    const tubes: UITube[] = [
      ['A', 'B', 'A', 'B'],
      ['B', 'A', 'B', '?'],
    ];
    // 既知: A×3, B×4 → 残り: A×1, B×0
    // ? の隣(index2)は B → 候補は A のみ → 確定
    const result = inferUnknowns(tubes);
    expect(result[1][3]).toBe('A');
  });

  // フェーズ1: 連続制約で候補ゼロ → ? のまま（不整合時は変更しない）
  test('候補が 0 のときは ? のまま残す', () => {
    // 残り必要 B×1 のみ、? は1個だが隣が B → 連続制約で候補なし
    // この場合は推論不能として ? のまま残す
    const tubes: UITube[] = [
      ['A', 'A', 'A', 'A'],
      ['B', 'B', 'B', '?'],
    ];
    // 既知: A×4, B×3 → 残り B×1 しかないが、隣(index2)が B → 連続制約で候補なし
    // 候補がないため ? のまま（連続制約を遵守）
    const result = inferUnknowns(tubes);
    // 連続制約により候補なし → ? のまま残す
    expect(result[1][3]).toBe('?');
  });

  // フェーズ1/2: 残り3以下で隣接制約により一意解が確定する
  test('残り ? が 3 以下で一意解がある場合は自動入力する', () => {
    // フェーズ1: prev/next 両方の隣接制約で各 ? の候補が1色に絞られる
    // tube[0][2]: prev=B, next=C → 候補A のみ → Phase 1 で確定
    // tube[1][2]: prev=C, next=A → 候補B のみ → Phase 1 で確定
    // tube[2][2]: prev=A, next=B → 候補C のみ → Phase 1 で確定
    // NOTE: Phase 2 (backtracking) is not triggered — each ? resolves in Phase 1 alone.
    const tubes: UITube[] = [
      ['A', 'B', '?', 'C'],
      ['B', 'C', '?', 'A'],
      ['C', 'A', '?', 'B'],
    ];
    const result = inferUnknowns(tubes);
    // 全 ? が埋まっていること
    expect(result.flat().filter((c: string) => c === '?')).toHaveLength(0);
    // 各色が4個であること
    const flat = result.flat().filter((c: string) => c !== '' && c !== '?');
    const counts: Record<string, number> = {};
    for (const c of flat) counts[c] = (counts[c] ?? 0) + 1;
    expect(counts['A']).toBe(4);
    expect(counts['B']).toBe(4);
    expect(counts['C']).toBe(4);
  });

  // フェーズ2: 残り3以下だが複数解あり → ? のまま
  test('残り ? が矛盾状態（候補なし）の場合は ? のまま残す', () => {
    // A×2, B×2 既知, ? が4個 → 4個はフェーズ2の対象外
    // → フェーズ1で絞れないまま残る
    // 代わりに残り ? が2個で対称ケース: A×3, B×3 で残り A=1, B=1, ? が2個
    // tube[0]: ['A', 'B', '?', '']  tube[1]: ['B', 'A', '?', '']
    // tube[0][2] は A/B のうち B(隣)以外 → A; tube[1][2] は B/A のうち A(隣)以外 → B
    // でも残り A=1, B=1 → tube[0][2]=A, tube[1][2]=B が一意解 → 確定してしまう
    // 複数解ケース: 制約が緩い場合
    // A×2, B×2 既知, ?が2個で tube[0]:['A','?','',''] tube[1]:['B','?','','']
    // tube[0][1] は A 以外 → B; tube[1][1] は B 以外 → A → これも一意
    // 本当に曖昧なケース: 残り A=2, B=0 で ? が2個、隣の制約なし
    // 実際は「残り A=2 のみ」→ 両方 A で一意。曖昧にならない。
    // 曖昧ケース: 未見色 C が存在するとき (推論不可)
    // A×4, B×3 既知。? が2個。残り B=1 のみ (A は4個済)。
    // tube[0]: ['B', 'B', 'B', '?'] tube[1]: ['', '', '', '?']
    // tube[0][3] は B 以外候補なし(残りBのみ&隣B) → 不整合 → ? のまま
    // tube[1][3] は B のみ残り → B に確定
    // ※ 不整合は変更しない
    const tubes: UITube[] = [
      ['B', 'B', 'B', '?'],
      ['', '', '', '?'],
      ['A', 'A', 'A', 'A'],
    ];
    const result = inferUnknowns(tubes);
    // tube[1][3] は B (残り唯一)
    expect(result[1][3]).toBe('B');
    // tube[0][3] は隣が B で残りも B のみ → 候補なしで ? のまま
    expect(result[0][3]).toBe('?');
  });
});
