import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReportBoardSection } from '../components/ReportBoardSection';
import type { UITube } from '../solver/types';

const knownTubes: UITube[] = [['A', 'B', '', '']];
const unknownTubes: UITube[] = [['A', '?', '?', '?']];

describe('ReportBoardSection', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test('送信先が未設定なら何も表示しない', () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', '');
    render(<ReportBoardSection tubes={knownTubes} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('盤面に ? が残っている場合は表示しない', () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    render(<ReportBoardSection tubes={unknownTubes} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  test('条件を満たすとボタンを表示し、クリックで確認表示に切り替わる', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    const user = userEvent.setup();
    render(<ReportBoardSection tubes={knownTubes} />);

    await user.click(screen.getByRole('button', { name: 'この盤面を共有して改善に協力する' }));

    expect(screen.getByText('盤面情報を開発者に送信します。送信すると元に戻せません。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '送信する' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'キャンセル' })).toBeInTheDocument();
  });

  test('キャンセルすると初期状態に戻る', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    const user = userEvent.setup();
    render(<ReportBoardSection tubes={knownTubes} />);

    await user.click(screen.getByRole('button', { name: 'この盤面を共有して改善に協力する' }));
    await user.click(screen.getByRole('button', { name: 'キャンセル' }));

    expect(screen.getByRole('button', { name: 'この盤面を共有して改善に協力する' })).toBeInTheDocument();
  });

  test('送信成功時に完了メッセージを表示する', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) }));
    const user = userEvent.setup();
    render(<ReportBoardSection tubes={knownTubes} />);

    await user.click(screen.getByRole('button', { name: 'この盤面を共有して改善に協力する' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    expect(await screen.findByText('送信しました。ご協力ありがとうございます！')).toBeInTheDocument();
  });

  test('送信失敗時にエラーメッセージと再送信ボタンを表示する', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const user = userEvent.setup();
    render(<ReportBoardSection tubes={knownTubes} />);

    await user.click(screen.getByRole('button', { name: 'この盤面を共有して改善に協力する' }));
    await user.click(screen.getByRole('button', { name: '送信する' }));

    expect(await screen.findByText('送信に失敗しました。時間をおいて再度お試しください。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '送信する' })).toBeInTheDocument();
  });
});
