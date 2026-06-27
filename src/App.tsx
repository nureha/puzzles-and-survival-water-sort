import { useState, useRef, useEffect } from 'react';
import { TubeGrid } from './components/TubeGrid';
import { SolutionList } from './components/SolutionList';
import { SaveModal } from './components/SaveModal';
import { useSaves } from './hooks/useSaves';
import { validateTubes } from './solver/constraints';
import { applyMove } from './solver/bfs';
import { uiToInternal, internalToUI } from './solver/types';
import type { UITube, SolveResult } from './solver/types';
import type { SaveEntry } from './hooks/useSaves';
import type { WorkerOutMessage } from './solver/solver.worker';
import './App.css';

function makeEmptyTubes(count: number): UITube[] {
  return Array.from({ length: count }, () => ['', '', '', ''] as UITube);
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
  const [showSaveModal, setShowSaveModal] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const { saves, save, remove, overwrite } = useSaves();

  useEffect(() => {
    return () => { workerRef.current?.terminate(); };
  }, []);

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
    setTubes(newTubes);
    setResult(null);
    setError(null);
    resetProgress();
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
    setSolving(true);
    setSolverStates(0);
    setInitialTubes(tubes);
    setCompletedCount(0);

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

  return (
    <div className="app">
      <h1>Water Sort Solver</h1>
      <div className="panels">
        <div className="panel">
          <div className="tube-count-row">
            <label>本数:</label>
            <button onClick={() => handleTubeCountChange(-1)} disabled={tubeCount <= 2}>−</button>
            <span className="tube-count-value">{tubeCount}</span>
            <button onClick={() => handleTubeCountChange(1)} disabled={tubeCount >= 20}>+</button>
          </div>
          <div className="tube-grid-scroll">
            <TubeGrid tubes={tubes} onChange={handleTubesChange} />
          </div>
          {error && <p className="error">{error}</p>}
          <div className="action-row">
            <button className="solve-btn" onClick={handleSolve} disabled={solving}>
              {solving ? '解いています...' : '解く'}
            </button>
            <button className="save-load-btn" onClick={() => setShowSaveModal(true)}>
              保存 / 読み込み
            </button>
          </div>
        </div>
        <div className="panel">
          {solving ? (
            <div className="solving">
              <div className="progress-bar" />
              <p className="solving-label">
                探索中{solverStates > 0 ? `（${solverStates.toLocaleString()} 状態）` : ''}
              </p>
            </div>
          ) : (
            <SolutionList
              result={result}
              completedCount={completedCount}
              onStepToggle={handleStepToggle}
              onReset={handleReset}
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
