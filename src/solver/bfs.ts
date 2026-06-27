import type { PuzzleState, Move, SolveResult } from './types';

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

// Placeholder — implemented in Task 4
export function solve(_state: PuzzleState): SolveResult {
  return { type: 'unsolvable' };
}
