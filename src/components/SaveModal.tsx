import { useState } from 'react';
import type { UITube } from '../solver/types';
import type { SaveEntry } from '../hooks/useSaves';

interface SaveModalProps {
  tubes: UITube[];
  saves: SaveEntry[];
  onSave: (name: string, tubes: UITube[]) => void;
  onLoad: (entry: SaveEntry) => void;
  onDelete: (id: string) => void;
  onOverwrite: (id: string, tubes: UITube[]) => void;
  onClose: () => void;
}

export function SaveModal({ tubes, saves, onSave, onLoad, onDelete, onOverwrite, onClose }: SaveModalProps) {
  const [name, setName] = useState('');

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave(trimmed, tubes);
    setName('');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">保存 / 読み込み</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-section">
          <p className="modal-section-title">現在の状態を保存</p>
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
              保存
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
                    <span className="save-entry-name">{entry.name}</span>
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
                    <button className="overwrite-btn" onClick={() => onOverwrite(entry.id, tubes)}>
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
