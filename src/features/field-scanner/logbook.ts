/** Which specimens a visitor has scanned. Pure parsing, plus a storage wrapper that fails safe. */

export const LOGBOOK_KEY = 'mtbcv:scanner:logbook';

/** Read a stored logbook, keeping only keys that still exist. Anything malformed is empty. */
export function parseLogbook(raw: string | null, known: ReadonlySet<string>): Set<string> {
  if (!raw) return new Set();
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return new Set();
    return new Set(value.filter((k): k is string => typeof k === 'string' && known.has(k)));
  } catch {
    return new Set();
  }
}

export function serializeLogbook(logged: ReadonlySet<string>): string {
  return JSON.stringify([...logged].sort());
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadLogbook(known: ReadonlySet<string>): Set<string> {
  try {
    return parseLogbook(storage()?.getItem(LOGBOOK_KEY) ?? null, known);
  } catch {
    return new Set();
  }
}

export function saveLogbook(logged: ReadonlySet<string>): void {
  try {
    storage()?.setItem(LOGBOOK_KEY, serializeLogbook(logged));
  } catch {
    // Private windows and full storage: the logbook just won't survive a reload.
  }
}
