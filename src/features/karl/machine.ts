import { setup } from 'xstate';

/**
 * K.A.R.L.'s modes. `karr` is the hidden amber scanner mode (Knight Rider's KARR);
 * CV questions keep working in it.
 */
export type KarlEvent = { type: 'CV' } | { type: 'RPG' } | { type: 'KARR' } | { type: 'EXIT' };

export const karlMachine = setup({
  types: { events: {} as KarlEvent },
}).createMachine({
  id: 'karl',
  initial: 'idle',
  states: {
    idle: {
      on: { CV: 'cv', RPG: 'rpg', KARR: 'karr' },
    },
    cv: {
      on: { CV: 'cv', RPG: 'rpg', KARR: 'karr', EXIT: 'idle' },
    },
    karr: {
      on: { RPG: 'rpg', KARR: 'idle', EXIT: 'idle' },
    },
    rpg: {
      on: { EXIT: 'idle' },
    },
  },
});

export type KarlMode = 'idle' | 'cv' | 'rpg' | 'karr';
