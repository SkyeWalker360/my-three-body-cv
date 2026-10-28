'use client';

import { useMachine } from '@xstate/react';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { asset } from '@/lib/asset';
import { emit, on } from '@/lib/events';
import { manifestData as manifest } from '@/lib/manifest-data';
import { line, type Line } from '@/lib/terminal';
import type { InkRunner, RpgOutput } from '../noctus/InkRunner';
import CoreGauge from './CoreGauge';
import { parseInput, type Intent } from './intents';
import Larson from './Larson';
import { type KarlMode, karlMachine } from './machine';
import {
  CORE_LABEL,
  contactLines,
  coreLines,
  cvLines,
  entryLines,
  greetingLines,
  helpLines,
  identityLines,
  ndtLines,
  skillsLines,
  unknownLines,
} from './responses';

type Entry = Line & { id: number };

const TONE_CLASS: Record<NonNullable<Line['tone']>, string> = {
  normal: 'text-ink',
  heading: 'text-gold',
  muted: 'text-ink-muted',
  accent: 'text-cyan',
  error: 'text-red',
  roll: 'text-gold',
  echo: 'text-cyan',
  story: 'text-violet-ink',
};

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Layer 2: K.A.R.L. A native modal <dialog> (focus stays inside, Escape closes, focus goes
 * back to the opener) with a DOM log that screen readers announce and visitors can select.
 */
export default function Terminal({ initialCommand }: { initialCommand?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const opener = useRef<Element | null>(null);
  const runner = useRef<InkRunner | null>(null);
  const nextId = useRef(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [choices, setChoices] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snapshot, send, actor] = useMachine(karlMachine);
  const mode = snapshot.value as KarlMode;

  const append = useCallback((lines: Line[]) => {
    setEntries((prev) => [...prev, ...lines.map((l) => ({ ...l, id: nextId.current++ }))]);
  }, []);

  const showRpg = useCallback(
    (out: RpgOutput) => {
      append(out.lines);
      setChoices(out.choices);
    },
    [append],
  );

  const getRunner = useCallback(async () => {
    if (!runner.current) {
      const { InkRunner } = await import('../noctus/InkRunner');
      runner.current = new InkRunner(async (act) => {
        const res = await fetch(asset(`/noctus/act-${act}.json`));
        if (!res.ok) throw new Error(`Act ${act} is unavailable (${res.status})`);
        return res.text();
      }, storage());
    }
    return runner.current;
  }, []);

  const close = useCallback(() => dialog.current?.close(), []);
  const deckStatus = useRef<string[]>([]);
  useEffect(
    () =>
      on('deck:status', ({ lines }) => {
        deckStatus.current = lines;
      }),
    [],
  );

  const respond = useCallback(
    async (intent: Intent) => {
      const current = actor.getSnapshot().value as KarlMode;
      const toCv = () => {
        if (current !== 'karr') send({ type: 'CV' });
      };
      switch (intent.type) {
        case 'empty':
          return;
        case 'unknown':
          append(unknownLines(intent.input));
          return;
        case 'entry':
          toCv();
          append(entryLines(manifest, intent.id));
          return;
        case 'topic':
        case 'command': {
          const name = intent.type === 'topic' ? intent.topic : intent.command;
          switch (name) {
            case 'help':
              append(helpLines());
              return;
            case 'identity':
              append(identityLines(manifest));
              return;
            case 'cv':
              toCv();
              append(cvLines(manifest));
              return;
            case 'ndt':
              toCv();
              append(ndtLines(manifest));
              return;
            case 'skills':
              toCv();
              append(skillsLines(manifest));
              return;
            case 'contact':
              append(contactLines(manifest));
              return;
            case 'core':
              append(coreLines(manifest));
              return;
            case 'clear':
              setEntries([]);
              return;
            case 'lab':
              append([line('Opening the lab view on the observation deck.', 'muted')]);
              close();
              emit('deck:open', { view: 'lab' });
              return;
            case 'deck': {
              // Narration only when asked (Luke, 28 Oct): read out the deck's latest status.
              const status = deckStatus.current;
              append([
                line('OBSERVATION DECK', 'heading'),
                ...(status.length
                  ? status.map((s) => line(s))
                  : [line('Opening the deck. Ask again with /deck once you have looked around.')]),
              ]);
              emit('deck:open', { view: 'deck' });
              return;
            }
            case 'vantage':
            case 'focus':
            case 'zoom': {
              const args = intent.type === 'command' ? (intent.args ?? '') : '';
              if (!args) {
                append([
                  line(
                    `Usage: /${name} ${name === 'zoom' ? '10' : name === 'focus' ? 'star 2' : 'hole'}`,
                    'muted',
                  ),
                ]);
                return;
              }
              const zoom = name === 'zoom' ? Number.parseFloat(args) : undefined;
              if (name === 'zoom' && !(zoom! >= 1)) {
                append([line('Zoom runs from 1× to 50×.', 'muted')]);
                return;
              }
              append([line(`Deck: ${name} ${args}.`, 'muted')]);
              close();
              emit(
                'deck:command',
                name === 'vantage'
                  ? { vantage: args }
                  : name === 'focus'
                    ? { focus: args }
                    : { zoom },
              );
              emit('deck:open', { view: 'deck' });
              return;
            }
            case 'karr':
              if (current === 'rpg') {
                append([line('Finish or /exit the campaign first.', 'muted')]);
                return;
              }
              send({ type: 'KARR' });
              append([
                line(
                  current === 'karr'
                    ? 'KITT mode restored.'
                    : 'KARR mode engaged. Amber scanner online.',
                  'muted',
                ),
              ]);
              return;
            case 'exit':
              if (current === 'idle') close();
              else {
                send({ type: 'EXIT' });
                setChoices([]);
                append([
                  line(
                    current === 'rpg' ? 'Campaign saved. Back on the bridge.' : 'Mode cleared.',
                    'muted',
                  ),
                ]);
              }
              return;
            case 'noctus': {
              send({ type: 'RPG' });
              setBusy(true);
              try {
                showRpg((await getRunner()).menu());
              } finally {
                setBusy(false);
              }
              return;
            }
          }
        }
      }
    },
    [actor, append, close, getRunner, send, showRpg],
  );

  const run = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      append([line(`> ${trimmed}`, 'echo')]);
      const current = actor.getSnapshot().value as KarlMode;
      if (current === 'rpg' && !trimmed.startsWith('/')) {
        setBusy(true);
        try {
          showRpg(await (await getRunner()).handle(trimmed));
        } catch (e) {
          append([line(`The campaign archive failed to load: ${(e as Error).message}`, 'error')]);
        } finally {
          setBusy(false);
        }
        return;
      }
      await respond(parseInput(trimmed, manifest.karl.aliases));
    },
    [actor, append, getRunner, respond, showRpg],
  );

  const show = useCallback(
    (command?: string) => {
      const d = dialog.current;
      if (!d) return;
      if (!d.open) {
        opener.current = document.activeElement;
        d.showModal();
        setOpen(true);
        emit('karl:opened');
      }
      input.current?.focus();
      if (command) void run(command);
    },
    [run],
  );

  // Mount: greet, open with the command that triggered loading, then listen for later opens.
  const started = useRef(false);
  useEffect(() => {
    if (!started.current) {
      started.current = true;
      append(greetingLines(manifest));
      show(initialCommand);
    }
    return on('karl:open', (d) => show(d.command));
  }, [append, initialCommand, show]);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    const onClose = () => {
      setOpen(false);
      emit('karl:closed');
      const o = opener.current;
      if (o instanceof HTMLElement) o.focus();
    };
    d.addEventListener('close', onClose);
    return () => d.removeEventListener('close', onClose);
  }, []);

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries, choices]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const value = input.current?.value ?? '';
    if (input.current) input.current.value = '';
    void run(value);
  };

  return (
    <dialog
      ref={dialog}
      aria-labelledby="karl-title"
      className="karl-dialog m-auto h-[85dvh] max-h-[85dvh] w-[min(48rem,calc(100vw-2rem))] max-w-none border-2 border-cyan bg-transparent p-0 text-ink"
    >
      <div className="glass crt flex h-full flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-cyan/40 px-4 py-3">
          <h2 id="karl-title" className="font-pixel text-xs text-red">
            K.A.R.L. MARK-IV
          </h2>
          <Larson active={open} karr={mode === 'karr'} />
          <button
            type="button"
            onClick={close}
            className="font-pixel text-xs text-ink-muted hover:text-ink"
            aria-label="Close K.A.R.L."
          >
            ✕ CLOSE
          </button>
        </header>

        <div className="flex items-center gap-4 border-b border-cyan/20 px-4 py-2 font-terminal text-lg">
          <CoreGauge active={open} />
          <div>
            <p className="text-gold">CORE: {CORE_LABEL}</p>
            <p className="text-ink-muted">MODE: {mode.toUpperCase()} · TYPE /help FOR COMMANDS</p>
          </div>
        </div>

        <div
          ref={log}
          role="log"
          tabIndex={0}
          aria-live="polite"
          aria-label="K.A.R.L. log"
          className="flex-1 space-y-2 overflow-y-auto px-4 py-4 font-terminal text-lg leading-snug"
        >
          {entries.map((e) => (
            <p key={e.id} className={`whitespace-pre-wrap ${TONE_CLASS[e.tone ?? 'normal']}`}>
              {e.href ? (
                <a href={e.href} className="underline" target="_blank" rel="noreferrer">
                  {e.text}
                </a>
              ) : (
                e.text
              )}
            </p>
          ))}
          {choices.length > 0 && (
            <ol className="space-y-1 pt-2" aria-label="Choices">
              {choices.map((c, i) => (
                <li key={`${i}-${c}`}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(String(i + 1))}
                    className="text-left text-cyan hover:text-gold"
                  >
                    {i + 1}. {c}
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>

        <form
          onSubmit={onSubmit}
          className="flex items-center gap-2 border-t border-cyan/40 px-4 py-3"
        >
          <label htmlFor="karl-input" className="font-terminal text-lg text-gold">
            K.A.R.L.&gt;
          </label>
          <input
            ref={input}
            id="karl-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder={mode === 'rpg' ? 'Type a choice number…' : 'Ask, or type /help'}
            className="min-w-0 flex-1 bg-transparent font-terminal text-lg text-ink placeholder:text-ink-muted"
          />
          <button type="submit" disabled={busy} className="btn btn-cyan">
            SEND
          </button>
        </form>
      </div>
    </dialog>
  );
}
