import type { UITube } from './solver/types';
import { uiToInternal, internalToUI } from './solver/types';

// スタート状態: 各ボトルが満杯（4マス埋まり、? を含んでよい）か完全に空。
export function isStartState(tubes: UITube[]): boolean {
  return tubes.every(tube => tube.every(c => c === '') || tube.every(c => c !== ''));
}

// 判明/訂正を active entry の保存盤面へ反映して返す。
// - newTubes がスタート状態: そのまま丸ごと（判明・訂正どちらも反映）。
// - 途中盤面: ?→具体色 の内部 (t,i) を、entry が ? の箇所のみ反映（誤上書き防止）。
export function applyRevealToEntry(
  entryTubes: UITube[],
  oldTubes: UITube[],
  newTubes: UITube[],
): UITube[] {
  if (isStartState(newTubes)) return newTubes;

  const entryInt = entryTubes.map(uiToInternal);
  const oldInt = oldTubes.map(uiToInternal);
  const newInt = newTubes.map(uiToInternal);

  for (let t = 0; t < oldInt.length; t++) {
    const oldTube = oldInt[t];
    const newTube = newInt[t];
    const entryTube = entryInt[t];
    if (!oldTube || !newTube || !entryTube) continue;
    for (let i = 0; i < oldTube.length; i++) {
      const revealed =
        oldTube[i] === '?' && newTube[i] !== undefined && newTube[i] !== '?' && newTube[i] !== '';
      if (revealed && entryTube[i] === '?') {
        entryTube[i] = newTube[i];
      }
    }
  }
  return entryInt.map(internalToUI);
}
