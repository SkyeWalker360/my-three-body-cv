import { describe, expect, it } from 'vitest';
import { contactLines, cvLines, entryLines, ndtLines } from '@/features/karl/responses';
import { manifest } from '@/lib/manifest';

const text = (lines: { text: string }[]) => lines.map((l) => l.text).join('\n');

describe('K.A.R.L. responses', () => {
  it('builds every career answer from the manifest', () => {
    const cv = text(cvLines(manifest));
    for (const e of manifest.experience) expect(cv).toContain(e.org);
    for (const c of manifest.certifications) expect(cv).toContain(c.name);
  });

  it('answers /ndt with the issuer and levels', () => {
    const ndt = text(ndtLines(manifest));
    expect(ndt).toContain('African NDT Centre (Pty) Ltd');
    expect(ndt).toContain('Magnetic Particle Testing (MT) Level 2');
  });

  it('gives contact details without a phone number', () => {
    const contact = text(contactLines(manifest));
    expect(contact).toContain(manifest.person.contact.email);
    expect(contact).not.toMatch(/\d{3}\s?\d{3}\s?\d{4}/);
  });

  it('describes each entry id', () => {
    for (const id of Object.keys(manifest.karl.aliases)) {
      expect(entryLines(manifest, id)[0]!.tone).toBe('heading');
    }
    expect(entryLines(manifest, 'nope')[0]!.tone).toBe('error');
  });
});
