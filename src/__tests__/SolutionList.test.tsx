import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('SolutionList 再探索・文言分岐', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('speculative で再探索ボタンを表示し押下で onResearch を呼ぶ', () => {
    const onResearch = vi.fn();
    render(
      <SolutionList
        result={{ type: 'speculative', moves: [{ from: 0, to: 1 }] }}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
        onResearch={onResearch}
      />
    );
    const btn = screen.getByRole('button', { name: 'この盤面から再探索' });
    fireEvent.click(btn);
    expect(onResearch).toHaveBeenCalledTimes(1);
  });

  test('partial で再探索ボタンを表示する', () => {
    render(
      <SolutionList
        result={{ type: 'partial', moves: [], revealHints: [] }}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
        onResearch={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'この盤面から再探索' })).toBeInTheDocument();
  });

  test('unsolvable かつ isResearch で途中盤面向け文言を出し共有ボタンを出さない', () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    render(
      <SolutionList
        result={{ type: 'unsolvable' }}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
        onResearch={vi.fn()}
        isResearch
      />
    );
    expect(
      screen.getByText(/この盤面（手順の途中）からは解が見つかりませんでした/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'この盤面を共有して改善に協力する' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'この盤面から再探索' })).toBeInTheDocument();
  });

  test('unsolvable かつ isResearch=false は従来文言＋共有ボタン', () => {
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
    expect(screen.getByText('解が見つかりませんでした')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'この盤面を共有して改善に協力する' })
    ).toBeInTheDocument();
  });
});
