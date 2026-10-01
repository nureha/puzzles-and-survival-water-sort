import { test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShapeLegend } from '../components/ShapeLegend';

const entries = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('.shape-entry')];

test('凡例に矢じり(M)が含まれる', () => {
  render(<ShapeLegend />);
  expect(screen.getByTitle('矢じり')).toHaveTextContent('M');
});

test('矢じりは記号を図形として描画する', () => {
  render(<ShapeLegend />);
  // 対応する Unicode 文字が無いため SVG で描く。fill は背景に追従させる。
  const svg = screen.getByTitle('矢じり').querySelector('svg');
  expect(svg).not.toBeNull();
  expect(svg!.querySelector('path')).toHaveAttribute('fill', 'currentColor');
});

test('凡例の全図形に重複しない色が割り当てられている', () => {
  const { container } = render(<ShapeLegend />);
  const colors = entries(container).map(e => e.style.backgroundColor);
  expect(colors).toHaveLength(13);
  // '#888' は LETTER_COLORS に色が無いときのフォールバック
  expect(colors).not.toContain('rgb(136, 136, 136)');
  expect(new Set(colors).size).toBe(colors.length);
});
