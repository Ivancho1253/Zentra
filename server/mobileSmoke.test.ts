import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
const baseUrl = process.env.E2E_BASE_URL;
describe.skipIf(!baseUrl)('browser journeys', () => {
  it('supports decimal trades, watchlists, alerts and responsive demo navigation', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${baseUrl}/demo`);
      await page.getByRole('heading', { name: 'The bigger picture.' }).waitFor();
      for (const name of ['Portfolio', 'Watchlists', 'Transactions', 'Intelligence', 'Alerts']) {
        await page.getByRole('button', { name, exact: true }).first().click();
        await page.getByRole('heading', { name, exact: true }).waitFor();
      }
      await page.getByRole('link', { name: 'View landing page', exact: true }).click();
      await page.waitForURL(`${baseUrl}/landing`);
      await page.getByRole('heading', { level: 1 }).waitFor();
      await page.getByRole('button', { name: 'Explore interactive demo' }).click();
      await page.getByRole('heading', { name: 'The bigger picture.' }).waitFor();
      await page.getByRole('button', { name: 'Transactions', exact: true }).first().click();
      await page.getByLabel('Price in USD').fill('200');
      await page.getByLabel('Quantity', { exact: true }).fill('0.00000001');
      await page.getByRole('button', { name: 'Save demo transaction' }).click();
      expect(await page.getByRole('status').innerText()).toContain('registered');
      await page.getByRole('button', { name: 'Watchlists', exact: true }).first().click();
      await page.getByLabel('New demo watchlist name').fill('QA list');
      await page.getByRole('button', { name: 'Create watchlist', exact: true }).click();
      await page.getByLabel('Add demo watchlist asset').selectOption('BTC');
      expect(await page.locator('table').innerText()).toContain('BTC');
      await page.getByRole('button', { name: 'Alerts', exact: true }).first().click();
      await page.getByLabel('Target price').fill('1');
      await page.getByRole('button', { name: 'Create demo alert' }).click();
      expect(await page.locator('main').innerText()).toContain('Triggered on demo quote');
      for (const width of [390, 768, 1280]) {
        await page.setViewportSize({ width, height: 844 });
        await page.getByRole('button', { name: 'Overview', exact: true }).last().click();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
      }
      await page.goto(`${baseUrl}/privacy`);
      await expect
        .poll(async () => (await page.locator('body').innerText()).toLowerCase())
        .toContain('privacy');
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  }, 60_000);

  it.skipIf(process.env.E2E_FIREBASE_EMULATORS !== 'true')(
    'registers an isolated user, persists a watchlist and updates the ledger atomically',
    async () => {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`${baseUrl}/watchlists`);
        await page.waitForURL(`${baseUrl}/auth`);
        await page.getByRole('button', { name: 'Register now', exact: true }).click();
        await page.getByLabel('Email address').fill(`zentra-qa-${Date.now()}@example.test`);
        await page.getByLabel('Password', { exact: true }).fill('Isolated-test-password-2026');
        await page.getByRole('button', { name: 'Register', exact: true }).click();
        await page
          .getByRole('heading', { name: 'Watchlists', exact: true })
          .waitFor({ timeout: 20_000 });
        await page.goto(`${baseUrl}/landing`);
        await page.getByRole('heading', { level: 1 }).waitFor();
        expect(page.url()).toBe(`${baseUrl}/landing`);
        await page.goto(`${baseUrl}/watchlists`);
        await page.getByLabel('New watchlist name').fill('Tech QA');
        await page.getByRole('button', { name: 'Create watchlist', exact: true }).click();
        await page.getByLabel('Search assets', { exact: true }).fill('AAPL');
        await page.getByRole('button', { name: /＋ AAPL/ }).click();
        await expect.poll(() => page.locator('tbody').innerText()).toContain('AAPL');
        await page.keyboard.press('Control+k');
        await page.getByLabel('Search Zentra').fill('Watch BTC');
        await page.getByRole('button', { name: /BTC · Bitcoin/ }).click();
        await expect.poll(() => page.locator('tbody').innerText()).toContain('BTC');
        await page.goto(`${baseUrl}/transactions`);
        await page.getByLabel('Symbol', { exact: true }).fill('BTC');
        await page.getByLabel('Asset type').selectOption('crypto');
        await page.getByLabel('Quantity', { exact: true }).fill('0.00000001');
        await page.getByLabel('Execution price').fill('50000');
        await page.getByRole('button', { name: 'Register transaction', exact: true }).click();
        await expect
          .poll(() => page.getByRole('status').innerText())
          .toContain('updated atomically');
        expect(await page.locator('tbody').innerText()).toContain('0.00000001');
        await page.getByLabel('Transaction').selectOption('sell');
        await page.getByLabel('Symbol', { exact: true }).fill('BTC');
        await page.getByLabel('Quantity', { exact: true }).fill('1');
        await page.getByLabel('Execution price').fill('60000');
        await page.getByRole('button', { name: 'Register transaction', exact: true }).click();
        await expect.poll(() => page.getByRole('status').innerText()).toContain('Cannot sell more');
        expect(await page.locator('tbody tr').count()).toBe(1);
        await page.reload();
        await expect.poll(() => page.locator('tbody').innerText()).toContain('0.00000001');
        await page.screenshot({ path: '.codex-runtime/authenticated-ledger.png', fullPage: true });
        await page.goto(`${baseUrl}/`);
        await page.getByRole('heading', { name: 'The bigger picture.' }).waitFor();
        await page.screenshot({
          path: '.codex-runtime/authenticated-dashboard.png',
          fullPage: true,
        });
        await page.setViewportSize({ width: 390, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          390,
        );
        await page.screenshot({ path: '.codex-runtime/authenticated-mobile.png', fullPage: true });
        await page.goto(`${baseUrl}/analytics`);
        await page.getByRole('heading', { name: 'Portfolio analytics', exact: true }).waitFor();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          390,
        );
        await page.getByRole('button', { name: 'Load observed history' }).click();
        await expect
          .poll(() => page.locator('main').innerText())
          .toContain('Stale, demo, non-USD and incomplete histories are excluded');
        await page.goto(`${baseUrl}/social`);
        await page.getByRole('heading', { name: 'Social intelligence', exact: true }).waitFor();
        await page.getByLabel('X account username').fill('@company');
        await page.getByRole('button', { name: 'Monitor account' }).click();
        await expect.poll(() => page.locator('main').innerText()).toContain('@company');
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          390,
        );
        await page.goto(`${baseUrl}/news`);
        await page.getByRole('heading', { name: 'News terminal', exact: true }).waitFor();
        await page.getByLabel('Follow a news topic').fill('Central banks');
        await page.getByRole('button', { name: '＋ Follow', exact: true }).click();
        await expect
          .poll(() => page.getByRole('button', { name: 'Central banks', exact: true }).count())
          .toBe(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          390,
        );
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    },
    60_000,
  );
});
