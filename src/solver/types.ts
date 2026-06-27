// UITube: displayed top-to-bottom, always exactly 4 cells.
// index 0 = top (pours out first), index 3 = bottom.
// values: "A"–"Z" | "?" (unknown) | "" (empty slot)
export type UIColor = string;
export type UITube = [UIColor, UIColor, UIColor, UIColor];

// InternalTube: bottom-to-top stack. Length 0–4.
// index 0 = bottom, last element = top (next to pour out).
// "?" means unknown color.
export type InternalColor = string;
export type InternalTube = InternalColor[];
export type PuzzleState = InternalTube[];

export type Move = { from: number; to: number };

export type RevealHint = {
  tubeIndex: number;
  description: string;
};

export type SolveResult =
  | { type: 'solved'; moves: Move[] }
  | { type: 'unsolvable' }
  | { type: 'partial'; moves: Move[]; revealHints: RevealHint[] };

// UITube (top-to-bottom, length 4) → InternalTube (bottom-to-top stack)
export function uiToInternal(uiTube: UITube): InternalTube {
  return [...uiTube].filter(c => c !== '').reverse();
}

// InternalTube (bottom-to-top stack) → UITube (top-to-bottom, length 4)
export function internalToUI(tube: InternalTube): UITube {
  const topToBottom = [...tube].reverse();
  const padded = [...Array(4 - topToBottom.length).fill(''), ...topToBottom];
  return padded as UITube;
}

// Ensures ? cascades to all cells below the first ? (higher index = lower in tube).
// Example: ["A", "?", "B", ""] → ["A", "?", "?", "?"]
export function normalizeTube(tube: UITube): UITube {
  let questionFound = false;
  return tube.map(cell => {
    if (questionFound) return '?';
    if (cell === '?') { questionFound = true; return '?'; }
    return cell;
  }) as UITube;
}
