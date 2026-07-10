export type ReportMode = '通常探索' | '深い探索（120秒）';

export function getReportEndpoint(): string | undefined {
  return import.meta.env.VITE_REPORT_ENDPOINT;
}

export function isReportEnabled(): boolean {
  return Boolean(getReportEndpoint());
}

export async function submitBoardReport(board: string, mode: ReportMode): Promise<boolean> {
  const endpoint = getReportEndpoint();
  if (!endpoint) return false;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ board, mode }),
    });
    if (!response.ok) return false;
    const data: unknown = await response.json();
    return typeof data === 'object' && data !== null && (data as { ok?: unknown }).ok === true;
  } catch {
    return false;
  }
}
