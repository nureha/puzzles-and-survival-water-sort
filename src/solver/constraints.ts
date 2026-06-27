import type { UITube } from './types';

export function validateTubes(tubes: UITube[]): string | null {
  const counts: Record<string, number> = {};
  for (const tube of tubes) {
    // Air-gap check: once a non-empty cell appears, no empty cell may follow
    let nonEmptyFound = false;
    for (const cell of tube) {
      if (cell !== '') {
        nonEmptyFound = true;
      } else if (nonEmptyFound) {
        return '試験管の色の間に空きセルがあります（空きセルは上部のみに入れてください）';
      }
    }

    for (const cell of tube) {
      if (!cell || cell === '?' || cell === '') continue;
      counts[cell] = (counts[cell] ?? 0) + 1;
      if (counts[cell] > 4) {
        return `色 "${cell}" が5つ以上あります（各色は4つまで）`;
      }
    }
  }
  return null;
}
