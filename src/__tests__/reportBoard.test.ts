import { describe, test, expect, vi, afterEach } from 'vitest';
import { getReportEndpoint, isReportEnabled, submitBoardReport } from '../report/reportBoard';

describe('reportBoard', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  test('VITE_REPORT_ENDPOINT が未設定なら isReportEnabled は false', () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', '');
    expect(isReportEnabled()).toBe(false);
  });

  test('VITE_REPORT_ENDPOINT が設定されていれば取得でき isReportEnabled は true', () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    expect(getReportEndpoint()).toBe('https://example.com/exec');
    expect(isReportEnabled()).toBe(true);
  });

  test('未設定の場合 submitBoardReport は fetch せず false を返す', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitBoardReport('AB, 空', '通常探索');

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('送信成功時は true を返し、Content-Type を指定しないPOSTを送る', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitBoardReport('AB, 空', '通常探索');

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('https://example.com/exec', {
      method: 'POST',
      body: JSON.stringify({ board: 'AB, 空', mode: '通常探索' }),
    });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers).toBeUndefined();
  });

  test('レスポンスの ok が false の場合は false を返す', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false }),
    }));

    expect(await submitBoardReport('AB', '通常探索')).toBe(false);
  });

  test('HTTPステータスが失敗の場合は false を返す', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ ok: true }),
    }));

    expect(await submitBoardReport('AB', '通常探索')).toBe(false);
  });

  test('fetch が例外を投げた場合は false を返す', async () => {
    vi.stubEnv('VITE_REPORT_ENDPOINT', 'https://example.com/exec');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    expect(await submitBoardReport('AB', '通常探索')).toBe(false);
  });
});
