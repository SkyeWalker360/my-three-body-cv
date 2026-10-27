import { describe, expect, it } from 'vitest';
import { parseInput } from '@/features/karl/intents';
import { manifest } from '@/lib/manifest';

const aliases = manifest.karl.aliases;

describe('K.A.R.L. intents', () => {
  it.each(['help', 'cv', 'ndt', 'skills', 'contact', 'core', 'noctus', 'clear', 'exit', 'karr'])(
    'parses /%s',
    (c) => {
      expect(parseInput(`/${c}`, aliases)).toEqual({ type: 'command', command: c });
    },
  );

  it('treats unknown slash commands as unknown', () => {
    expect(parseInput('/rm -rf', aliases).type).toBe('unknown');
  });

  it('maps free text to manifest entries through the aliases', () => {
    expect(parseInput('What did Luke do at GEN318?', aliases)).toEqual({
      type: 'entry',
      id: 'gen318',
    });
    expect(parseInput('tell me about magnetic particle testing', aliases)).toEqual({
      type: 'entry',
      id: 'ndt-mt',
    });
    expect(parseInput('the homelab', aliases)).toEqual({ type: 'entry', id: 'homelab' });
  });

  it('prefers the longest matching phrase', () => {
    expect(parseInput('lead life', aliases)).toEqual({ type: 'entry', id: 'lead-life' });
  });

  it('matches whole words only', () => {
    // "mt" is an NDT alias; it must not fire inside "smtp".
    expect(parseInput('smtp', aliases).type).toBe('unknown');
  });

  it('recognises topics', () => {
    expect(parseInput('what powers the reactor core?', aliases)).toEqual({
      type: 'topic',
      topic: 'core',
    });
    expect(parseInput('let me play dnd', aliases)).toEqual({ type: 'topic', topic: 'noctus' });
    expect(parseInput('how do I contact him', aliases)).toEqual({
      type: 'topic',
      topic: 'contact',
    });
  });

  it('returns empty for blank input', () => {
    expect(parseInput('   ', aliases)).toEqual({ type: 'empty' });
  });
});
