import type { UITube } from './solver/types';

// あるセルが編集前 '?' → 編集後に具体色（'' でも '?' でもない）へ変わったか。
// = 未判明の色が判明した（reveal）シグナル。
export function detectReveal(oldTubes: UITube[], nextTubes: UITube[]): boolean {
  for (let t = 0; t < oldTubes.length; t++) {
    const oldTube = oldTubes[t];
    const nextTube = nextTubes[t];
    if (!oldTube || !nextTube) continue;
    const len = Math.min(oldTube.length, nextTube.length);
    for (let c = 0; c < len; c++) {
      if (oldTube[c] === '?' && nextTube[c] !== '?' && nextTube[c] !== '') {
        return true;
      }
    }
  }
  return false;
}
