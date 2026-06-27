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

const MAX_STATES = 500_000;

export function solve(initialState: PuzzleState, onProgress?: (n: number) => void): SolveResult {
  if (isGoal(initialState)) return { type: 'solved', moves: [] };

  if (initialState.some(tube => tube.includes('?'))) {
    return solvePartial(initialState);
  }

  type Node = { state: PuzzleState; moves: Move[]; g: number };
  const open = new MinHeap<Node>();
  // best maps stateKey -> best g seen so far (for lazy deletion)
  const best = new Map<string, number>();

  best.set(stateKey(initialState), 0);
  open.push({ state: initialState, moves: [], g: 0 }, heuristic(initialState));

  while (open.size > 0 && best.size < MAX_STATES) {
    if (onProgress && best.size % 10_000 === 0 && best.size > 0) onProgress(best.size);

    const { state, moves, g } = open.pop()!;

    // Skip stale entry: a better path to this state was found later
    if ((best.get(stateKey(state)) ?? Infinity) < g) continue;

    if (isGoal(state)) return { type: 'solved', moves };

    for (let from = 0; from < state.length; from++) {
      for (let to = 0; to < state.length; to++) {
        if (!isValidMove(state, from, to)) continue;
        const next = applyMove(state, from, to);
        const nextKey = stateKey(next);
        const newG = g + 1;
        if ((best.get(nextKey) ?? Infinity) <= newG) continue;
        best.set(nextKey, newG);
        open.push({ state: next, moves: [...moves, { from, to }], g: newG }, newG + heuristic(next));
      }
    }
  }

  return { type: 'unsolvable' };
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

    for (let from = 0; from < state.length; from++) {
      for (let to = 0; to < state.length; to++) {
        if (!isValidMove(state, from, to)) continue;
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

function findRevealHints(state: PuzzleState): RevealHint[] {
  const hints: RevealHint[] = [];
  for (let i = 0; i < state.length; i++) {
    const tube = state[i];
    const top = topColor(tube);
    if (!top || top === '?') continue;
    const count = topConsecutiveCount(tube);
    const belowIndex = tube.length - 1 - count;
    if (belowIndex >= 0 && tube[belowIndex] === '?') {
      hints.push({
        tubeIndex: i,
        description: `試験管${i + 1}のトップ（${top}）を動かすと ? が判明します`,
      });
    }
  }
  return hints;
}
