export const LETTER_COLORS: Record<string, string> = {
  A: '#795548',
  B: '#e53935',
  C: '#43a047',
  D: '#0d47a1',
  E: '#f57c00',
  F: '#2e7d32',
  G: '#4e342e',
  H: '#8e24aa',
  I: '#f48fb1',
  J: '#e8a5b5',
  K: '#7c4dff',
  L: '#4dd0e1',
};

export function textColorForBg(bgHex: string): string {
  const r = parseInt(bgHex.slice(1, 3), 16);
  const g = parseInt(bgHex.slice(3, 5), 16);
  const b = parseInt(bgHex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#333333' : 'white';
}
