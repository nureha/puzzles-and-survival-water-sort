import type { UITube } from './types';

function countKnown(tubes: UITube[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tube of tubes) {
    for (const cell of tube) {
      if (cell !== '' && cell !== '?') {
        counts[cell] = (counts[cell] ?? 0) + 1;
      }
    }
  }
  return counts;
}

function remaining(knownCounts: Record<string, number>): Record<string, number> {
  const rem: Record<string, number> = {};
  for (const [color, count] of Object.entries(knownCounts)) {
    if (count < 4) rem[color] = 4 - count;
  }
  return rem;
}

function possibleColors(
  tubes: UITube[],
  tubeIdx: number,
  cellIdx: number,
  rem: Record<string, number>,
): string[] {
  const prev = cellIdx > 0 ? tubes[tubeIdx][cellIdx - 1] : null;
  const next = cellIdx < 3 ? tubes[tubeIdx][cellIdx + 1] : null;
  return Object.entries(rem)
    .filter(([, count]) => count > 0)
    .map(([color]) => color)
    .filter(color => color !== prev && color !== next);
}

function applyAssignment(
  tubes: UITube[],
  tubeIdx: number,
  cellIdx: number,
  color: string,
): UITube[] {
  return tubes.map((tube, ti) => {
    if (ti !== tubeIdx) return tube;
    const next = [...tube] as UITube;
    next[cellIdx] = color;
    return next;
  });
}

// 残り色のうち連続制約を無視した全候補を返す（フォールバック用）
function possibleColorsNoAdj(rem: Record<string, number>): string[] {
  return Object.entries(rem)
    .filter(([, count]) => count > 0)
    .map(([color]) => color);
}

// フェーズ1: 反復ドメイン縮小。候補が 1 つの ? を確定する。
// パス1: 連続制約ありで候補が 1 つの ? を確定する（通常の推論）。
// パス2: パス1で変化がなく、連続制約で候補が 0（不整合）で rem が唯一のとき確定する（フォールバック推論）。
function iterativeReduce(tubes: UITube[]): UITube[] {
  let current = tubes;
  let changed = true;
  while (changed) {
    changed = false;
    const known = countKnown(current);
    const rem = remaining(known);
    let next = current;

    // パス1: 連続制約ありで候補が 1 つの ? を確定する
    for (let t = 0; t < current.length; t++) {
      for (let c = 0; c < 4; c++) {
        if (next[t][c] !== '?') continue;
        const possible = possibleColors(next, t, c, rem);
        if (possible.length === 1) {
          next = applyAssignment(next, t, c, possible[0]);
          rem[possible[0]] = (rem[possible[0]] ?? 1) - 1;
          changed = true;
        }
      }
    }

    // パス2: パス1で変化がなかった場合のみ、連続制約なしフォールバック
    if (!changed) {
      for (let t = 0; t < current.length; t++) {
        for (let c = 0; c < 4; c++) {
          if (next[t][c] !== '?') continue;
          const possible = possibleColors(next, t, c, rem);
          if (possible.length === 0) {
            // 連続制約なしでフォールバック
            const fallback = possibleColorsNoAdj(rem);
            if (fallback.length === 1) {
              next = applyAssignment(next, t, c, fallback[0]);
              rem[fallback[0]] = (rem[fallback[0]] ?? 1) - 1;
              changed = true;
            }
          }
        }
      }
    }

    current = next;
  }
  return current;
}

type UnknownPos = { tubeIdx: number; cellIdx: number };

function collectUnknowns(tubes: UITube[]): UnknownPos[] {
  const positions: UnknownPos[] = [];
  for (let t = 0; t < tubes.length; t++) {
    for (let c = 0; c < 4; c++) {
      if (tubes[t][c] === '?') positions.push({ tubeIdx: t, cellIdx: c });
    }
  }
  return positions;
}

// フェーズ2: バックトラッキング CSP。一意解のみ適用。
function backtrack(
  tubes: UITube[],
  positions: UnknownPos[],
  rem: Record<string, number>,
  idx: number,
  solutions: UITube[][],
): void {
  if (solutions.length > 1) return; // 複数解確定済み → 早期終了
  if (idx === positions.length) {
    solutions.push(tubes);
    return;
  }
  const { tubeIdx, cellIdx } = positions[idx];
  const possible = possibleColors(tubes, tubeIdx, cellIdx, rem);
  for (const color of possible) {
    const nextRem = { ...rem, [color]: rem[color] - 1 };
    const nextTubes = applyAssignment(tubes, tubeIdx, cellIdx, color);
    backtrack(nextTubes, positions, nextRem, idx + 1, solutions);
    if (solutions.length > 1) return;
  }
}

export function inferUnknowns(tubes: UITube[]): UITube[] {
  // フェーズ1
  let current = iterativeReduce(tubes);

  // フェーズ2: 残り ? が 3 以下のとき
  const unknowns = collectUnknowns(current);
  if (unknowns.length === 0 || unknowns.length > 3) return current;

  const known = countKnown(current);
  const rem = remaining(known);
  const solutions: UITube[][] = [];
  backtrack(current, unknowns, rem, 0, solutions);

  if (solutions.length === 1) return solutions[0];
  return current;
}
