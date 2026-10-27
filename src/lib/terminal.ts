/** One line of K.A.R.L.'s log. Always rendered as text, never as HTML. */
export type LineTone =
  'normal' | 'heading' | 'muted' | 'accent' | 'error' | 'roll' | 'echo' | 'story';

export type Line = {
  text: string;
  tone?: LineTone;
  href?: string;
};

export const line = (text: string, tone: LineTone = 'normal', href?: string): Line =>
  href ? { text, tone, href } : { text, tone };
