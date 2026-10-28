/**
 * Maps terminal input to an intent. Slash commands are exact; free text is matched against
 * the manifest's `karl.aliases` plus a few fixed topics. Pure, so it's unit-tested.
 */
export const COMMANDS = [
  'help',
  'cv',
  'ndt',
  'skills',
  'contact',
  'core',
  'noctus',
  'clear',
  'exit',
  'karr',
  'lab',
  'deck',
  'vantage',
  'focus',
  'zoom',
] as const;
export type Command = (typeof COMMANDS)[number];

export type Topic = 'core' | 'noctus' | 'skills' | 'contact' | 'help' | 'identity' | 'ndt' | 'cv';

export type Intent =
  | { type: 'empty' }
  | { type: 'command'; command: Command; args?: string }
  | { type: 'entry'; id: string }
  | { type: 'topic'; topic: Topic }
  | { type: 'unknown'; input: string };

/** Fixed topic keywords. CV entries come from the manifest aliases instead. */
export const TOPIC_KEYWORDS: Record<Topic, string[]> = {
  core: ['core', 'star', 'fusion', 'reactor', 'power source', 'chandrasekhar', 'supernova'],
  noctus: ['noctus', 'umbra', 'rpg', 'dnd', 'd&d', 'dungeons', 'campaign', 'play a game'],
  skills: ['skill', 'skills', 'stack', 'tech stack', 'languages', 'tools'],
  contact: ['contact', 'email', 'hire', 'linkedin', 'github', 'reach'],
  help: ['help', 'commands', 'what can you do'],
  identity: ['who are you', 'karl', 'k.a.r.l', 'kitt', 'about you'],
  ndt: ['non-destructive', 'nondestructive', 'certification', 'certified'],
  cv: ['cv', 'resume', 'résumé', 'career', 'background'],
};

const normalise = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}&.\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whole-word (or whole-phrase) match; returns the phrase length, or 0. */
function matchLength(text: string, phrase: string): number {
  const p = normalise(phrase);
  if (!p) return 0;
  const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(p)}($|[^\\p{L}\\p{N}])`, 'u');
  return re.test(text) ? p.length : 0;
}

export function parseInput(raw: string, aliases: Record<string, string[]>): Intent {
  const input = raw.trim();
  if (!input) return { type: 'empty' };

  if (input.startsWith('/')) {
    const [head, ...rest] = input.slice(1).split(/\s+/);
    const name = head!.toLowerCase();
    const args = rest.join(' ').trim();
    if (!(COMMANDS as readonly string[]).includes(name)) return { type: 'unknown', input };
    return args
      ? { type: 'command', command: name as Command, args }
      : { type: 'command', command: name as Command };
  }

  const text = normalise(input);
  let best: Intent = { type: 'unknown', input };
  let bestLen = 0;

  // Longest matching phrase wins, so "lead life" beats "lead developer" for "lead life".
  for (const [id, phrases] of Object.entries(aliases)) {
    for (const phrase of phrases) {
      const len = matchLength(text, phrase);
      if (len > bestLen) {
        best = { type: 'entry', id };
        bestLen = len;
      }
    }
  }
  for (const [topic, phrases] of Object.entries(TOPIC_KEYWORDS) as [Topic, string[]][]) {
    for (const phrase of phrases) {
      const len = matchLength(text, phrase);
      if (len > bestLen) {
        best = { type: 'topic', topic };
        bestLen = len;
      }
    }
  }
  return best;
}
