import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { demoQuotes } from '../shared/demo';
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
      const tape = page.getByRole('region', { name: 'Top gainers', exact: true });
      await tape.locator('.ticker-item').first().waitFor();
      for (const width of [390, 1280, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect
          .poll(async () =>
            tape.evaluate((element) => {
              const viewport = element.querySelector('.ticker-viewport')!;
              const group = element.querySelector('.ticker-group')!;
              return group.getBoundingClientRect().width >= viewport.clientWidth;
            }),
          )
          .toBe(true);
      }
      await page.mouse.move(0, 0);
      const animation = await tape.locator('.ticker-track').evaluate((element) => ({
        duration: parseFloat(getComputedStyle(element).animationDuration),
        distance: element.querySelector('.ticker-group')!.getBoundingClientRect().width,
      }));
      expect(animation.duration).toBeGreaterThanOrEqual(40);
      expect(animation.distance / animation.duration).toBeLessThanOrEqual(18.1);
      const start = await tape
        .locator('.ticker-track')
        .evaluate((element) => element.getBoundingClientRect().x);
      await page.waitForTimeout(600);
      const end = await tape
        .locator('.ticker-track')
        .evaluate((element) => element.getBoundingClientRect().x);
      expect(start - end).toBeGreaterThan(2);
      expect(start - end).toBeLessThan(16);
      await tape.getByRole('button', { name: 'Pause top gainers', exact: true }).click();
      await page.mouse.move(0, 0);
      expect(
        await tape
          .locator('.ticker-track')
          .evaluate((element) => getComputedStyle(element).animationPlayState),
      ).toBe('paused');
      await tape.getByRole('button', { name: 'Resume top gainers', exact: true }).click();
      expect(
        await tape
          .locator('.ticker-track')
          .evaluate((element) => getComputedStyle(element).animationPlayState),
      ).toBe('running');
      await page.emulateMedia({ reducedMotion: 'reduce' });
      expect(
        await tape
          .locator('.ticker-track')
          .evaluate((element) => getComputedStyle(element).animationName),
      ).toBe('none');
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.screenshot({ path: '.codex-runtime/demo-ticker.png', fullPage: false });
      await page.setViewportSize({ width: 1440, height: 1000 });
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
    'persists account actions, decimal trades, imports and exports, and isolates provider failures',
    async () => {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await page.goto(`${baseUrl}/watchlists`);
        await page.waitForURL(`${baseUrl}/auth`);
        await page.getByRole('button', { name: 'Register now', exact: true }).click();
        const email = `zentra-qa-${Date.now()}@example.test`;
        await page.getByLabel('Email address').fill(email);
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
        await page.getByLabel('Move BTC up', { exact: true }).click();
        await expect.poll(() => page.locator('tbody tr').first().innerText()).toContain('BTC');
        await page.getByLabel('Pin watchlist', { exact: true }).click();
        await page.getByLabel('Unpin watchlist', { exact: true }).waitFor();
        await page.getByLabel('Rename watchlist').fill('Reviewed tech');
        await page.getByLabel('Rename watchlist').press('Tab');
        await page.getByRole('button', { name: /Reviewed tech/ }).waitFor();
        await page.getByLabel('Remove BTC', { exact: true }).click();
        await expect.poll(() => page.locator('tbody tr').count()).toBe(1);
        await page.getByLabel('New watchlist name').fill('Disposable QA');
        await page.getByRole('button', { name: 'Create watchlist', exact: true }).click();
        await expect
          .poll(() => page.getByLabel('Rename watchlist').inputValue())
          .toBe('Disposable QA');
        await page.getByRole('button', { name: 'Delete watchlist', exact: true }).click();
        await expect
          .poll(() => page.getByLabel('Rename watchlist').inputValue())
          .toBe('Reviewed tech');
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
        for (const kind of ['deposit', 'withdrawal', 'dividend', 'transfer', 'fee']) {
          await page.getByLabel('Transaction', { exact: true }).selectOption(kind);
          await page
            .getByLabel('Cash amount', { exact: true })
            .fill(kind === 'transfer' ? '-1' : '10');
          await page.getByRole('button', { name: 'Register transaction', exact: true }).click();
          await expect
            .poll(() => page.getByRole('status').innerText())
            .toContain('updated atomically');
        }
        expect(await page.locator('tbody tr').count()).toBe(6);
        await page.getByLabel('Transaction', { exact: true }).selectOption('sell');
        await page.getByLabel('Symbol', { exact: true }).fill('BTC');
        await page.getByLabel('Asset type', { exact: true }).selectOption('crypto');
        await page.getByLabel('Quantity', { exact: true }).fill('0.000000001');
        await page.getByLabel('Execution price').fill('60000');
        await page.getByRole('button', { name: 'Register transaction', exact: true }).click();
        await expect
          .poll(() => page.getByRole('status').innerText())
          .toContain('updated atomically');
        expect(await page.locator('tbody tr').count()).toBe(7);
        await page.screenshot({ path: '.codex-runtime/authenticated-ledger.png', fullPage: true });
        await page.goto(`${baseUrl}/`);
        await page.getByRole('heading', { name: 'The bigger picture.' }).waitFor();
        await page.screenshot({
          path: '.codex-runtime/authenticated-dashboard.png',
          fullPage: true,
        });
        await page.goto(`${baseUrl}/market`);
        await page.getByRole('article', { name: 'AAPL market card', exact: true }).waitFor();
        await page.getByLabel('Add AAPL to favorites', { exact: true }).click();
        await page.getByLabel('Remove AAPL from favorites', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'favorites', exact: true }).click();
        await page.getByRole('article', { name: 'AAPL market card', exact: true }).waitFor();
        // Saved assets outside the discovery catalog must remain visible and removable.
        await page.goto(`${baseUrl}/market/stocks/ZZZQ`);
        await page.getByLabel('Add ZZZQ to favorites', { exact: true }).click();
        await page.getByLabel('Remove ZZZQ from favorites', { exact: true }).waitFor();
        await page.goto(`${baseUrl}/market`);
        await page.getByRole('button', { name: 'favorites', exact: true }).click();
        await page.getByRole('article', { name: 'ZZZQ market card', exact: true }).waitFor();
        await page.getByLabel('Remove ZZZQ from favorites', { exact: true }).click();
        await expect
          .poll(() => page.getByRole('article', { name: 'ZZZQ market card', exact: true }).count())
          .toBe(0);
        await page.getByRole('button', { name: 'Heat Map', exact: true }).click();
        await page.getByLabel('Heat map weighting').selectOption('moves');
        await page.locator('main a[title^="AAPL "]').waitFor();
        await page.getByTitle('Zoom in', { exact: true }).click();
        await page.getByTitle('Reset view', { exact: true }).click();
        await page.locator('main a[title^="AAPL "]').click();
        await page.waitForURL(`${baseUrl}/market/stocks/AAPL`);
        await page.getByRole('button', { name: 'Line', exact: true }).click();
        await page.getByRole('button', { name: 'SMA 20', exact: true }).click();
        await page.getByRole('button', { name: '1W', exact: true }).click();
        expect(
          await page.getByRole('button', { name: '1W', exact: true }).getAttribute('aria-pressed'),
        ).toBe('true');
        await page.getByRole('button', { name: 'Candles', exact: true }).click();
        await page.getByLabel('Remove AAPL from favorites', { exact: true }).click();
        await page.getByLabel('Add AAPL to favorites', { exact: true }).waitFor();
        await page.getByLabel('Add AAPL to favorites', { exact: true }).click();
        await page.getByLabel('Price alert target').fill('123');
        await page.getByRole('button', { name: 'Save alert', exact: true }).click();
        await expect
          .poll(() => page.getByRole('status').innerText())
          .toContain('Alert saved: AAPL');
        await page.goto(`${baseUrl}/alerts`);
        await page.getByTitle('Delete alert', { exact: true }).click();
        await expect.poll(() => page.getByTitle('Delete alert', { exact: true }).count()).toBe(0);
        await page.goto(`${baseUrl}/market/stocks/AAPL`);
        await page.setViewportSize({ width: 390, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          390,
        );
        await page.screenshot({ path: '.codex-runtime/authenticated-mobile.png', fullPage: true });
        await page.goto(`${baseUrl}/analytics`);
        await page.getByRole('heading', { name: 'Portfolio analytics', exact: true }).waitFor();
        await page.getByLabel('Base currency', { exact: true }).selectOption('EUR');
        await expect
          .poll(() => page.getByLabel('Base currency', { exact: true }).inputValue())
          .toBe('EUR');
        await page.reload();
        await expect
          .poll(() => page.getByLabel('Base currency', { exact: true }).inputValue())
          .toBe('EUR');
        await page.getByLabel('Base currency', { exact: true }).selectOption('USD');
        await expect
          .poll(() => page.getByLabel('Base currency', { exact: true }).inputValue())
          .toBe('USD');
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
        await page.getByLabel('Mute company', { exact: true }).click();
        await page.getByLabel('Unmute company', { exact: true }).waitFor();
        await page.getByLabel('Unmute company', { exact: true }).click();
        await page.getByLabel('Mute company', { exact: true }).waitFor();
        await page.getByLabel('Search monitored accounts').fill('missing-account');
        expect(await page.getByRole('link', { name: '@company', exact: true }).count()).toBe(0);
        await page.getByLabel('Search monitored accounts').fill('');
        await page.getByLabel('Remove company', { exact: true }).click();
        await expect
          .poll(() => page.getByRole('link', { name: '@company', exact: true }).count())
          .toBe(0);
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
        await page.getByRole('button', { name: 'Central banks', exact: true }).click();
        await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('Central banks');
        await page.getByLabel('Unfollow Central banks', { exact: true }).click();
        await expect
          .poll(() => page.getByLabel('Unfollow Central banks', { exact: true }).count())
          .toBe(0);
        await page.getByLabel('Search financial news').fill('Apple');
        await page.getByRole('button', { name: 'Search', exact: true }).click();
        await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe('Apple');
        await page.getByLabel('Search financial news').fill('');
        expect(await page.getByLabel('Search financial news').inputValue()).toBe('');
        await page.getByRole('button', { name: 'Search', exact: true }).click();
        await expect.poll(() => new URL(page.url()).searchParams.get('q')).toBe(null);
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          390,
        );
        await page.goto(`${baseUrl}/alerts`);
        await page.getByLabel('Asset', { exact: true }).fill('AAPL');
        await page.getByLabel('Native currency price', { exact: true }).fill('100');
        await page.getByRole('button', { name: 'Save alert', exact: true }).click();
        await expect.poll(() => page.getByRole('status').innerText()).toContain('Alert saved');
        await page.getByTitle('Pause alert', { exact: true }).click();
        await page.getByTitle('Resume alert', { exact: true }).waitFor();
        await page.getByTitle('Resume alert', { exact: true }).click();
        await page.getByTitle('Pause alert', { exact: true }).waitFor();
        await page.goto(`${baseUrl}/briefing`);
        await page.getByRole('button', { name: 'Generate briefing', exact: true }).click();
        await expect.poll(() => page.locator('main').innerText()).toContain('Followed assets:');
        expect(await page.locator('main').innerText()).toContain('BTC');
        await page.getByLabel('Open Zentra chat').click();
        await page.getByLabel('Ask Zentra').fill('Summarize my followed assets');
        const chatResponse = page.waitForResponse(
          (response) =>
            response.url().endsWith('/api/ai/zentra-chat') &&
            response.request().method() === 'POST',
        );
        await page.getByLabel('Send message to Zentra').click();
        const chatPayload = await (await chatResponse).json();
        expect(chatPayload.aiGenerated).toBe(false);
        expect(
          chatPayload.sources.some((source: { label: string }) => source.label.startsWith('BTC ·')),
        ).toBe(true);
        await expect
          .poll(() => page.locator('body').innerText())
          .toContain(chatPayload.answer.slice(0, 70));
        await page.getByLabel('Open Zentra chat').click();
        await page.setViewportSize({ width: 1440, height: 1000 });
        for (const route of [
          '/portfolio',
          '/market',
          '/market/stocks/AAPL',
          '/risk',
          '/help',
          '/info',
        ]) {
          await page.goto(`${baseUrl}${route}`);
          await page.getByRole('heading', { level: 1 }).waitFor();
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(1440);
        }
        await page.getByRole('heading', { name: 'Service connections', exact: true }).waitFor();
        await page.goto(`${baseUrl}/portfolio?addAsset=1`);
        await page.getByRole('button', { name: /AI import/i }).click();
        await page.locator('input[type=file]').setInputFiles({
          name: 'portfolio-qa.csv',
          mimeType: 'text/csv',
          buffer: Buffer.from(
            'Ticker,Quantity,Buy Price,Currency\nMETA,0.123456789123456789,123.456789123456789,EUR',
          ),
        });
        await expect
          .poll(() => page.locator('main').innerText())
          .toContain('File reader detected 1 position');
        await page.getByRole('button', { name: 'Import valid rows', exact: true }).click();
        await page
          .getByRole('button', { name: 'Import valid rows', exact: true })
          .waitFor({ state: 'hidden' });
        await expect
          .poll(() =>
            page.getByRole('button', { name: 'Saving positions...', exact: true }).count(),
          )
          .toBe(0);
        await page.goto(`${baseUrl}/transactions`);
        await expect
          .poll(() => page.locator('tbody').innerText())
          .toContain('0.123456789123456789');
        expect(await page.locator('tbody').innerText()).toContain('EUR');
        // Controlled provider failures must not take down independent sections.
        await page.route('**/api/market/hot', (route) =>
          route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Isolated provider failure' }),
          }),
        );
        await page.route('**/api/market/stocks', (route) =>
          route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              source: 'Isolated test fixture',
              data: [
                demoQuotes[0],
                ...Array.from({ length: 11 }, (_, index) => ({
                  ...demoQuotes[0],
                  symbol: `QA${index}`,
                  name: 'Isolated test asset',
                })),
                {
                  ...demoQuotes[0],
                  symbol: 'META',
                  name: 'Meta Platforms',
                  price: null,
                  change: null,
                  status: 'unavailable',
                },
              ],
            }),
          }),
        );
        await page.route('**/api/market/asset?symbol=META*', (route) =>
          route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              ...demoQuotes[0],
              symbol: 'META',
              name: 'Meta Platforms',
              price: '150.25',
            }),
          }),
        );
        await page.goto(`${baseUrl}/market`);
        await expect
          .poll(() => page.getByRole('article', { name: 'AAPL market card' }).innerText())
          .toMatch(/225[.,]50/);
        await page.getByRole('button', { name: 'Next page', exact: true }).click();
        await expect
          .poll(() => page.getByRole('article', { name: 'META market card' }).innerText())
          .toMatch(/150[.,]25/);
        await page.getByRole('button', { name: 'Previous page', exact: true }).click();
        await page.getByRole('article', { name: 'AAPL market card', exact: true }).waitFor();
        await page.getByPlaceholder('Search symbol or company').fill('META');
        await expect
          .poll(() => page.getByRole('article', { name: 'META market card' }).innerText())
          .toMatch(/150[.,]25/);
        await expect
          .poll(() => page.getByRole('region', { name: 'Top gainers' }).innerText())
          .toContain('Could not load gainers');
        await page.unroute('**/api/market/stocks');
        await page.route('**/api/market/cryptos', (route) =>
          route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              source: 'Isolated healthy crypto fixture',
              data: demoQuotes.filter((quote) => quote.type === 'crypto'),
            }),
          }),
        );
        await page.route('**/api/market/stocks', (route) =>
          route.fulfill({
            status: 503,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Isolated stocks failure' }),
          }),
        );
        await page.goto(`${baseUrl}/market`);
        await page.getByRole('button', { name: 'Crypto', exact: true }).click();
        await page.getByRole('article', { name: 'BTC market card', exact: true }).waitFor();
        expect(
          await page.getByRole('article', { name: 'BTC market card', exact: true }).innerText(),
        ).toContain('Bitcoin');
        await page.unrouteAll();
        await page.goto(`${baseUrl}/privacy`);
        const download = page.waitForEvent('download');
        await page.getByRole('button', { name: 'Export data', exact: true }).click();
        const exported = await download;
        expect(exported.suggestedFilename()).toMatch(/^zentra-export-.*\.json$/);
        const exportedData = JSON.parse(await readFile((await exported.path())!, 'utf8'));
        expect(exportedData.transactions).toHaveLength(8);
        expect(exportedData.watchlists).toHaveLength(1);
        expect(exportedData.favorites).toHaveLength(1);
        expect(exportedData.socialSubscriptions).toHaveLength(0);
        await page.goto(`${baseUrl}/watchlists`);
        await page.getByRole('button', { name: 'Logout', exact: true }).click();
        await page.waitForURL(`${baseUrl}/auth`);
        await page.getByLabel('Email address').fill(email);
        await page.getByLabel('Password', { exact: true }).fill('Isolated-test-password-2026');
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await page.getByRole('heading', { name: 'Watchlists', exact: true }).waitFor();
        await expect
          .poll(() => page.getByLabel('Rename watchlist').inputValue())
          .toBe('Reviewed tech');
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    },
    60_000,
  );
});
