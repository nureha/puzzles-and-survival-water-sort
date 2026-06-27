import { useState, useCallback } from 'react';
import type { UITube } from '../solver/types';

const STORAGE_KEY = 'pas-water-sort-saves';

export type SaveEntry = {
  id: string;
  name: string;
  tubes: UITube[];
  savedAt: number;
};

function loadFromStorage(): SaveEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SaveEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(saves: SaveEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
}

export function useSaves() {
  const [saves, setSaves] = useState<SaveEntry[]>(loadFromStorage);

  const save = useCallback((name: string, tubes: UITube[]) => {
    const entry: SaveEntry = { id: Date.now().toString(), name, tubes, savedAt: Date.now() };
    setSaves(prev => {
      const next = [entry, ...prev];
      persist(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setSaves(prev => {
      const next = prev.filter(s => s.id !== id);
      persist(next);
      return next;
    });
  }, []);

  const overwrite = useCallback((id: string, tubes: UITube[]) => {
    setSaves(prev => {
      const next = prev.map(s =>
        s.id === id ? { ...s, tubes, savedAt: Date.now() } : s
      );
      persist(next);
      return next;
    });
  }, []);

  return { saves, save, remove, overwrite };
}
