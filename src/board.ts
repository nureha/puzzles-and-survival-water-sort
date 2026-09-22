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

// partial の露出手順で判明した色を、元レイアウト（initialTubes）の同じ内部インデックスへ
// 埋め戻して返す。ステップ戻し（initialTubes からの再生）で判明色が ? に戻るのを防ぐ。
//
// 同一セルであることの根拠: partial の手順は '?' セルを動かさない。isValidMove が
// トップ '?' の試験管を from にも to にも選ばないため、'?' の上に積まれるのは常に既知色で、
// '?' 自身は下から数えた位置（InternalTube のインデックス）を手順中ずっと保つ。
// よって途中盤面の (t, i) と元レイアウトの (t, i) は同じセルを指す。
// speculative の手順は ? 由来のセルが移動するためこの性質が無い。呼び出し側で
// result.type === 'partial' に限定すること。
export function applyRevealToInitial(
  initialTubes: UITube[],
  oldTubes: UITube[],
  newTubes: UITube[],
): UITube[] {
  const initInt = initialTubes.map(uiToInternal);
  const oldInt = oldTubes.map(uiToInternal);
  const newInt = newTubes.map(uiToInternal);

  for (let t = 0; t < initInt.length; t++) {
    const initTube = initInt[t];
    const oldTube = oldInt[t];
    const newTube = newInt[t];
    if (!oldTube || !newTube) continue; // 本数不一致は無視
    for (let i = 0; i < initTube.length; i++) {
      if (initTube[i] !== '?') continue; // 既知色のセルは触らない
      if (oldTube[i] !== '?') continue; // 途中盤面でも '?' だったセルのみ（長さ不足は undefined で弾かれる）
      const nv = newTube[i];
      if (nv === undefined || nv === '?' || nv === '') continue; // 具体色への確定のみ
      initTube[i] = nv;
    }
  }
  return initInt.map(internalToUI);
}
