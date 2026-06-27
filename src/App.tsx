import { useState } from 'react';
import { TubeGrid } from './components/TubeGrid';
import { SolutionList } from './components/SolutionList';
import { solve } from './solver/bfs';
import { validateTubes } from './solver/constraints';
import { uiToInternal } from './solver/types';
import type { UITube, SolveResult } from './solver/types';
import './App.css';

function makeEmptyTubes(count: number): UITube[] {
  return Array.from({ length: count }, () => ['', '', '', ''] as UITube);
}

function App() {
  const [tubeCount, setTubeCount] = useState(3);
  const [tubes, setTubes] = useState<UITube[]>(makeEmptyTubes(3));
  const [result, setResult] = useState<SolveResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const handleTubeCountChange = (delta: number) => {
    const next = Math.max(2, Math.min(20, tubeCount + delta));
    setTubeCount(next);
    setTubes(prev => {
      if (next > prev.length) {
        return [...prev, ...makeEmptyTubes(next - prev.length)];
      }
      return prev.slice(0, next);
    });
    setResult(null);
    setError(null);
    setCompletedSteps(new Set());
  };

  const handleTubesChange = (newTubes: UITube[]) => {
    setTubes(newTubes);
    setResult(null);
    setError(null);
    setCompletedSteps(new Set());
  };

  const handleSolve = () => {
    const validationError = validateTubes(tubes);
    if (validationError) {
      setError(validationError);
      setResult(null);
      return;
    }
    setError(null);
    const state = tubes.map(uiToInternal);
    setResult(solve(state));
    setCompletedSteps(new Set());
  };

  const handleStepToggle = (index: number) => {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
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
          <TubeGrid tubes={tubes} onChange={handleTubesChange} />
          {error && <p className="error">{error}</p>}
          <button className="solve-btn" onClick={handleSolve}>解く</button>
        </div>
        <div className="panel">
          <SolutionList
            result={result}
            completedSteps={completedSteps}
            onStepToggle={handleStepToggle}
            onReset={() => setCompletedSteps(new Set())}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
