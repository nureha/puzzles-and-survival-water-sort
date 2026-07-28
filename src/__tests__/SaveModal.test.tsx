import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SaveModal } from '../components/SaveModal';
import type { UITube } from '../solver/types';
import type { SaveEntry } from '../hooks/useSaves';

const startBoard: UITube[] = [['A', 'A', 'A', 'A'], ['B', 'B', '?', '?']];
const midBoard: UITube[] = [['A', 'B', '', '']];

const baseProps = {
  saves: [] as SaveEntry[],
  onSave: vi.fn(),
  onLoad: vi.fn(),
  onDelete: vi.fn(),
  onOverwrite: vi.fn(),
  onClose: vi.fn(),
};

describe('SaveModal スタート状態ガード', () => {
  afterEach(() => vi.restoreAllMocks());

  test('非スタート状態では保存できずアラートを出す', () => {
    const onSave = vi.fn();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    render(<SaveModal {...baseProps} tubes={midBoard} onSave={onSave} />);
    fireEvent.change(screen.getByPlaceholderText(/名前を入力/), { target: { value: 'テスト' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalled();
  });

  test('スタート状態なら保存できる', () => {
    const onSave = vi.fn();
    render(<SaveModal {...baseProps} tubes={startBoard} onSave={onSave} />);
    fireEvent.change(screen.getByPlaceholderText(/名前を入力/), { target: { value: 'テスト' } });
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(onSave).toHaveBeenCalledWith('テスト', startBoard);
  });
});

describe('SaveModal 進行中データ', () => {
  const entry: SaveEntry = { id: 'e1', name: 'ステージ1', tubes: startBoard, savedAt: 0 };

  test('active のとき上書き保存ボタンと（進行中）表示', () => {
    const onOverwrite = vi.fn();
    render(
      <SaveModal {...baseProps} tubes={startBoard} saves={[entry]} activeEntryId="e1" onOverwrite={onOverwrite} />
    );
    fireEvent.click(screen.getByRole('button', { name: '上書き保存' }));
    expect(onOverwrite).toHaveBeenCalledWith('e1', startBoard);
    expect(screen.getAllByText(/進行中/).length).toBeGreaterThan(0);
  });
});
