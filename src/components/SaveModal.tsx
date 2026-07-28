import { useState } from 'react';
import type { UITube } from '../solver/types';
import type { SaveEntry } from '../hooks/useSaves';
import { isStartState } from '../board';

interface SaveModalProps {
  tubes: UITube[];
  saves: SaveEntry[];
  activeEntryId?: string | null;
  onSave: (name: string, tubes: UITube[]) => void;
  onLoad: (entry: SaveEntry) => void;
  onDelete: (id: string) => void;
  onOverwrite: (id: string, tubes: UITube[]) => void;
  onClose: () => void;
}

export function SaveModal({ tubes, saves, activeEntryId, onSave, onLoad, onDelete, onOverwrite, onClose }: SaveModalProps) {
  const [name, setName] = useState('');
  const activeEntry = activeEntryId ? saves.find(s => s.id === activeEntryId) : undefined;

  const guardSaveable = (): boolean => {
    if (tubes.every(tube => tube.every(c => c === ''))) { alert('盤面が空のため保存できません'); return false; }
    if (!isStartState(tubes)) { alert('スタート状態（各ボトルが満杯か空）でないと保存できません'); return false; }
    return true;
  };

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!guardSaveable()) return;
    onSave(trimmed, tubes);
    setName('');
  };

  const handleOverwriteActive = () => {
    if (!activeEntry) return;
    if (!guardSaveable()) return;
    onOverwrite(activeEntry.id, tubes);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">保存 / 読み込み</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <p className="modal-storage-note">データはサーバーには送信・保存されません</p>
        <p className="modal-storage-note">
          進行中データがあるとき、判明・訂正は自動保存されます。ただし推定解（? を仮定）の手を進めた途中での入力は保存されないことがあります（確実にするにはスタート状態で入力してください）。
        </p>

        <div className="modal-section">
          <p className="modal-section-title">現在の状態を保存</p>
          {activeEntry && (
            <p className="modal-active-note">進行中: {activeEntry.name}（保存すると上書きされます）</p>
          )}
          {activeEntry && (
            <div className="save-input-row">
              <button className="save-confirm-btn" onClick={handleOverwriteActive}>
                上書き保存
              </button>
            </div>
          )}
          <div className="save-input-row">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSave()}
              placeholder="名前を入力（例: ステージ5-3）"
              className="save-name-input"
              autoFocus
            />
            <button className="save-confirm-btn" onClick={handleSave} disabled={!name.trim()}>
              {activeEntry ? '別名で新規保存' : '保存'}
            </button>
          </div>
        </div>

        <div className="modal-section">
          <p className="modal-section-title">保存済みデータ</p>
          {saves.length === 0 ? (
            <p className="saves-empty">保存データはありません</p>
          ) : (
            <ul className="saves-list">
              {saves.map(entry => (
                <li key={entry.id} className="save-entry">
                  <div className="save-entry-info">
                    <span className="save-entry-name">
                      {entry.name}{entry.id === activeEntryId ? '（進行中）' : ''}
                    </span>
                    <span className="save-entry-date">
                      {new Date(entry.savedAt).toLocaleString('ja-JP', {
                        month: 'numeric',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="save-entry-actions">
                    <button className="overwrite-btn" onClick={() => {
                      if (!guardSaveable()) return;
                      onOverwrite(entry.id, tubes);
                    }}>
                      上書き
                    </button>
                    <button className="load-btn" onClick={() => {
                      if (!confirm('現在の盤面が消えてしまいますがよろしいですか？')) return;
                      onLoad(entry);
                      onClose();
                    }}>
                      読み込み
                    </button>
                    <button className="delete-btn" onClick={() => onDelete(entry.id)}>
                      削除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
