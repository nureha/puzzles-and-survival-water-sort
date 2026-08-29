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

  test('unsolvable で onRestart があればリスタートボタンを表示し押下で呼ぶ', () => {
    const onRestart = vi.fn();
    render(
      <SolutionList
        result={{ type: 'unsolvable' }}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
        onRestart={onRestart}
      />
    );
    const btn = screen.getByRole('button', { name: 'リスタート' });
    fireEvent.click(btn);
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  test('unsolvable で onRestart が無ければリスタートボタンを出さない', () => {
    render(
      <SolutionList
        result={{ type: 'unsolvable' }}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.queryByRole('button', { name: 'リスタート' })).not.toBeInTheDocument();
  });

  test('クリア済み solved はメッセージのみで保存欄が無い', () => {
    render(
      <SolutionList
        result={{ type: 'solved', moves: [{ from: 0, to: 1 }] }}
        completedCount={1}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByText('🎉 クリア！')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
  });
});

describe('SolutionList partial 分岐（最大露出手順）', () => {
  const twoRevealResult = {
    type: 'partial' as const,
    moves: [
      { from: 0, to: 2, revealsTube: 0 },
      { from: 1, to: 3, revealsTube: 1 },
    ],
    revealHints: [
      { tubeIndex: 0, stepIndex: 0, description: '' },
      { tubeIndex: 1, stepIndex: 1, description: '' },
    ],
  };

  test('露出手にステップ印を表示する', () => {
    render(
      <SolutionList
        result={twoRevealResult}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByText('← 試験管1 の ? が判明')).toBeInTheDocument();
    expect(screen.getByText('← 試験管2 の ? が判明')).toBeInTheDocument();
  });

  test('見出しに判明する ? の個数を出す', () => {
    render(
      <SolutionList
        result={twoRevealResult}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByText('? を判明させる手順（2個の ? が判明します）:')).toBeInTheDocument();
  });

  test('末尾サマリに判明する試験管をすべて並べる', () => {
    render(
      <SolutionList
        result={twoRevealResult}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(screen.getByText('試験管1・試験管2')).toBeInTheDocument();
    expect(screen.getByText(/判明した色を入力して/)).toBeInTheDocument();
  });

  test('露出できる手順が無いとき理由を明示する', () => {
    render(
      <SolutionList
        result={{ type: 'partial', moves: [], revealHints: [] }}
        completedCount={0}
        boardTubes={knownTubes}
        onStepToggle={vi.fn()}
        onReset={vi.fn()}
      />
    );
    expect(
      screen.getByText('動かせる既知のブロックが無く、? を判明させる手順がありません。')
    ).toBeInTheDocument();
  });
});
