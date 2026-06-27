/// <reference lib="webworker" />
import { solve } from './bfs';
import { uiToInternal } from './types';
import type { UITube, SolveResult } from './types';

export type WorkerInMessage = UITube[];
export type WorkerOutMessage =
  | { type: 'progress'; states: number }
  | { type: 'result'; result: SolveResult };

self.onmessage = (e: MessageEvent<WorkerInMessage>) => {
  const state = e.data.map(uiToInternal);
  const result = solve(state, (n) => {
    self.postMessage({ type: 'progress', states: n } satisfies WorkerOutMessage);
  });
  self.postMessage({ type: 'result', result } satisfies WorkerOutMessage);
};
