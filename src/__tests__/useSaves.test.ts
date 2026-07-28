import { describe, test, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSaves } from '../hooks/useSaves';
import type { UITube } from '../solver/types';

describe('useSaves.save', () => {
  beforeEach(() => localStorage.clear());

  test('save は新しいエントリの id を返し、その id で保存される', () => {
    const board: UITube[] = [['A', 'A', 'A', 'A']];
    const { result } = renderHook(() => useSaves());
    let id = '';
    act(() => {
      id = result.current.save('テスト', board);
    });
    expect(id).toBeTruthy();
    expect(result.current.saves[0].id).toBe(id);
  });
});
