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
): Move[] | null {
  type Node = { state: PuzzleState; moves: Move[]; g: number };
  const open = new MinHeap<Node>();
  const best = new Map<string, number>();

  best.set(stateKey(initialState), 0);
  open.push({ state: initialState, moves: [], g: 0 }, heuristic(initialState));

  while (open.size > 0 && best.size < maxStates) {
    if (onProgress && best.size % 10_000 === 0 && best.size > 0) onProgress(best.size);

    const { state, moves, g } = open.pop()!;
    if ((best.get(stateKey(state)) ?? Infinity) < g) continue;
    if (isGoal(state)) return moves;

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
        open.push({ state: next, moves: [...moves, { from, to }], g: newG }, newG + heuristic(next));
      }
    }
  }

  return null;
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

  for (let attempt = 0; attempt < SPECULATIVE_ATTEMPTS; attempt++) {
    const assignment = fisherYates(pool);
    const testState = applyAssignment(initialState, assignment);
    const moves = solveAstar(testState, SPECULATIVE_MAX_STATES, onProgress);
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
    return solvePartial(initialState);
  }

  const moves = solveAstar(initialState, MAX_STATES, onProgress);
  return moves ? { type: 'solved', moves } : { type: 'unsolvable' };
}

function solvePartial(initialState: PuzzleState): SolveResult {
  type Node = { state: PuzzleState; moves: Move[] };
  const queue: Node[] = [{ state: initialState, moves: [] }];
  const visited = new Set<string>([stateKey(initialState)]);

  while (queue.length > 0 && visited.size < MAX_STATES) {
    const { state, moves } = queue.shift()!;

    // Return as soon as we reach a state where a ? can be revealed.
    // BFS guarantees this is the shortest path to any such state.
    const hints = findRevealHints(state);
    if (hints.length > 0) {
      return { type: 'partial', moves, revealHints: hints };
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
        queue.push({ state: next, moves: [...moves, { from, to }] });
      }
    }
  }

  return { type: 'partial', moves: [], revealHints: findRevealHints(initialState) };
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

function findRevealHints(state: PuzzleState): RevealHint[] {
  const hints: RevealHint[] = [];
  for (let i = 0; i < state.length; i++) {
    const tube = state[i];
    const top = topColor(tube);
    if (!top || top === '?') continue;
    const count = topConsecutiveCount(tube);
    const belowIndex = tube.length - 1 - count;
    if (belowIndex >= 0 && tube[belowIndex] === '?') {
      const dests = [];
      for (let j = 0; j < state.length; j++) {
        if (isValidMove(state, i, j)) dests.push(j + 1);
      }
      // Only a real reveal opportunity if the blocking block can actually be moved.
      if (dests.length === 0) continue;
      hints.push({
        tubeIndex: i,
        description: `試験管${i + 1}のトップ（${top}）を試験管${dests.join('・')}へ動かすと ? が判明します`,
      });
    }
  }
  return hints;
}
