import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('recruiter essentials are visible without scrolling', async ({ page }) => {
  await page.goto('/');
  const viewport = page.viewportSize()!;
  for (const locator of [
    page.getByRole('heading', { level: 1, name: 'Luke Gorry' }),
    page
      .locator('#top')
      .getByText('Full-Stack Software Developer & Certified NDT Technician', { exact: false }),
    page.getByRole('link', { name: /lukempgorry@gmail\.com/ }).first(),
    page.getByRole('link', { name: 'LinkedIn' }).first(),
    page.getByRole('link', { name: 'GitHub' }).first(),
    page.getByRole('link', { name: /download cv/i }).first(),
  ]) {
    const box = await locator.boundingBox();
    expect(box, (await locator.textContent()) ?? undefined).not.toBeNull();
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  }
});

test('the PDF is served', async ({ request }) => {
  const res = await request.get('/cv.pdf');
  expect(res.ok()).toBe(true);
  expect(res.headers()['content-type']).toContain('pdf');
});

test('metadata and JSON-LD are present', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Luke Gorry/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    /opengraph-image/,
  );
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld['@type']).toBe('Person');
  // No phone number (10 digits) or street address in the structured data.
  expect(JSON.stringify(ld)).not.toMatch(/\d{3}\s?\d{3}\s?\d{4}|\bRoad\b|streetAddress|telephone/);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the whole CV still reads', async ({ page }) => {
    await page.goto('/');
    for (const text of [
      'GEN318',
      'African NDT Centre',
      'Multi-Node Homelab',
      'CTU Training Solutions',
      'Mondeor High School',
    ]) {
      await expect(page.getByText(text).first()).toBeVisible();
    }
  });
});

test('has no axe violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('K.A.R.L. opens, answers from the manifest, and closes on Escape', async ({ page }) => {
  await page.goto('/');
  const opener = page.getByRole('button', { name: 'K.A.R.L.' });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const input = dialog.getByLabel('K.A.R.L.>');
  await input.fill('/ndt');
  await input.press('Enter');
  await expect(dialog.getByRole('log')).toContainText('African NDT Centre (Pty) Ltd');
  await input.fill('<img src=x onerror=alert(1)>');
  await input.press('Enter');
  await expect(dialog.getByRole('log')).toContainText('<img src=x onerror=alert(1)>');
  expect(await dialog.locator('img').count()).toBe(0);
  const axe = await new AxeBuilder({ page }).include('dialog').analyze();
  expect(axe.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test('ENGAGE produces shootable asteroids and Space does not scroll', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'The shooter needs a keyboard.');
  await page.goto('/');
  await page.getByRole('button', { name: /engage weapons/i }).click();
  await expect(page.getByRole('status')).toContainText(/\d+ CV blocks became asteroids/);
  const before = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => window.scrollY)).toBe(before);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-destructible]').first()).not.toHaveCSS('visibility', 'hidden');
});
