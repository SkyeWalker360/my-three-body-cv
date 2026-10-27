/**
 * Runs the Noctus Umbra ink stories inside K.A.R.L.'s log: act menu, save/continue,
 * numbered choices and the dice externals. UI-free so it can be tested without a DOM.
 */
import { Story } from 'inkjs';
import { line, type Line } from '@/lib/terminal';
import { ACTS } from './acts';
import {
  describeCheck,
  describeContest,
  resolveCheck,
  resolveContest,
  rollD100Mine,
  type Rng,
} from './dice';

/** Resolves to the compiled story JSON for an act. */
export type StoryLoader = (act: number) => Promise<string>;

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type RpgOutput = {
  lines: Line[];
  /** Choices currently on offer, in order; the player types their 1-based number. */
  choices: string[];
};

type Save = { state?: string; done?: boolean };

type Mode =
  | { kind: 'menu' }
  | { kind: 'confirm'; act: number }
  | { kind: 'playing'; act: number; story: Story };

export const saveKey = (act: number) => `noctus:act-${act}`;

export class InkRunner {
  private mode: Mode = { kind: 'menu' };
  private pending: Line[] = [];

  constructor(
    private load: StoryLoader,
    private storage: StorageLike | null,
    private rng: Rng = Math.random,
  ) {}

  get playing(): boolean {
    return this.mode.kind === 'playing';
  }

  menu(): RpgOutput {
    this.mode = { kind: 'menu' };
    const lines = [line('NOCTUS UMBRA: THE HOLLOWBRAND GUILD', 'heading')];
    for (const act of ACTS) {
      const save = this.read(act.number);
      const status = save.state ? ' (in progress)' : save.done ? ' (complete)' : '';
      lines.push(line(`${act.number}. ${act.title}${status}`, 'accent'));
    }
    lines.push(line('Type 1–4 to pick an act, or /exit to leave the campaign.', 'muted'));
    return { lines, choices: [] };
  }

  async handle(input: string): Promise<RpgOutput> {
    const text = input.trim().toLowerCase();
    switch (this.mode.kind) {
      case 'menu': {
        const act = Number(text);
        if (!ACTS.some((a) => a.number === act)) {
          return { lines: [line('Pick an act from 1 to 4.', 'error')], choices: [] };
        }
        if (this.read(act).state) {
          this.mode = { kind: 'confirm', act };
          return {
            lines: [line(`Act ${act} has a save. Type c to continue or r to restart.`, 'muted')],
            choices: [],
          };
        }
        return this.start(act, false);
      }
      case 'confirm': {
        if (text === 'c' || text === 'continue') return this.start(this.mode.act, true);
        if (text === 'r' || text === 'restart') return this.start(this.mode.act, false);
        return { lines: [line('Type c to continue or r to restart.', 'error')], choices: [] };
      }
      case 'playing': {
        const { story } = this.mode;
        const index = Number(text) - 1;
        if (!Number.isInteger(index) || index < 0 || index >= story.currentChoices.length) {
          return {
            lines: [line(`Choose 1–${story.currentChoices.length}.`, 'error')],
            choices: this.choices(story),
          };
        }
        story.ChooseChoiceIndex(index);
        return this.advance();
      }
    }
  }

  private async start(act: number, resume: boolean): Promise<RpgOutput> {
    const json = await this.load(act);
    const story = new Story(json);
    story.BindExternalFunction(
      'roll',
      (stat: unknown, dc: unknown) => {
        const result = resolveCheck(String(stat), Number(dc), this.rng);
        this.pending.push(line(describeCheck(result), 'roll'));
        return result.pass;
      },
      false,
    );
    story.BindExternalFunction(
      'rollD100Mine',
      () => {
        const result = rollD100Mine(this.rng);
        this.pending.push(line(`🎲 Mine shift: d100 (${result.roll}) — ${result.find}`, 'roll'));
        return result.find;
      },
      false,
    );
    story.BindExternalFunction(
      'contest',
      (foeBonus: unknown, advantage: unknown) => {
        const bonus = Number(foeBonus);
        const result = resolveContest(bonus, Boolean(advantage), this.rng);
        this.pending.push(line(describeContest(result, bonus), 'roll'));
        return result.pass;
      },
      false,
    );
    this.mode = { kind: 'playing', act, story };

    const saved = resume ? this.read(act).state : undefined;
    if (saved) {
      story.state.LoadJson(saved);
      return {
        lines: [line(`Resuming ${ACTS[act - 1]!.title}.`, 'muted')],
        choices: this.choices(story),
      };
    }
    this.write(act, {});
    return this.advance();
  }

  /** Continue until the next choice point or the act's END. */
  private advance(): RpgOutput {
    if (this.mode.kind !== 'playing') return this.menu();
    const { story, act } = this.mode;
    const lines: Line[] = [];
    while (story.canContinue) {
      const text = (story.Continue() ?? '').trim();
      lines.push(...this.pending.splice(0));
      const tags = story.currentTags ?? [];
      if (text) lines.push(line(text, tags.includes('heading') ? 'heading' : 'story'));
    }
    lines.push(...this.pending.splice(0));

    if (story.currentChoices.length > 0) {
      this.write(act, { state: story.state.toJson() });
      return { lines, choices: this.choices(story) };
    }

    this.write(act, { done: true });
    const menu = this.menu();
    return {
      lines: [...lines, line(`— END OF ACT ${act} —`, 'heading'), ...menu.lines],
      choices: [],
    };
  }

  private choices(story: Story): string[] {
    return story.currentChoices.map((c) => c.text);
  }

  private read(act: number): Save {
    try {
      const raw = this.storage?.getItem(saveKey(act));
      return raw ? (JSON.parse(raw) as Save) : {};
    } catch {
      return {};
    }
  }

  private write(act: number, save: Save): void {
    try {
      this.storage?.setItem(saveKey(act), JSON.stringify(save));
    } catch {
      // Private mode or full storage: the act still plays, it just won't resume.
    }
  }
}
