import { useState } from 'react';
import type { UITube } from '../solver/types';
import { formatTubes } from '../report/formatBoard';
import { isReportEnabled, submitBoardReport } from '../report/reportBoard';
import type { ReportMode } from '../report/reportBoard';

interface ReportBoardSectionProps {
  tubes: UITube[];
  deep?: boolean;
}

type Status = 'idle' | 'confirm' | 'sending' | 'sent' | 'error';

export function ReportBoardSection({ tubes, deep }: ReportBoardSectionProps) {
  const [status, setStatus] = useState<Status>('idle');

  if (!isReportEnabled()) return null;
  if (tubes.some(tube => tube.includes('?'))) return null;

  const handleSubmit = async () => {
    setStatus('sending');
    const mode: ReportMode = deep ? '深い探索（120秒）' : '通常探索';
    const success = await submitBoardReport(formatTubes(tubes), mode);
    setStatus(success ? 'sent' : 'error');
  };

  if (status === 'sent') {
    return <p className="report-board-sent-msg">送信しました。ご協力ありがとうございます！</p>;
  }

  return (
    <div className="report-board">
      {status === 'idle' ? (
        <button className="report-board-btn" onClick={() => setStatus('confirm')}>
          この盤面を共有して改善に協力する
        </button>
      ) : (
        <>
          <p className="report-board-desc">盤面情報を開発者に送信します。送信すると元に戻せません。</p>
          {status === 'error' && (
            <p className="report-board-error">送信に失敗しました。時間をおいて再度お試しください。</p>
          )}
          <div className="report-board-actions">
            <button className="report-board-btn" onClick={handleSubmit} disabled={status === 'sending'}>
              {status === 'sending' ? '送信中...' : '送信する'}
            </button>
            <button
              className="report-board-cancel-btn"
              onClick={() => setStatus('idle')}
              disabled={status === 'sending'}
            >
              キャンセル
            </button>
          </div>
        </>
      )}
    </div>
  );
}
