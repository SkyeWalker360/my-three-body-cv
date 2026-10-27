/**
 * Generate public/cv.pdf from the manifest, so the PDF can't drift from the site.
 * This is the public web version: no phone number or street address.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, type PDFFont, type PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { parseManifest } from '../src/lib/schema';
import { formatRange } from '../src/lib/format';

const m = parseManifest(
  JSON.parse(readFileSync(join(process.cwd(), 'content', 'cv-manifest.json'), 'utf8')),
);

const PAGE: [number, number] = [595.28, 841.89]; // A4
const MARGIN = 50;
const WIDTH = PAGE[0] - MARGIN * 2;
// Print colours for a white page (the site's tokens are tuned for a dark background).
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.35, 0.37, 0.42);
const ACCENT = rgb(0.03, 0.42, 0.48);

/** Standard PDF fonts only cover WinAnsi; replace anything outside it. */
const sanitize = (s: string) => s.replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•]/g, '?');

async function main() {
  const doc = await PDFDocument.create();
  doc.setTitle(`${m.person.name} — CV`);
  doc.setAuthor(m.person.name);
  doc.setSubject(m.person.title);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page: PDFPage = doc.addPage(PAGE);
  let y = PAGE[1] - MARGIN;

  const ensure = (needed: number) => {
    if (y - needed < MARGIN) {
      page = doc.addPage(PAGE);
      y = PAGE[1] - MARGIN;
    }
  };

  const wrap = (text: string, font: PDFFont, size: number, width: number): string[] => {
    const words = sanitize(text).split(/\s+/);
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) > width && current) {
        lines.push(current);
        current = word;
      } else current = next;
    }
    if (current) lines.push(current);
    return lines;
  };

  const text = (
    s: string,
    opts: {
      font?: PDFFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      indent?: number;
      gap?: number;
    } = {},
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10;
    const indent = opts.indent ?? 0;
    const lead = size * 1.35;
    for (const l of wrap(s, font, size, WIDTH - indent)) {
      ensure(lead);
      page.drawText(l, { x: MARGIN + indent, y: y - size, size, font, color: opts.color ?? INK });
      y -= lead;
    }
    y -= opts.gap ?? 0;
  };

  const bullet = (s: string, indent = 0) => {
    const size = 10;
    const lines = wrap(s, regular, size, WIDTH - indent - 12);
    lines.forEach((l, i) => {
      ensure(size * 1.35);
      if (i === 0)
        page.drawText('•', { x: MARGIN + indent, y: y - size, size, font: regular, color: ACCENT });
      page.drawText(l, { x: MARGIN + indent + 12, y: y - size, size, font: regular, color: INK });
      y -= size * 1.35;
    });
  };

  const rowWithDate = (left: string, right: string) => {
    ensure(16);
    const size = 11;
    const r = sanitize(right);
    const rw = regular.widthOfTextAtSize(r, 10);
    const leftLines = wrap(left, bold, size, WIDTH - rw - 12);
    page.drawText(r, {
      x: MARGIN + WIDTH - rw,
      y: y - size,
      size: 10,
      font: regular,
      color: MUTED,
    });
    for (const l of leftLines) {
      ensure(size * 1.35);
      page.drawText(l, { x: MARGIN, y: y - size, size, font: bold, color: INK });
      y -= size * 1.35;
    }
  };

  const heading = (s: string) => {
    y -= 8;
    ensure(30);
    text(s.toUpperCase(), { font: bold, size: 12, color: ACCENT });
    page.drawLine({
      start: { x: MARGIN, y: y + 2 },
      end: { x: MARGIN + WIDTH, y: y + 2 },
      thickness: 0.75,
      color: ACCENT,
    });
    y -= 6;
  };

  // Header
  text(m.person.name.toUpperCase(), { font: bold, size: 22, gap: 2 });
  text(m.person.title, { font: bold, size: 12, color: ACCENT, gap: 2 });
  const { email, linkedin, github } = m.person.contact;
  text(`${m.person.location}  ·  ${email}`, { size: 10, color: MUTED });
  text(`${linkedin}  ·  ${github}`, { size: 10, color: MUTED });

  heading('Profile');
  text(m.person.summary);

  heading('Skills');
  for (const s of m.skills) {
    text(`${s.category}: ${s.items.join(', ')}`, { size: 10, gap: 1 });
  }
  text(`Languages: ${m.spokenLanguages.map((l) => `${l.language} (${l.level})`).join(', ')}`);

  heading('Work Experience');
  for (const e of m.experience.filter((x) => x.kind === 'employment')) {
    rowWithDate(e.role, formatRange(e.start, e.end));
    text(`${e.org} | ${e.location}`, { color: MUTED, gap: 2 });
    if (e.summary) text(e.summary, { gap: 2 });
    for (const r of e.roles ?? []) {
      text(r.title, { font: bold, size: 10 });
      r.highlights.forEach((h) => bullet(h, 4));
    }
    e.highlights?.forEach((h) => bullet(h));
    y -= 4;
  }

  heading('Personal Projects');
  for (const p of m.projects) {
    rowWithDate(p.name, formatRange(p.start, p.end));
    text(p.tagline, { color: MUTED, gap: 2 });
    p.highlights.forEach((h) => bullet(h));
  }

  heading('Education & Certifications');
  for (const c of m.certifications) {
    rowWithDate(c.name, formatRange(c.start, c.end));
    text(`${c.issuer} | ${c.location}`, { color: MUTED, gap: 2 });
    text(`Certifications: ${c.levels.join(' and ')}.`, { gap: 4 });
  }
  for (const e of m.education) {
    rowWithDate(e.award, formatRange(e.start, e.end));
    text(`${e.institution} | ${e.location}`, { color: MUTED, gap: 2 });
    e.qualifications?.forEach((q) => bullet(q));
    if (e.detail) text(e.detail);
    y -= 4;
  }

  const volunteering = m.experience.filter((x) => x.kind === 'volunteering');
  if (volunteering.length) {
    heading('Volunteering');
    for (const e of volunteering) {
      rowWithDate(e.role, formatRange(e.start, e.end));
      text(`${e.org} | ${e.location}`, { color: MUTED, gap: 2 });
      e.highlights?.forEach((h) => bullet(h));
      if (e.later) text(e.later, { color: MUTED });
    }
  }

  heading('Achievements');
  m.achievements.forEach((a) => bullet(a));

  const out = join(process.cwd(), 'public');
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'cv.pdf'), await doc.save());
  console.log(`pdf: wrote public/cv.pdf (${doc.getPageCount()} pages)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
