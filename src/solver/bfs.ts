import type { PuzzleState, Move, SolveResult, RevealHint } from './types';

export function topColor(tube: string[]): string | null {
  return tube.length === 0 ? null : tube[tube.length - 1];
}

export function topConsecutiveCount(tube: string[]): number {
  if (tube.length === 0) return 0;
  const top = tube[tube.length - 1];
  let count = 0;
  for (let i = tube.length - 1; i >= 0; i--) {
    if (tube[i] === top) count++;
    else break;
  }
  return count;
}

export function emptySlots(tube: string[]): number {
  return 4 - tube.length;
}

export function isValidMove(state: PuzzleState, from: number, to: number): boolean {
  if (from === to) return false;
  const src = state[from];
  const dst = state[to];
  const srcTop = topColor(src);
  if (!srcTop || srcTop === '?') return false;
  // Never move from an already-completed tube
  if (src.length === 4 && src.every(c => c === src[0])) return false;
  const dstTop = topColor(dst);
  if (dstTop === '?') return false;
  if (dstTop && dstTop !== srcTop) return false;
  return emptySlots(dst) >= topConsecutiveCount(src);
}

export function applyMove(state: PuzzleState, from: number, to: number): PuzzleState {
  const next = state.map(t => [...t]);
  const count = topConsecutiveCount(next[from]);
  const layers = next[from].splice(next[from].length - count, count);
  next[to].push(...layers);
  return next;
}

export function stateKey(state: PuzzleState): string {
  return state.map(t => t.join(',')).join('|');
}

export function isGoal(state: PuzzleState): boolean {
  return state.every(
    tube => tube.length === 0 || (tube.length === 4 && tube.every(c => c === tube[0]))
  );
}

// Heuristic: count color-boundary transitions within each unsorted tube.
// Each boundary requires at least one pour to resolve.
function heuristic(state: PuzzleState): number {
  let h = 0;
  for (const tube of state) {
    if (tube.length === 0 || (tube.length === 4 && tube.every(c => c === tube[0]))) continue;
    for (let i = 1; i < tube.length; i++) {
      if (tube[i] !== tube[i - 1]) h++;
    }
  }
  return h;
}

class MinHeap<T> {
  private heap: Array<{ f: number; value: T }> = [];

  push(value: T, f: number): void {
    this.heap.push({ f, value });
    let i = this.heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.heap[p].f <= this.heap[i].f) break;
      [this.heap[p], this.heap[i]] = [this.heap[i], this.heap[p]];
      i = p;
    }
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0].value;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      let i = 0;
      const n = this.heap.length;
      while (true) {
        let min = i;
        const l = 2 * i + 1, r = 2 * i + 2;
        if (l < n && this.heap[l].f < this.heap[min].f) min = l;
        if (r < n && this.heap[r].f < this.heap[min].f) min = r;
        if (min === i) break;
        [this.heap[min], this.heap[i]] = [this.heap[i], this.heap[min]];
        i = min;
      }
    }
    return top;
  }

  get size(): number { return this.heap.length; }
}

const MAX_STATES = 1_000_000;
const SPECULATIVE_ATTEMPTS = 30;
const SPECULATIVE_MAX_STATES = 200_000;
// partial（? の露出）探索の予算。? を含む盤面は isValidMove が凍結した試験管を
// 弾くぶん自由度が低く、到達状態数は具体色ソルバーより小さい。予算に達した場合は
// その時点までの最良結果を返す。
// 注: 「旧実装（最初の1個を露出したら即返す）と同じ深さで見つかるので悪化しない」
// という理屈は成り立たない。旧実装は露出手を打つ前の状態で露出を検知していたのに対し、
// 本実装は露出を状態として観測するため BFS を1層深く展開する必要があり、加えて予算も
// MAX_STATES（1,000,000）から 1/10 に絞っている。理論保証ではなく実測での判断:
// 試した盤面はいずれも旧実装の1個に対し2〜3個を返し、下回る例は確認されていない
// （2026-08-30）。
// 実測: 20本・?16個の盤面で 200,000 は約3.35秒、100,000 は約1.23秒
// （2026-08-30, Node 22 / M1）。3秒以内に収まる最大値として 100,000 を採用。
const REVEAL_MAX_STATES = 100_000;
// 露出探索の進捗通知の間隔（状態数）。1回の展開で visited が数十件増えるため
// solveAstar の `size % 10_000 === 0` 方式では倍数を跨いで通知が飛ぶ。閾値方式で
// 10,000 状態ごとに確実に通知する。
const REVEAL_PROGRESS_INTERVAL = 10_000;
// When the ? cells admit at most this many distinct color fillings, enumerate all of
// them at full solver strength instead of random sampling. 24 = 4! covers up to four
// distinct-color unknowns (the typical late-game residue), while keeping worst-case
// work bounded. Larger spaces fall back to random sampling.
const EXHAUSTIVE_PERM_LIMIT = 24;
// Heuristic weight for greedy fallback pass. w=1 is optimal A*; w>1 trades
// optimality for speed, escaping flat-plateau boards that stall standard A*.
const GREEDY_WEIGHT = 3;

function firstEmptyIndex(state: PuzzleState): number {
  for (let i = 0; i < state.length; i++) {
    if (state[i].length === 0) return i;
  }
  return -1;
}

function solveAstar(
  initialState: PuzzleState,
  maxStates: number,
  onProgress?: (n: number) => void,
  w = 1,
): { moves: Move[] | null; states: number } {
  type Node = { state: PuzzleState; moves: Move[]; g: number };
  const open = new MinHeap<Node>();
  const best = new Map<string, number>();

  const initH = heuristic(initialState);
  best.set(stateKey(initialState), 0);
  open.push({ state: initialState, moves: [], g: 0 }, w * initH);

  while (open.size > 0 && best.size < maxStates) {
    if (onProgress && best.size % 10_000 === 0 && best.size > 0) onProgress(best.size);

    const { state, moves, g } = open.pop()!;
    if ((best.get(stateKey(state)) ?? Infinity) < g) continue;
    if (isGoal(state)) return { moves, states: best.size };

    // Symmetry pruning: among equivalent empty tubes, only allow moves to the first one.
    // Moving to any other empty tube yields a state equivalent up to tube-index relabeling.
    const firstEmpty = firstEmptyIndex(state);

    // Reversal pruning: never immediately undo the previous move.
    const lastMove = moves.length > 0 ? moves[moves.length - 1] : null;

    for (let from = 0; from < state.length; from++) {
      for (let to = 0; to < state.length; to++) {
        if (!isValidMove(state, from, to)) continue;
        if (state[to].length === 0 && to !== firstEmpty) continue;
        if (lastMove && from === lastMove.to && to === lastMove.from) continue;
        const next = applyMove(state, from, to);
        const nextKey = stateKey(next);
        const newG = g + 1;
        if ((best.get(nextKey) ?? Infinity) <= newG) continue;
        best.set(nextKey, newG);
        open.push({ state: next, moves: [...moves, { from, to }], g: newG }, newG + w * heuristic(next));
      }
    }
  }

  return { moves: null, states: best.size };
}

// Full-strength solve of a fully-known board: optimal A* first, then a greedy
// weighted pass to escape flat-heuristic plateaus that stall standard A*.
function solveConcrete(
  state: PuzzleState,
  maxStates: number,
  onProgress?: (n: number) => void,
): { moves: Move[] | null; states: number } {
  const optimal = solveAstar(state, maxStates, onProgress);
  if (optimal.moves) return optimal;
  const greedy = solveAstar(state, maxStates, onProgress, GREEDY_WEIGHT);
  return { moves: greedy.moves, states: optimal.states + greedy.states };
}

// Returns pool of colors that must fill the ? positions, or null if counts are inconsistent.
function buildColorPool(state: PuzzleState): string[] | null {
  const counts: Record<string, number> = {};
  let qCount = 0;
  for (const tube of state) {
    for (const cell of tube) {
      if (cell === '?') { qCount++; continue; }
      counts[cell] = (counts[cell] ?? 0) + 1;
    }
  }
  const pool: string[] = [];
  for (const [color, count] of Object.entries(counts)) {
    const needed = 4 - count;
    if (needed < 0) return null;
    for (let i = 0; i < needed; i++) pool.push(color);
  }
  if (pool.length !== qCount) return null;
  return pool;
}

function fisherYates(arr: string[]): string[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function applyAssignment(state: PuzzleState, pool: string[]): PuzzleState {
  let idx = 0;
  return state.map(tube =>
    tube.map(cell => (cell === '?' ? pool[idx++] : cell))
  );
}

// Enumerates every distinct ordering of the color pool, up to `limit`. Returns null if
// more than `limit` distinct orderings exist (caller should sample randomly instead).
// Colors are visited in sorted order so the enumeration — and thus the chosen
// speculative filling — is deterministic.
function enumerateAssignments(pool: string[], limit: number): string[][] | null {
  const counts = new Map<string, number>();
  for (const color of pool) counts.set(color, (counts.get(color) ?? 0) + 1);
  const colors = [...counts.keys()].sort();

  const result: string[][] = [];
  const current: string[] = [];
  let overflow = false;

  function recurse(): void {
    if (overflow) return;
    if (current.length === pool.length) {
      if (result.length >= limit) { overflow = true; return; }
      result.push([...current]);
      return;
    }
    for (const color of colors) {
      const n = counts.get(color)!;
      if (n === 0) continue;
      counts.set(color, n - 1);
      current.push(color);
      recurse();
      current.pop();
      counts.set(color, n);
      if (overflow) return;
    }
  }

  recurse();
  return overflow ? null : result;
}

// Tracks which moves touch cells that originated from a ? position.
function markSpeculativeMoves(initialState: PuzzleState, testState: PuzzleState, moves: Move[]): Move[] {
  // Parallel isQ array mirrors testState
  let isQ = testState.map(tube => tube.map(() => false));

  // Mark positions that were ? in initialState
  for (let ti = 0; ti < initialState.length; ti++) {
    for (let li = 0; li < initialState[ti].length; li++) {
      if (initialState[ti][li] === '?') isQ[ti][li] = true;
    }
  }

  return moves.map(move => {
    const src = testState[move.from];
    const count = topConsecutiveCount(src);
    const srcIsQ = isQ[move.from].slice(src.length - count).some(Boolean);
    // Speculative if we are pouring directly onto a ?-origin cell
    // (the current top of the destination is ?-origin).
    // Checking the whole tube is too broad — a ? buried below known cells
    // does not make a C→C pour speculative.
    const dstLen = isQ[move.to].length;
    const dstAdjacentIsQ = dstLen > 0 && isQ[move.to][dstLen - 1];

    // Move the isQ flags along with the cells
    const nextIsQ = isQ.map(t => [...t]);
    const movedFlags = nextIsQ[move.from].splice(nextIsQ[move.from].length - count, count);
    nextIsQ[move.to].push(...movedFlags);
    isQ = nextIsQ;

    testState = applyMove(testState, move.from, move.to);
    return { ...move, isSpeculative: srcIsQ || dstAdjacentIsQ };
  });
}

function solveSpeculative(
  initialState: PuzzleState,
  onProgress?: (n: number) => void,
): SolveResult | null {
  const pool = buildColorPool(initialState);
  if (!pool) return null;

  // Few unknowns: exhaustively try every distinct filling at full solver strength
  // (MAX_STATES + greedy fallback). Guarantees a solvable filling is found if one exists
  // — matching what manually entering the colors would produce — and is deterministic.
  const assignments = enumerateAssignments(pool, EXHAUSTIVE_PERM_LIMIT);
  if (assignments) {
    // Shared budget across all fillings: the common case (a solvable filling
    // among the first few) stays full-strength, while a hard board where no
    // filling solves is bounded to ≤2×MAX_STATES total (each solveConcrete's
    // optimal+greedy passes each take the remaining budget) instead of 24×MAX_STATES.
    let budget = MAX_STATES;
    let explored = 0;
    for (const assignment of assignments) {
      if (budget <= 0) break;
      const testState = applyAssignment(initialState, assignment);
      const base = explored;
      const { moves, states } = solveConcrete(testState, budget, n => onProgress?.(base + n));
      explored += states;
      budget -= states;
      if (moves) {
        const markedMoves = markSpeculativeMoves(initialState, testState, moves);
        return { type: 'speculative', moves: markedMoves };
      }
    }
    return null;
  }

  // Too many unknowns to enumerate: sample random fillings with a lighter per-attempt
  // budget to bound total work.
  for (let attempt = 0; attempt < SPECULATIVE_ATTEMPTS; attempt++) {
    const assignment = fisherYates(pool);
    const testState = applyAssignment(initialState, assignment);
    const { moves } = solveAstar(testState, SPECULATIVE_MAX_STATES, onProgress);
    if (moves) {
      const markedMoves = markSpeculativeMoves(initialState, testState, moves);
      return { type: 'speculative', moves: markedMoves };
    }
  }
  return null;
}

export function solve(initialState: PuzzleState, onProgress?: (n: number) => void): SolveResult {
  if (isGoal(initialState)) return { type: 'solved', moves: [] };

  if (initialState.some(tube => tube.includes('?'))) {
    const specResult = solveSpeculative(initialState, onProgress);
    if (specResult) return specResult;
    return solveMaxReveal(initialState, onProgress);
  }

  const { moves } = solveConcrete(initialState, MAX_STATES, onProgress);
  return moves ? { type: 'solved', moves } : { type: 'unsolvable' };
}

// トップが '?' の試験管の本数。isValidMove がトップ '?' の試験管を from にも to にも
// 選ばせないため、一度露出した試験管は永久に凍結する。よってこの値は経路に沿って
// 単調増加し、初期値との差がそのまま「この手順で新たに判明した ? の個数」になる。
function exposedCount(state: PuzzleState): number {
  let n = 0;
  for (const tube of state) {
    if (tube.length > 0 && tube[tube.length - 1] === '?') n++;
  }
  return n;
}

// 露出しうる試験管の本数の上限。'?' を含み、かつトップがまだ既知色の試験管。
// 到達可能とは限らないが、ここに達したら探索を打ち切ってよい。
function maxRevealable(state: PuzzleState): number {
  let n = 0;
  for (const tube of state) {
    if (tube.includes('?') && tube[tube.length - 1] !== '?') n++;
  }
  return n;
}

// 探索木のノード。盤面そのものは持たず、visited に登録済みの stateKey 文字列を
// そのまま参照する（同一の文字列インスタンスなので追加のメモリを消費しない）。
// buildRevealResult は initialState から手順を再生するため parent/move しか使わず、
// 盤面が要るのは自分を展開する瞬間だけなので、そこで key から復元すれば足りる。
// PuzzleState を全ノードに持たせると 20本盤面で1件あたり 1KB を超え、予算いっぱいまで
// 探索するとヒープが 130MB 超に膨らむ（Web Worker / モバイルで OOM の危険）。
type RevealNode = { key: string; parent: number; move: Move | null };

// stateKey の逆変換。色は 1 文字（'A'–'Z' か '?'）で ',' '|' を含まないため可逆。
function parseStateKey(key: string): PuzzleState {
  return key.split('|').map(tube => (tube === '' ? [] : tube.split(',')));
}

// 親ポインタを辿って経路を復元し、各手に revealsTube を付けて RevealHint を組み立てる。
function buildRevealResult(
  initialState: PuzzleState,
  nodes: RevealNode[],
  bestNode: number,
): SolveResult {
  const rawMoves: Move[] = [];
  for (let i = bestNode; i > 0; i = nodes[i].parent) {
    rawMoves.push(nodes[i].move!);
  }
  rawMoves.reverse();

  const moves: Move[] = [];
  const revealHints: RevealHint[] = [];
  let state = initialState;
  for (let i = 0; i < rawMoves.length; i++) {
    const move = rawMoves[i];
    state = applyMove(state, move.from, move.to);
    // 注ぎ先のトップは注いだ既知色になるため、露出しうるのは注ぎ元だけ。
    const src = state[move.from];
    if (src.length > 0 && src[src.length - 1] === '?') {
      moves.push({ ...move, revealsTube: move.from });
      revealHints.push({ tubeIndex: move.from, stepIndex: i });
    } else {
      moves.push(move);
    }
  }
  return { type: 'partial', moves, revealHints };
}

// 1回の手順で露出できる ? の個数を最大化する。
//
// 1) 最短性: BFS の生成順は深さについて単調非減少（head の子の深さは depth(head)+1、
//    かつ depth(head) は head について単調非減少）。best は生成順に更新されるので、
//    ある露出数を最初に達成したノード＝その露出数における最短手順になる。
// 2) 末尾は必ず露出手: あるノードの親は必ずそれより先に生成され、その時点の best と
//    比較済みである。best は単調非減少なので、親の露出数が子と同じなら親の時点で
//    best がその値まで上がっており、子は best を更新できない。よって best を更新した
//    ノードの親は必ず露出数が小さく、最後の手は必ず露出手。末尾の刈り込みは不要。
//    （1手が減らす試験管は from の1本だけなので露出数の増分は高々1。）
function solveMaxReveal(initialState: PuzzleState, onProgress?: (n: number) => void): SolveResult {
  const maxReveal = maxRevealable(initialState);
  if (maxReveal === 0) return { type: 'partial', moves: [], revealHints: [] };

  const baseExposed = exposedCount(initialState);
  const rootKey = stateKey(initialState);
  const nodes: RevealNode[] = [{ key: rootKey, parent: -1, move: null }];
  const visited = new Set<string>([rootKey]);

  let best = 0;
  let bestNode = 0;
  let nextProgressAt = REVEAL_PROGRESS_INTERVAL;

  outer:
  for (let head = 0; head < nodes.length && visited.size < REVEAL_MAX_STATES; head++) {
    const state = parseStateKey(nodes[head].key);

    if (onProgress && visited.size >= nextProgressAt) {
      onProgress(visited.size);
      nextProgressAt = visited.size + REVEAL_PROGRESS_INTERVAL;
    }

    const firstEmpty = firstEmptyIndex(state);
    for (let from = 0; from < state.length; from++) {
      for (let to = 0; to < state.length; to++) {
        if (!isValidMove(state, from, to)) continue;
        if (state[to].length === 0 && to !== firstEmpty) continue;
        const next = applyMove(state, from, to);
        const key = stateKey(next);
        if (visited.has(key)) continue;
        visited.add(key);
        nodes.push({ key, parent: head, move: { from, to } });

        // 露出数の評価は「展開時」ではなく「生成時」に行う。予算切れでループを抜けると
        // 最後に生成した層（＝最も深く、露出数が最大になりうる層）が丸ごと未評価のまま
        // 捨てられるため。生成時に評価すれば、生成した状態はすべて必ず評価される。
        // 展開時の評価は生成時評価に完全に包含される（根の露出数は best の初期値 0 と
        // 等しく、根以外は必ず生成時に評価済み）ので削除した。
        const revealed = exposedCount(next) - baseExposed;
        if (revealed > best) {
          best = revealed;
          bestNode = nodes.length - 1;
          // 上限に達したらそれ以上探索しても改善しない。内側ループから抜けるため
          // 打ち切りは近似ではなく厳密（余分な状態を生成しない）。
          if (best === maxReveal) break outer;
        }
      }
    }
  }

  return buildRevealResult(initialState, nodes, bestNode);
}

// IDA* (Iterative Deepening A*): explores arbitrarily deep without memory limits.
// Returns the solution path, or null if unsolvable / timed out.
export function solveDeep(
  initialState: PuzzleState,
  timeoutMs: number,
  onProgress?: (threshold: number) => void,
): Move[] | null {
  const deadline = Date.now() + timeoutMs;
  const path: Move[] = [];
  const pathKeys = new Set<string>([stateKey(initialState)]);
  let nodeCount = 0;
  let timedOut = false;

  function search(
    state: PuzzleState,
    g: number,
    threshold: number,
    lastFrom: number,
    lastTo: number,
  ): number | 'found' {
    const f = g + heuristic(state);
    if (f > threshold) return f;
    if (isGoal(state)) return 'found';

    nodeCount++;
    if ((nodeCount & 0xfff) === 0) {
      if (Date.now() > deadline) { timedOut = true; return Infinity; }
    }

    const firstEmpty = firstEmptyIndex(state);
    let min = Infinity;

    for (let from = 0; from < state.length; from++) {
      for (let to = 0; to < state.length; to++) {
        if (!isValidMove(state, from, to)) continue;
        if (state[to].length === 0 && to !== firstEmpty) continue;
        if (from === lastTo && to === lastFrom) continue;

        const next = applyMove(state, from, to);
        const nextKey = stateKey(next);
        if (pathKeys.has(nextKey)) continue;

        path.push({ from, to });
        pathKeys.add(nextKey);
        const result = search(next, g + 1, threshold, from, to);
        if (result === 'found') return 'found';
        path.pop();
        pathKeys.delete(nextKey);

        if (timedOut) return Infinity;
        if ((result as number) < min) min = result as number;
      }
    }
    return min;
  }

  let threshold = heuristic(initialState);

  while (!timedOut && Date.now() < deadline) {
    onProgress?.(threshold);
    const result = search(initialState, 0, threshold, -1, -1);
    if (result === 'found') return [...path];
    if (result === Infinity) return null;
    threshold = result as number;
  }

  return null;
}
