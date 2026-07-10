import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SolutionList } from '../components/SolutionList';
import type { UITube } from '../solver/types';

const knownTubes: UITube[] = [['A', 'B', '', '']];

describe('SolutionList unsolvable branch', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('解なし判定かつ送信先が設定済みならレポートボタンを表示する', () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    render(
      <SolutionList
        result={{ type: 'unsolvable' }}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'この盤面を共有して改善に協力する' })).toBeInTheDocument();
  });

  test('解が見つかった場合はレポートボタンを表示しない', () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    render(
      <SolutionList
        result={{ type: 'solved', moves: [] }}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
      />
    );

    expect(screen.queryByRole('button', { name: 'この盤面を共有して改善に協力する' })).not.toBeInTheDocument();
  });
});
