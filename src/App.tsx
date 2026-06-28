import { useState, useRef, useEffect } from 'react';
import { TubeGrid } from './components/TubeGrid';
import { SolutionList } from './components/SolutionList';
import { SimulationPanel } from './components/SimulationPanel';
import { SaveModal } from './components/SaveModal';
import { ShapeLegend } from './components/ShapeLegend';
import { useSaves } from './hooks/useSaves';
import { validateTubes, validateColorCounts } from './solver/constraints';
import { applyMove, isValidMove } from './solver/bfs';
import { uiToInternal, internalToUI, normalizeTube } from './solver/types';
import type { UITube, SolveResult } from './solver/types';
import type { SaveEntry } from './hooks/useSaves';
import type { WorkerOutMessage } from './solver/solver.worker';
import type { DeepWorkerOutMessage } from './solver/deep-solver.worker';
import './App.css';

function makeEmptyTubes(count: number): UITube[] {
  return Array.from({ length: count }, () => ['', '', '', ''] as UITube);
}

// For each tube with at least one entry, fill trailing empty slots with '?'.
// Represents hidden liquid at the bottom that the user hasn't entered yet.
function autoFillUnknown(tubes: UITube[]): UITube[] {
  return tubes.map(tube => {
    if (!tube.some(c => c !== '')) return tube;
    const result = [...tube] as UITube;
    for (let i = 3; i >= 0; i--) {
      if (result[i] === '') result[i] = '?';
      else break;
    }
    return normalizeTube(result);
  });
}

function App() {
  const [tubeCount, setTubeCount] = useState(3);
  const [tubes, setTubes] = useState<UITube[]>(makeEmptyTubes(3));
  const [initialTubes, setInitialTubes] = useState<UITube[] | null>(null);
  const [result, setResult] = useState<SolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [solving, setSolving] = useState(false);
  const [solverStates, setSolverStates] = useState(0);
  const [deepMode, setDeepMode] = useState(false);
  const [deepSolving, setDeepSolving] = useState(false);
  const [deepThreshold, setDeepThreshold] = useState(0);
  const [mode, setMode] = useState<'solver' | 'simulation'>('solver');
  const [simHistory, setSimHistory] = useState<UITube[][]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const deepWorkerRef = useRef<Worker | null>(null);
  const resultPanelRef = useRef<HTMLDivElement>(null);
  const { saves, save, remove, overwrite } = useSaves();

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      deepWorkerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    if ((solving || deepSolving) && window.innerWidth <= 600) {
      resultPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [solving, deepSolving]);

  const resetProgress = () => {
    setCompletedCount(0);
    setInitialTubes(null);
  };

  const handleTubeCountChange = (delta: number) => {
    const next = Math.max(2, Math.min(20, tubeCount + delta));
    setTubeCount(next);
    setTubes(prev => {
      if (next > prev.length) return [...prev, ...makeEmptyTubes(next - prev.length)];
      return prev.slice(0, next);
    });
    setResult(null);
    setError(null);
    resetProgress();
  };

  const handleTubesChange = (newTubes: UITube[]) => {
    setError(validateColorCounts(newTubes));

    // Compute new initial state (? propagation: map edits from mid-solution back to initial).
    // Diff must be done at the InternalTube (bottom-to-top) level, not UITube level.
    // After moves, the ? may sit at a different UITube index than in initialTubes because
    // cells that were originally above it have been moved away — but its InternalTube index
    // is invariant (the solver never moves ? cells).
    const updatedInitial: UITube[] = (completedCount > 0 && initialTubes)
      ? (() => {
          const initInternal = initialTubes.map(uiToInternal);
          const midInternal  = tubes.map(uiToInternal);
          const newInternal  = newTubes.map(uiToInternal);
          return initInternal.map((initTube, ti) =>
            internalToUI(initTube.map((cell, li) => {
              const prev = midInternal[ti]?.[li];
              const next = newInternal[ti]?.[li];
              return (prev !== undefined && next !== undefined && prev !== next) ? next : cell;
            }))
          );
        })()
      : newTubes;

    // If a solution exists, check whether all its moves are still valid from the new initial state.
    // If so, preserve the result and replay to the current progress position.
    if (result && 'moves' in result) {
      let state = updatedInitial.map(uiToInternal);
      let valid = true;
      for (const move of result.moves) {
        if (!isValidMove(state, move.from, move.to)) { valid = false; break; }
        state = applyMove(state, move.from, move.to);
      }
      if (valid) {
        let midState = updatedInitial.map(uiToInternal);
        for (let i = 0; i < completedCount; i++) {
          midState = applyMove(midState, result.moves[i].from, result.moves[i].to);
        }
        setInitialTubes(updatedInitial);
        setTubes(midState.map(internalToUI));
        return;
      }
    }

    // Default: clear result and reset to the new initial state
    setResult(null);
    setCompletedCount(0);
    setTubes(updatedInitial);
    setInitialTubes(null);
  };

  const handleSolve = () => {
    const validationError = validateTubes(tubes);
    if (validationError) {
      setError(validationError);
      setResult(null);
      return;
    }
    setError(null);
    setResult(null);
    setCompletedCount(0);
    setInitialTubes(tubes);

    if (deepMode) {
      workerRef.current?.terminate();
      deepWorkerRef.current?.terminate();
      setDeepSolving(true);
      setDeepThreshold(0);

      const deepWorker = new Worker(
        new URL('./solver/deep-solver.worker.ts', import.meta.url),
        { type: 'module' },
      );
      deepWorkerRef.current = deepWorker;

      deepWorker.onmessage = (e: MessageEvent<DeepWorkerOutMessage>) => {
        const msg = e.data;
        if (msg.type === 'progress') {
          setDeepThreshold(msg.threshold);
        } else {
          setDeepSolving(false);
          setResult(msg.moves ? { type: 'solved', moves: msg.moves } : { type: 'unsolvable', deep: true });
          deepWorker.terminate();
        }
      };
      deepWorker.onerror = () => {
        setDeepSolving(false);
        setResult({ type: 'unsolvable', deep: true });
        deepWorker.terminate();
      };
      deepWorker.postMessage(tubes);
      return;
    }

    setSolving(true);
    setSolverStates(0);
    workerRef.current?.terminate();
    const worker = new Worker(
      new URL('./solver/solver.worker.ts', import.meta.url),
      { type: 'module' },
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent<WorkerOutMessage>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        setSolverStates(msg.states);
      } else {
        setResult(msg.result);
        setSolving(false);
        worker.terminate();
      }
    };

    worker.onerror = () => {
      setError('内部エラーが発生しました');
      setSolving(false);
      worker.terminate();
    };

    worker.postMessage(tubes);
  };

  const handleStepToggle = (index: number) => {
    if (!result || !('moves' in result) || !initialTubes) return;
    const moves = result.moves;

    if (index === completedCount) {
      setTubes(prev => {
        const state = prev.map(uiToInternal);
        const next = applyMove(state, moves[index].from, moves[index].to);
        return next.map(internalToUI);
      });
      setCompletedCount(c => c + 1);
    } else if (index === completedCount - 1) {
      let state = initialTubes.map(uiToInternal);
      for (let i = 0; i < index; i++) {
        state = applyMove(state, moves[i].from, moves[i].to);
      }
      setTubes(state.map(internalToUI));
      setCompletedCount(c => c - 1);
    }
  };

  const handleLoad = (entry: SaveEntry) => {
    setTubeCount(entry.tubes.length);
    setTubes(entry.tubes);
    setResult(null);
    setError(null);
    resetProgress();
  };

  const handleReset = () => {
    if (initialTubes) setTubes(initialTubes);
    setCompletedCount(0);
  };

  const handleModeChange = (next: 'solver' | 'simulation') => {
    setMode(next);
    setSimHistory([]);
  };

  const handleSimMove = (from: number, to: number) => {
    setSimHistory(h => [...h, tubes]);
    setTubes(prev => {
      const next = prev.map(uiToInternal);
      return applyMove(next, from, to).map(internalToUI);
    });
  };

  const handleSimUndo = () => {
    setSimHistory(h => {
      const prev = h[h.length - 1];
      setTubes(prev);
      return h.slice(0, -1);
    });
  };

  const handleSimReset = () => {
    setTubes(simHistory[0]);
    setSimHistory([]);
  };


  const handleCopyState = () => {
    const formatTubes = (ts: UITube[]) =>
      ts.map(t => {
        const cells = t.filter(c => c !== '');
        return cells.length === 0 ? '空' : cells.join('');
      }).join(', ');

    const lines: string[] = [];

    if (initialTubes) {
      lines.push(`初期盤面: ${formatTubes(initialTubes)}`);
      lines.push(`現在の盤面: ${formatTubes(tubes)}`);
    } else {
      lines.push(`盤面: ${formatTubes(tubes)}`);
    }

    if (result && 'moves' in result) {
      const movesStr = result.moves
        .map((m, i) => {
          const label = `${m.from + 1}→${m.to + 1}${m.isSpeculative ? '(推定)' : ''}`;
          return i === completedCount - 1 ? `[${label}]` : label;
        })
        .join(', ');
      const type = result.type === 'speculative' ? '推定' : result.type === 'partial' ? '部分' : '確定';
      lines.push(`手順(${type}, ${completedCount}/${result.moves.length}完了): ${movesStr}`);
    }

    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="app">
      <div className="app-top-row">
        <h1>Water Sort Solver</h1>
        <div className="mode-toggle">
          <button
            className={`mode-btn${mode === 'solver' ? ' active' : ''}`}
            onClick={() => handleModeChange('solver')}
          >
            ソルバー
          </button>
          <button
            className={`mode-btn${mode === 'simulation' ? ' active' : ''}`}
            onClick={() => handleModeChange('simulation')}
          >
            シミュレーション
          </button>
        </div>
      </div>
      <div className="panels">
        <div className="panel">
          <div className="tube-count-row">
            <label>本数:</label>
            <button onClick={() => handleTubeCountChange(-1)} disabled={tubeCount <= 2}>−</button>
            <span className="tube-count-value">{tubeCount}</span>
            <button onClick={() => handleTubeCountChange(1)} disabled={tubeCount >= 20}>+</button>
            <a
              className="help-link"
              href="https://github.com/nureha/puzzles-and-survival-water-sort#readme"
              target="_blank"
              rel="noopener noreferrer"
            >
              使い方はこちら
            </a>
          </div>
          <ShapeLegend />
          <hr className="legend-divider" />
          <div className="tube-grid-scroll">
            <TubeGrid tubes={tubes} onChange={handleTubesChange} />
          </div>
          {error && <p className="error">{error}</p>}
          {mode === 'solver' ? (
            <>
              <label className="deep-mode-label">
                <input
                  type="checkbox"
                  checked={deepMode}
                  onChange={e => setDeepMode(e.target.checked)}
                />
                深い探索モード（最大120秒）
              </label>
              <div className="action-row">
                <button className="solve-btn" onClick={handleSolve} disabled={solving || deepSolving}>
                  {solving || deepSolving ? '解いています...' : '解く'}
                </button>
                <button className="save-load-btn" onClick={() => {
                  handleTubesChange(autoFillUnknown(tubes));
                  setShowSaveModal(true);
                }}>
                  保存 / 読み込み
                </button>
                {window.location.hostname === 'localhost' && (
                  <button className="save-load-btn" onClick={handleCopyState}>
                    {copied ? 'コピーしました' : '状態をコピー'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="action-row">
              <button className="save-load-btn" onClick={() => setShowSaveModal(true)}>
                保存 / 読み込み
              </button>
            </div>
          )}
        </div>
        <div className="panel" ref={resultPanelRef}>
          {mode === 'simulation' ? (
            <SimulationPanel
              tubes={tubes}
              moveCount={simHistory.length}
              canUndo={simHistory.length > 0}
              onMove={handleSimMove}
              onUndo={handleSimUndo}
              onReset={handleSimReset}
            />
          ) : solving ? (
            <div className="solving">
              <div className="progress-bar" />
              <p className="solving-label">
                探索中{solverStates > 0 ? `（${solverStates.toLocaleString()} 状態）` : ''}
              </p>
            </div>
          ) : deepSolving ? (
            <div className="solving">
              <div className="progress-bar" />
              <p className="solving-label">
                深く探索中...{deepThreshold > 0 ? `（深さ閾値: ${deepThreshold}）` : ''}
              </p>
            </div>
          ) : (
            <SolutionList
              result={result}
              completedCount={completedCount}
              onStepToggle={handleStepToggle}
              onReset={handleReset}
              onSaveInitial={name => save(name, initialTubes ?? tubes)}
            />
          )}
        </div>
      </div>

      {showSaveModal && (
        <SaveModal
          tubes={tubes}
          saves={saves}
          onSave={save}
          onLoad={handleLoad}
          onDelete={remove}
          onOverwrite={overwrite}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  );
}

export default App;
