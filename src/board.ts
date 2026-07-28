import type { UITube } from './solver/types';
import { uiToInternal, internalToUI } from './solver/types';

// スタート状態: 各ボトルが満杯（4マス埋まり、? を含んでよい）か完全に空。
export function isStartState(tubes: UITube[]): boolean {
  return tubes.every(tube => tube.every(c => c === '') || tube.every(c => c !== ''));
}

// 判明/訂正を active entry の保存盤面へ反映して返す。
// - newTubes がスタート状態: そのまま丸ごと（判明・訂正どちらも反映）。
// - 途中盤面: 内部 (t,i) で entry の該当セルへ書き戻す。同一セルである確証があるときのみ：
//   - 判明（?→具体色）: entry の該当セルが ? のとき。
//   - 訂正（色→別の色）: entry の該当セルが旧値と一致するとき。
//   いずれも一致しなければスキップ（? セルが移動した speculative 等での誤上書きを防ぐ）。
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
      const nv = newTube[i];
      if (nv === undefined || nv === '?' || nv === '') continue; // 具体色への変更のみ
      if (oldTube[i] === nv) continue; // 変化なし
      if (oldTube[i] === '?') {
        if (entryTube[i] === '?') entryTube[i] = nv; // 判明
      } else if (entryTube[i] === oldTube[i]) {
        entryTube[i] = nv; // 訂正（旧値一致で同一セル確証）
      }
    }
  }
  return entryInt.map(internalToUI);
}
