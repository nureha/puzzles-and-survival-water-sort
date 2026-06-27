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

const MAX_STATES = 100_000;

export function solve(initialState: PuzzleState): SolveResult {
  if (isGoal(initialState)) return { type: 'solved', moves: [] };

  if (initialState.some(tube => tube.includes('?'))) {
    return solvePartial(initialState);
  }

  type Node = { state: PuzzleState; moves: Move[] };
  const queue: Node[] = [{ state: initialState, moves: [] }];
  const visited = new Set<string>([stateKey(initialState)]);

  while (queue.length > 0) {
    const { state, moves } = queue.shift()!;

    for (let from = 0; from < state.length; from++) {
      for (let to = 0; to < state.length; to++) {
        if (!isValidMove(state, from, to)) continue;
        const next = applyMove(state, from, to);
        const key = stateKey(next);
        if (visited.has(key)) continue;
        const nextMoves = [...moves, { from, to }];
        if (isGoal(next)) return { type: 'solved', moves: nextMoves };
        if (visited.size >= MAX_STATES) return { type: 'unsolvable' };
        visited.add(key);
        queue.push({ state: next, moves: nextMoves });
      }
    }
  }

  return { type: 'unsolvable' };
}

function solvePartial(initialState: PuzzleState): SolveResult {
  type Node = { state: PuzzleState; moves: Move[] };
  const queue: Node[] = [{ state: initialState, moves: [] }];
  const visited = new Set<string>([stateKey(initialState)]);
  let longestMoves: Move[] = [];

  while (queue.length > 0 && visited.size < MAX_STATES) {
    const { state, moves } = queue.shift()!;
    if (moves.length > longestMoves.length) longestMoves = moves;

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

  // Compute reveal hints from the initial state so hints reflect
  // tubes where a known top color directly overlies a ? layer,
  // giving the user actionable guidance before making any moves.
  const revealHints = findRevealHints(initialState);
  return { type: 'partial', moves: longestMoves, revealHints };
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
