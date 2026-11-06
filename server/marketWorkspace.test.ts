import { chromium } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { catalog } from '../shared/catalog';
import { demoHistory, demoQuotes } from '../shared/demo';
const baseUrl = process.env.E2E_BASE_URL;
const stocks = catalog
  .filter((asset) => asset.type === 'stock')
  .map((asset, index) => ({
    ...demoQuotes[0],
    ...asset,
    currency: 'USD',
    price: String(100 + index),
    change: String((index % 7) - 3),
    status: 'demo',
    provider: 'Isolated browser fixtures',
  }));

describe.skipIf(!baseUrl)('Zentra Charts browser journey', () => {
  it.skipIf(process.env.E2E_FIREBASE_EMULATORS !== 'true')(
    'browses the entire constituent map, focuses sectors and opens a large chart',
    async () => {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
        let data = { data: stocks };
        try {
          data = JSON.parse(await readFile('.codex-runtime/previews/live-stocks.json', 'utf8'));
        } catch {
          /* CI uses isolated market fixtures. */
        }
        await page.route('**/api/market/**', (route) => {
          const url = new URL(route.request().url());
          if (url.pathname.endsWith('/stocks')) return route.fulfill({ json: data });
          if (url.pathname.endsWith('/history')) return route.fulfill({ json: demoHistory });
          if (url.pathname.endsWith('/asset'))
            return route.fulfill({
              json:
                data.data.find((item) => item.symbol === url.searchParams.get('symbol')) ||
                demoQuotes[0],
            });
          return route.fulfill({
            json: { data: demoQuotes.filter((item) => item.type === 'crypto') },
          });
        });
        await page.goto(`${baseUrl}/market?view=heatmap`);
        await page.waitForURL(`${baseUrl}/auth`);
        await page.getByRole('button', { name: 'Register now', exact: true }).click();
        await page.getByLabel('Email address').fill(`map-${Date.now()}@example.test`);
        await page.getByLabel('Password', { exact: true }).fill('Zentra-test-only-32');
        await page.getByRole('button', { name: 'Register', exact: true }).click();
        await page.locator('.heat-tile').first().waitFor();
        expect(await page.locator('.heat-tile').count()).toBe(503);
        await mkdir('.codex-runtime/previews', { recursive: true });
        await page.screenshot({
          path: '.codex-runtime/previews/zentra-heatmap.png',
          fullPage: true,
        });
        await page
          .getByRole('combobox', { name: 'Heat map sector', exact: true })
          .selectOption('Energy');
        expect(await page.locator('.heat-tile').count()).toBe(
          catalog.filter((item) => item.isSp500 && item.sector === 'Energy').length,
        );
        await page.getByRole('button', { name: 'Expand heat map', exact: true }).click();
        expect(await page.locator('.market-map-expanded').count()).toBe(1);
        await page
          .getByRole('combobox', { name: 'Heat map sector', exact: true })
          .selectOption('all');
        await page.screenshot({
          path: '.codex-runtime/previews/zentra-heatmap.png',
          fullPage: false,
        });
        await page.keyboard.press('Escape');
        await page
          .getByRole('combobox', { name: 'Heat map sector', exact: true })
          .selectOption('all');
        await page.setViewportSize({ width: 390, height: 844 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        await page.screenshot({
          path: '.codex-runtime/previews/zentra-heatmap-mobile.png',
          fullPage: true,
        });
        await page.setViewportSize({ width: 1600, height: 1100 });
        await page.locator('.heat-tile').filter({ hasText: 'NVDA' }).first().click();
        await page.waitForURL(/\/charts\?symbol=NVDA/);
        await page.getByRole('heading', { name: 'NVDA', exact: true }).waitFor();
      } finally {
        await browser.close();
      }
    },
    90_000,
  );
  it('searches symbols, renders original candles, pans, draws, exports and adapts to mobile', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({
        viewport: { width: 1500, height: 1000 },
        acceptDownloads: true,
      });
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/api/market/**', (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/history'))
          return route.fulfill({
            json: {
              ...demoHistory,
              symbol: url.searchParams.get('symbol'),
              range: url.searchParams.get('range'),
            },
          });
        if (url.pathname.endsWith('/asset'))
          return route.fulfill({
            json:
              stocks.find((quote) => quote.symbol === url.searchParams.get('symbol')) ||
              demoQuotes[0],
          });
        return route.fulfill({
          json: {
            data: url.pathname.endsWith('/stocks')
              ? stocks
              : demoQuotes.filter((quote) => quote.type === 'crypto'),
            source: 'Isolated browser fixtures',
          },
        });
      });
      await page.goto(`${baseUrl}/charts?symbol=NVDA&type=stock`);
      await page.getByRole('heading', { name: 'NVDA', exact: true }).waitFor();
      const plot = page.locator('canvas');
      await plot.waitFor();
      await expect
        .poll(() => plot.evaluate((element) => (element as HTMLCanvasElement).width))
        .toBeGreaterThan(800);
      expect(
        await plot.evaluate((element) => {
          const chart = element as HTMLCanvasElement;
          const pixels = chart.getContext('2d')!.getImageData(0, 0, chart.width, chart.height).data;
          let green = 0,
            red = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i + 1] > 140 && pixels[i] < pixels[i + 1] * 0.8) green++;
            if (pixels[i] > 150 && pixels[i] > pixels[i + 1] * 1.2) red++;
          }
          return green > 20 && red > 20;
        }),
      ).toBe(true);
      const surface = page.locator('.zentra-chart-surface');
      const initial = await surface.getAttribute('data-chart-view');
      await page.getByRole('button', { name: 'Zoom in chart', exact: true }).click();
      expect(await surface.getAttribute('data-chart-view')).not.toBe(initial);
      await page.getByRole('button', { name: 'Reset chart view', exact: true }).click();
      expect(await surface.getAttribute('data-chart-view')).toBe(initial);
      await page.getByRole('button', { name: 'Indicators', exact: true }).click();
      await page.getByRole('checkbox', { name: 'EMA', exact: true }).check();
      await page.getByRole('checkbox', { name: 'SMA', exact: true }).check();
      await page.getByRole('button', { name: 'Close indicators', exact: true }).click();
      await page.getByRole('button', { name: 'Trend line', exact: true }).click();
      await plot.click({ position: { x: 130, y: 140 } });
      await plot.click({ position: { x: 360, y: 260 } });
      expect(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem('zentra:chart-drawings:stock:NVDA') || '[]').length,
        ),
      ).toBe(1);
      await page.getByRole('button', { name: 'Undo drawing', exact: true }).click();
      expect(
        await page.evaluate(
          () => JSON.parse(localStorage.getItem('zentra:chart-drawings:stock:NVDA') || '[]').length,
        ),
      ).toBe(0);
      const downloaded = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Download chart image', exact: true }).click();
      expect((await downloaded).suggestedFilename()).toBe('zentra-NVDA-1d-MAX.png');
      await page.getByRole('button', { name: 'Expand chart', exact: true }).click();
      expect(await page.locator('.zentra-chart-expanded').count()).toBe(1);
      await page.keyboard.press('Escape');
      expect(await page.locator('.zentra-chart-expanded').count()).toBe(0);
      await page.getByRole('textbox', { name: 'Find chart symbol', exact: true }).fill('BRK.B');
      await page.getByRole('button', { name: 'BRK.B chart', exact: true }).click();
      await page.getByRole('heading', { name: 'BRK.B', exact: true }).waitFor();
      expect(new URL(page.url()).searchParams.get('symbol')).toBe('BRK.B');
      await page.getByRole('textbox', { name: 'Find chart symbol', exact: true }).fill('');
      await page
        .getByRole('combobox', { name: 'Chart asset category', exact: true })
        .selectOption('etf');
      await page.getByRole('button', { name: 'SPY chart', exact: true }).click();
      expect(new URL(page.url()).searchParams.get('type')).toBe('etf');
      await mkdir('.codex-runtime/previews', { recursive: true });
      await page.screenshot({ path: '.codex-runtime/previews/chart-browser-fixture.png' });
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: '.codex-runtime/previews/chart-mobile-fixture.png' });
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  }, 90_000);
  it('changes candle intervals, loads older pages and configures aligned indicator panels', async () => {
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 1600, height: 1150 } });
      const errors: string[] = [],
        intervals: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/api/market/**', (route) => {
        const url = new URL(route.request().url());
        if (!url.pathname.endsWith('/history'))
          return route.fulfill({
            json: url.pathname.endsWith('/asset')
              ? stocks[0]
              : {
                  data: url.pathname.endsWith('/stocks')
                    ? stocks
                    : demoQuotes.filter((quote) => quote.type === 'crypto'),
                },
          });
        const interval = url.searchParams.get('interval') || '1d';
        intervals.push(interval);
        const duration = {
          '1h': 3600000,
          '4h': 14400000,
          '1d': 86400000,
          '1w': 604800000,
          '1mo': 2592000000,
        }[interval]!;
        const count = interval === '1w' ? 120 : interval === '1mo' ? 60 : 300;
        const before = Number(url.searchParams.get('before'));
        const end = before || Date.UTC(2026, 9, 12);
        const candles = Array.from({ length: count }, (_, i) => {
          const close = 100 + i / 10 + Math.sin(i / 4) * 4;
          return {
            timestamp: end - (count - i) * duration,
            open: close + Math.sin(i),
            high: close + 2,
            low: close - 2,
            close,
            volume: 10000 + i * 100,
          };
        });
        return route.fulfill({
          json: {
            ...demoHistory,
            symbol: 'NVDA',
            range: 'MAX',
            interval,
            candles,
            points: candles.map((bar) => ({ timestamp: bar.timestamp, value: bar.close })),
            nextBefore: !before && interval === '1h' ? candles[0].timestamp - 1 : null,
          },
        });
      });
      await page.goto(`${baseUrl}/charts?symbol=NVDA&type=stock`);
      const surface = page.locator('.zentra-chart-surface');
      await expect.poll(() => surface.getAttribute('data-candle-count')).toBe('300');
      const initial = await surface.getAttribute('data-chart-view');
      expect(initial).toBe('120:180');
      await page.locator('.chart-history-tools summary').click();
      await page.getByRole('button', { name: 'Go to first candle', exact: true }).click();
      expect(await surface.getAttribute('data-chart-view')).toBe('0:180');
      await page.getByRole('button', { name: 'Fit entire history', exact: true }).click();
      expect(await surface.getAttribute('data-chart-view')).toBe('0:300');
      await page.locator('.chart-history-tools summary').click();
      await page.getByRole('button', { name: 'Indicators', exact: true }).click();
      expect(
        await page.getByRole('checkbox', { name: 'VWAP (UTC session)', exact: true }).isDisabled(),
      ).toBe(true);
      for (const name of ['RSI', 'MACD', 'Bollinger Bands', 'SMA 200'])
        await page.getByRole('checkbox', { name, exact: true }).check();
      await page
        .getByRole('dialog', { name: 'Indicators' })
        .getByRole('button', { name: 'Settings RSI', exact: true })
        .click();
      await page.getByRole('spinbutton', { name: 'RSI Period', exact: true }).fill('7');
      expect(
        await page.getByRole('spinbutton', { name: 'RSI Period', exact: true }).inputValue(),
      ).toBe('7');
      await page
        .getByRole('dialog', { name: 'Indicators' })
        .getByRole('button', { name: 'Settings Bollinger Bands', exact: true })
        .click();
      await page
        .getByRole('spinbutton', { name: 'Bollinger Bands Deviation', exact: true })
        .fill('2.5');
      await page.getByRole('button', { name: 'Close indicators', exact: true }).click();
      expect(await page.getByLabel('Active indicators', { exact: true }).textContent()).toContain(
        'RSI 7',
      );
      await mkdir('.codex-runtime/previews', { recursive: true });
      await page.screenshot({
        path: '.codex-runtime/previews/chart-indicators-fixture.png',
        fullPage: true,
      });
      const intervalSelect = page.getByRole('combobox', { name: 'Candle interval', exact: true });
      for (const interval of ['1h', '4h', '1w', '1mo', '1d']) {
        await intervalSelect.selectOption(interval);
        await expect.poll(() => surface.getAttribute('data-chart-interval')).toBe(interval);
        await expect
          .poll(() => surface.getAttribute('data-candle-count'))
          .toBe(interval === '1w' ? '120' : interval === '1mo' ? '60' : '300');
        if (interval === '1h') {
          await page.locator('.chart-history-tools summary').click();
          await page.getByRole('button', { name: 'Load older candles', exact: true }).click();
          await expect.poll(() => surface.getAttribute('data-candle-count')).toBe('600');
          // The new data is prepended without moving the visible time window.
          expect(await surface.getAttribute('data-chart-view')).toBe('420:180');
          await page.locator('.chart-history-tools summary').click();
        }
      }
      expect(new Set(intervals)).toEqual(new Set(['1d', '1h', '4h', '1w', '1mo']));
      await intervalSelect.selectOption('1h');
      await expect.poll(() => surface.getAttribute('data-candle-count')).toBe('600');
      await page.getByRole('button', { name: 'Indicators', exact: true }).click();
      const extraIndicators = [
        'SMA',
        'EMA',
        'SMA 50',
        'VWAP (UTC session)',
        'Stochastic',
        'ATR',
        'ADX / DMI',
        'OBV',
        'Ichimoku',
      ];
      for (const name of extraIndicators)
        await page.getByRole('checkbox', { name, exact: true }).check();
      await page.getByRole('button', { name: 'On chart 13', exact: true }).waitFor();
      await page
        .getByRole('dialog', { name: 'Indicators' })
        .getByRole('button', { name: 'Settings MACD', exact: true })
        .click();
      await page.getByRole('spinbutton', { name: 'MACD Fast', exact: true }).fill('100');
      expect(
        await page.getByRole('spinbutton', { name: 'MACD Fast', exact: true }).inputValue(),
      ).toBe('25');
      await page.getByRole('spinbutton', { name: 'MACD Fast', exact: true }).fill('12');
      for (const name of extraIndicators)
        await page.getByRole('checkbox', { name, exact: true }).uncheck();
      await page.getByRole('button', { name: 'Close indicators', exact: true }).click();
      const requestsBeforeWindowChange = intervals.length;
      await page.getByRole('button', { name: '1D', exact: true }).click();
      expect(intervals.length).toBe(requestsBeforeWindowChange);
      await page.getByRole('button', { name: 'All history', exact: true }).click();
      await intervalSelect.selectOption('1d');
      await page.setViewportSize({ width: 390, height: 844 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: '.codex-runtime/previews/chart-indicators-mobile-fixture.png',
        fullPage: true,
      });
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  }, 90_000);
});
