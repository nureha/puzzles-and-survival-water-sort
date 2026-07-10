import type { UITube } from '../solver/types';

export function formatTubes(tubes: UITube[]): string {
  return tubes
    .map(tube => {
      const cells = tube.filter(cell => cell !== '');
      return cells.length === 0 ? '空' : cells.join('');
    })
    .join(', ');
}
