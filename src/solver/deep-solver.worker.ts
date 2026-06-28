/// <reference lib="webworker" />
import { solveDeep } from './bfs';
import { uiToInternal } from './types';
import type { UITube, Move } from './types';

export type DeepWorkerOutMessage =
  | { type: 'progress'; threshold: number }
  | { type: 'done'; moves: Move[] | null };

self.onmessage = (e: MessageEvent<UITube[]>) => {
  const state = e.data.map(uiToInternal);
  const moves = solveDeep(state, 120_000, (threshold) => {
    self.postMessage({ type: 'progress', threshold } satisfies DeepWorkerOutMessage);
  });
  self.postMessage({ type: 'done', moves } satisfies DeepWorkerOutMessage);
};
