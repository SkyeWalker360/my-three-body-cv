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

test('the ship cursor only replaces the native cursor with a mouse', async ({ page, isMobile }) => {
  await page.goto('/');
  if (isMobile) {
    await page.touchscreen.tap(200, 400);
    await page.waitForTimeout(500);
    await expect(page.locator('html')).not.toHaveClass(/ship-cursor/);
  } else {
    // The cursor loads on idle, then activates on the next mouse move.
    let x = 400;
    await expect(async () => {
      x += 10;
      await page.mouse.move(x, 300);
      await expect(page.locator('html')).toHaveClass(/ship-cursor/, { timeout: 200 });
    }).toPass({ timeout: 5000 });
    // The native cursor comes back while K.A.R.L.'s modal is open.
    await page.getByRole('button', { name: 'K.A.R.L.' }).click();
    await expect(page.locator('html')).not.toHaveClass(/ship-cursor/);
  }
});

test('the shooter can be replayed without reloading', async ({ page, isMobile }) => {
  test.skip(isMobile, 'The shooter needs a keyboard.');
  await page.goto('/');
  const launch = page.getByRole('button', { name: /engage weapons/i });
  for (let run = 0; run < 2; run++) {
    await launch.click();
    await expect(page.getByRole('status')).toContainText(/\d+ CV blocks became asteroids/);
    await expect(page.locator('[data-destructible][style*="hidden"]').first()).toBeAttached();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-destructible][style*="hidden"]')).toHaveCount(0);
    await expect(launch).toBeEnabled();
  }
});

test('the Go engine loads and a star can be aged into a supernova', async ({ page }) => {
  test.setTimeout(30_000);
  const wasm = page.waitForResponse((r) => r.url().endsWith('/engine.wasm'));
  await page.goto('/');
  expect((await wasm).status()).toBe(200);
  await expect(page.getByText('Running the Go engine')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'AGE A STAR' }).click();
  await expect(page.getByText(/left the main sequence/)).toBeVisible();
  await expect(page.getByText(/Supernova!/)).toBeVisible({ timeout: 15_000 });
});

test('the field scanner opens, logs a specimen from the manifest, and closes on Escape', async ({
  page,
}) => {
  await page.goto('/');
  const opener = page.getByRole('button', { name: 'OPEN FIELD SCANNER' });
  await opener.click();
  const dialog = page.getByRole('dialog', { name: /scanner/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('CORE 0%')).toBeVisible();
  await dialog.getByRole('button', { name: 'A, scan' }).click();
  await expect(dialog.getByText('Lead Developer & Systems Management').first()).toBeVisible();
  await expect(dialog.getByRole('status')).toContainText('New specimen logged: #001');
  await dialog.getByRole('tab', { name: 'CERTS' }).click();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('z');
  await expect(dialog.getByText('African NDT Centre (Pty) Ltd').first()).toBeVisible();
  const axe = await new AxeBuilder({ page }).include('dialog').analyze();
  expect(axe.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
  // The logbook survives a reload.
  await page.reload();
  await page.getByRole('button', { name: 'OPEN FIELD SCANNER' }).click();
  await expect(
    page.getByRole('dialog', { name: /scanner/i }).getByText(/CORE [1-9]\d*%/),
  ).toBeVisible();
});
