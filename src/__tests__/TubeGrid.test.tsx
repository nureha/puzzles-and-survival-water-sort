import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TubeGrid } from '../components/TubeGrid';
import type { UITube } from '../solver/types';

const twoEmptyTubes = (): UITube[] => [
  ['', '', '', ''],
  ['', '', '', ''],
];

test('renders 4 cells per tube', () => {
  render(<TubeGrid tubes={twoEmptyTubes()} onChange={vi.fn()} />);
  // 2 tubes × 4 cells = 8 inputs
  expect(screen.getAllByRole('textbox')).toHaveLength(8);
});

test('calls onChange when a cell value changes', async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(<TubeGrid tubes={twoEmptyTubes()} onChange={onChange} />);
  const inputs = screen.getAllByRole('textbox');
  await user.type(inputs[0], 'A');
  expect(onChange).toHaveBeenCalled();
});

test('cascades ? to all cells below when ? is entered', async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  const tubes: UITube[] = [['A', '', '', ''], ['', '', '', '']];
  render(<TubeGrid tubes={tubes} onChange={onChange} />);
  const inputs = screen.getAllByRole('textbox');
  await user.type(inputs[1], '?');
  const lastCall: UITube[] = onChange.mock.calls[onChange.mock.calls.length - 1][0];
  expect(lastCall[0][1]).toBe('?');
  expect(lastCall[0][2]).toBe('?');
  expect(lastCall[0][3]).toBe('?');
});

test('cells below a ? are disabled', () => {
  const tubes: UITube[] = [['A', '?', '?', '?'], ['', '', '', '']];
  render(<TubeGrid tubes={tubes} onChange={vi.fn()} />);
  const inputs = screen.getAllByRole('textbox');
  // inputs[0]=tube1cell1(A), inputs[1]=tube1cell2(?), inputs[2]=tube1cell3(?*disabled), inputs[3]=tube1cell4(?*disabled)
  expect(inputs[2]).toBeDisabled();
  expect(inputs[3]).toBeDisabled();
});
