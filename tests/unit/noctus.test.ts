import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACTS } from '@/features/noctus/acts';
import { InkRunner, saveKey, type StorageLike } from '@/features/noctus/InkRunner';
import { compileInk } from '../../scripts/ink';

const dir = join(process.cwd(), 'content', 'noctus');
const stories = new Map(ACTS.map((a) => [a.number, compileInk(join(dir, `act-${a.number}.ink`))]));
const load = async (act: number) => stories.get(act as 1 | 2 | 3 | 4)!;

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};

/** Play an act to its END, picking choices with `pick`. Returns every line printed. */
async function playThrough(act: number, rng: () => number, pick: (n: number) => number) {
  const storage = new MemoryStorage();
  const runner = new InkRunner(load, storage, rng);
  runner.menu();
  let out = await runner.handle(String(act));
  const lines = [...out.lines];
  for (let guard = 0; guard < 200 && out.choices.length > 0; guard++) {
    out = await runner.handle(String(pick(out.choices.length) + 1));
    lines.push(...out.lines);
  }
  return { lines: lines.map((l) => l.text), runner, storage };
}

describe('Noctus Umbra', () => {
  it.each(ACTS.map((a) => a.number))('act %i compiles', (act) => {
    expect(stories.get(act)).toBeTruthy();
  });

  it.each(ACTS.map((a) => a.number))(
    'act %i reaches END on every seed with a recap',
    async (act) => {
      for (let seed = 1; seed <= 25; seed++) {
        const rng = seeded(seed);
        const { lines, runner, storage } = await playThrough(act, rng, (n) =>
          Math.floor(rng() * n),
        );
        expect(lines).toContain(`— END OF ACT ${act} —`);
        expect(lines.some((l) => l.startsWith('Recap:'))).toBe(true);
        expect(runner.playing).toBe(false);
        expect(JSON.parse(storage.getItem(saveKey(act))!)).toEqual({ done: true });
      }
    },
  );

  it('prints dice rolls against their DC', async () => {
    const { lines } = await playThrough(1, seeded(3), () => 0);
    expect(lines.some((l) => /d20 \(\d+\) [+−] \d+ = \d+ vs DC \d+ — (PASS|FAIL)/.test(l))).toBe(
      true,
    );
  });

  it('branches on the roll: high rolls and low rolls tell different stories', async () => {
    const high = await playThrough(
      1,
      () => 0.99,
      () => 0,
    );
    const low = await playThrough(
      1,
      () => 0,
      () => 0,
    );
    expect(high.lines.join('\n')).not.toEqual(low.lines.join('\n'));
    expect(high.lines.join('\n')).toContain('PASS');
    expect(low.lines.join('\n')).toContain('FAIL');
  });

  it('saves mid-act and offers continue or restart', async () => {
    const storage = new MemoryStorage();
    const first = new InkRunner(load, storage, seeded(1));
    first.menu();
    const opening = await first.handle('2');
    expect(opening.choices.length).toBeGreaterThan(0);
    expect(JSON.parse(storage.getItem(saveKey(2))!).state).toBeTruthy();

    const second = new InkRunner(load, storage, seeded(1));
    expect(second.menu().lines.some((l) => l.text.includes('(in progress)'))).toBe(true);
    const prompt = await second.handle('2');
    expect(prompt.lines[0]!.text).toMatch(/continue|restart/);
    const resumed = await second.handle('c');
    expect(resumed.choices).toEqual(opening.choices);
  });

  it('rejects out-of-range choices', async () => {
    const runner = new InkRunner(load, new MemoryStorage(), seeded(1));
    runner.menu();
    await runner.handle('1');
    const bad = await runner.handle('9');
    expect(bad.lines[0]!.tone).toBe('error');
  });

  it('survives storage that throws', async () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {},
    };
    const runner = new InkRunner(load, broken, seeded(1));
    runner.menu();
    const out = await runner.handle('4');
    expect(out.choices.length).toBeGreaterThan(0);
  });
});
