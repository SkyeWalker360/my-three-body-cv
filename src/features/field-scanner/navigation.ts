/** The field scanner's controls as a pure state machine, for tests. */

export type ScannerView = 'list' | 'detail';

export type ScannerState = {
  /** 0 … regions − 1 are specimen regions; `regions` itself is the Options screen. */
  region: number;
  selected: number;
  view: ScannerView;
};

export type ScannerAction =
  | { type: 'up' | 'down' | 'left' | 'right' | 'a' | 'b' | 'options' }
  | { type: 'tab'; region: number }
  | { type: 'pick'; index: number };

export const INITIAL: ScannerState = { region: 0, selected: 0, view: 'list' };

const wrap = (i: number, n: number) => (n > 0 ? ((i % n) + n) % n : 0);

/**
 * `sizes` holds the specimen count of each region. In a log, ▲▼ scroll the text, which is
 * the component's job, so they leave the state alone here.
 */
export function step(
  s: ScannerState,
  action: ScannerAction,
  sizes: readonly number[],
): ScannerState {
  const options = sizes.length;
  const count = sizes[s.region] ?? 0;
  switch (action.type) {
    case 'tab':
      return { region: wrap(action.region, options + 1), selected: 0, view: 'list' };
    case 'options':
      return { region: options, selected: 0, view: 'list' };
    case 'pick':
      if (s.region === options || action.index < 0 || action.index >= count) return s;
      // Picking the highlighted row opens it, like a second tap.
      return action.index === s.selected && s.view === 'list'
        ? { ...s, view: 'detail' }
        : { ...s, selected: action.index, view: 'list' };
    case 'left':
    case 'right': {
      const d = action.type === 'right' ? 1 : -1;
      if (s.view === 'detail') return { ...s, selected: wrap(s.selected + d, count) };
      return { region: wrap(s.region + d, options + 1), selected: 0, view: 'list' };
    }
    case 'up':
    case 'down':
      if (s.view === 'detail' || count === 0) return s;
      return { ...s, selected: wrap(s.selected + (action.type === 'down' ? 1 : -1), count) };
    case 'a':
      if (s.region === options || count === 0) return s;
      return { ...s, view: 'detail' };
    case 'b':
      if (s.view === 'detail') return { ...s, view: 'list' };
      if (s.region === options) return { region: 0, selected: 0, view: 'list' };
      return s;
  }
}

/** ▲ ▲ ▼ ▼ ◀ ▶ ◀ ▶ B A on the scanner's buttons: the hidden handheld arcade. */
export const CHEAT: readonly ScannerAction['type'][] = [
  'up',
  'up',
  'down',
  'down',
  'left',
  'right',
  'left',
  'right',
  'b',
  'a',
];

/**
 * How far into CHEAT the presses have got after `action`, given `progress` so far.
 * CHEAT.length means the code is complete. A wrong press restarts the count, keeping a
 * trailing ▲ (or ▲ ▲) as the start of a new attempt.
 */
export function cheatProgress(progress: number, action: ScannerAction['type']): number {
  if (action === CHEAT[progress]) return progress + 1;
  if (action !== 'up') return 0;
  return progress === 2 ? 2 : 1;
}
