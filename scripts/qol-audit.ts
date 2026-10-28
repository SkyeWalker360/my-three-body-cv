/**
 * Quality-of-life audit: opens every dialog and mode on a phone, a small phone and a desktop,
 * then reports exits that are small or off screen, tap targets under 44 px, sideways page
 * scroll, axe violations and console errors. Screenshots go to test-results/qol/.
 *
 *   pnpm build && pnpm start   # in another terminal (or pnpm dev)
 *   pnpm qol                   # QOL_URL=… to audit another address
 *
 * Exits 1 if anything is found. `pnpm test:e2e` stays the gate; this is the wider sweep.
 */
import { mkdirSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { type BrowserContextOptions, chromium, devices, type Page } from '@playwright/test';

const BASE = process.env.QOL_URL ?? 'http://localhost:3000';
const OUT = 'test-results/qol';
const EXIT = /close|exit|quit|leave|back|✕|restore|end inspection/i;
const CHEAT = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'x',
  'z',
];

type Target = { name: string; w: number; h: number; inView: boolean };
type Report = { label: string; exits: Target[]; small: Target[]; overflow: boolean; axe: string[] };

/** Visible controls inside `scope` (the open dialog, or the page). */
function measure(page: Page, scope: string | null) {
  return page.evaluate(
    ({ scope, exit }) => {
      const pattern = new RegExp(exit, 'i');
      const root = scope ? document.querySelector(scope) : document;
      const controls = [
        ...(root?.querySelectorAll<HTMLElement>(
          'button, a[href], [role=tab], summary, input, select',
        ) ?? []),
      ].filter((el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && !el.closest('[inert]');
      });
      const exits: Target[] = [];
      const small: Target[] = [];
      for (const el of controls) {
        const r = el.getBoundingClientRect();
        const name = (el.getAttribute('aria-label') || el.textContent || '')
          .trim()
          .replace(/\s+/g, ' ');
        const t = {
          name: name.slice(0, 40),
          w: Math.round(r.width),
          h: Math.round(r.height),
          inView: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth,
        };
        if (el.tagName === 'BUTTON' && pattern.test(name)) exits.push(t);
        // Links inside running text, and a checkbox inside a tall label, are exempt.
        const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline';
        const labelled = el.closest('label')?.getBoundingClientRect().height ?? 0;
        // Inspection markers sit on card borders at the WCAG 2.2 minimum of 24 px.
        const marker = el.hasAttribute('data-indication');
        if (!inline && !marker && labelled < 44 && (r.width < 44 || r.height < 44)) small.push(t);
      }
      return { exits, small, overflow: document.documentElement.scrollWidth > innerWidth };
    },
    { scope, exit: EXIT.source },
  );
}

async function audit(profile: string, options: BrowserContextOptions) {
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });
  const page = await (await browser.newContext(options)).newPage();
  const errors = new Set<string>();
  page.on('console', (m) => m.type() === 'error' && errors.add(m.text().slice(0, 160)));
  page.on('pageerror', (e) => errors.add(e.message.slice(0, 160)));
  const tap = (name: RegExp | string) => {
    const b = page.getByRole('button', { name }).first();
    return options.hasTouch ? b.tap() : b.click();
  };
  const home = async () => {
    await page.goto(BASE);
    await page.waitForTimeout(800);
  };
  const reports: (Report | { label: string; error: string })[] = [];

  const step = async (label: string, run: () => Promise<unknown>, dialog = true) => {
    try {
      await run();
      await page.waitForTimeout(600);
      const scope = dialog ? 'dialog[open]' : null;
      const axe = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']);
      if (scope) axe.include(scope);
      const { violations } = await axe.analyze();
      reports.push({
        label,
        ...(await measure(page, scope)),
        axe: violations.map((v) => `${v.id} (${v.nodes.length})`),
      });
      await page.screenshot({ path: `${OUT}/${profile}-${label}.png` });
    } catch (e) {
      reports.push({ label, error: String(e).split('\n')[0]!.slice(0, 200) });
    }
  };

  await step('page', home, false);
  await step('scanner', () => tap(/OPEN FIELD SCANNER/));
  await step('scanner-entry', () => tap('A, scan'));
  await step('arcade', async () => {
    for (const key of CHEAT) await page.keyboard.press(key);
    await page.getByRole('region', { name: 'Arcade' }).waitFor({ timeout: 4000 });
  });
  await step('karl', async () => {
    await home();
    await tap('K.A.R.L.');
  });
  await step('deck', async () => {
    await home();
    await tap(/OBSERVATION DECK/);
    await page.waitForTimeout(1000);
  });
  await step(
    'inspection',
    async () => {
      await home();
      await page.getByRole('button', { name: /INSPECT THE WELDS/ }).scrollIntoViewIfNeeded();
      await tap(/INSPECT THE WELDS/);
      await page.waitForTimeout(1000);
    },
    false,
  );
  await step('inspection-writeup', async () => {
    const marker = page.locator('[data-indication]').first();
    await marker.scrollIntoViewIfNeeded();
    await (options.hasTouch ? marker.tap() : marker.click());
    await page.locator('dialog[open]').waitFor({ timeout: 4000 });
  });
  if (options.hasTouch) {
    await step('engage', async () => {
      await home();
      await page.getByRole('button', { name: /engage weapons/i }).scrollIntoViewIfNeeded();
      await tap(/engage weapons/i);
      await page.getByRole('region', { name: 'Arcade' }).waitFor({ timeout: 4000 });
    });
  } else {
    await step(
      'shooter',
      async () => {
        await home();
        await tap(/engage weapons/i);
        await page.waitForTimeout(1000);
      },
      false,
    );
  }
  await browser.close();
  return { profile, reports, errors: [...errors] };
}

mkdirSync(OUT, { recursive: true });
const profiles: [string, BrowserContextOptions][] = [
  ['phone', { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }],
  ['small-phone', { ...devices['iPhone SE'], viewport: { width: 320, height: 568 } }],
  ['desktop', { viewport: { width: 1280, height: 720 } }],
];

let issues = 0;
for (const [name, options] of profiles) {
  const { reports, errors } = await audit(name, options);
  console.log(`\n${name}`);
  for (const r of reports) {
    if ('error' in r) {
      issues++;
      console.log(`  ✗ ${r.label}: could not open (${r.error})`);
      continue;
    }
    const found = [
      ...r.exits
        .filter((e) => !e.inView || Math.min(e.w, e.h) < 44)
        .map((e) => `exit "${e.name}" ${e.w}×${e.h}${e.inView ? '' : ' off screen'}`),
      ...r.small
        .filter((s) => !r.exits.includes(s))
        .map((s) => `small target "${s.name || '(unnamed)'}" ${s.w}×${s.h}`),
      ...(r.overflow ? ['page scrolls sideways'] : []),
      ...r.axe.map((a) => `axe: ${a}`),
    ];
    issues += found.length;
    console.log(`  ${found.length ? '✗' : '✓'} ${r.label}`);
    for (const f of found) console.log(`      ${f}`);
  }
  for (const e of errors) console.log(`  ✗ console: ${e}`);
  issues += errors.length;
}
console.log(
  issues ? `\n${issues} issue(s). Screenshots in ${OUT}/` : `\nAll clear. Screenshots in ${OUT}/`,
);
process.exit(issues ? 1 : 0);
