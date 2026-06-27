import type { UITube } from './types';

export function validateTubes(tubes: UITube[]): string | null {
  const counts: Record<string, number> = {};
  for (const tube of tubes) {
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
