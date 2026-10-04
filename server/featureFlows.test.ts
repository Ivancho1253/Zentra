import { chromium } from 'playwright';
import { describe, expect, it } from 'vitest';
import { demoHistory, demoQuotes } from '../shared/demo';
const baseUrl = process.env.E2E_BASE_URL;
describe.skipIf(!baseUrl || process.env.E2E_FIREBASE_EMULATORS !== 'true')(
  'wallet, image, language and news journeys',
  () => {
    it('tracks two ecosystems without duplicate trades, reviews a receipt, and retains forms across all three languages', async () => {
      const browser = await chromium.launch({ headless: true });
      try {
        const page = await browser.newPage({
          viewport: { width: 1440, height: 1000 },
          timezoneId: 'America/Montevideo',
        });
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        // Other journeys exercise the market API. Keep repeated language route
        // visits isolated from its shared IP quota using controlled fixtures.
        await page.route('**/api/market/**', (route) => {
          const url = new URL(route.request().url());
          if (url.pathname.endsWith('/asset'))
            return route.fulfill({
              json:
                demoQuotes.find((q) => q.symbol === url.searchParams.get('symbol')) ||
                demoQuotes[0],
            });
          if (url.pathname.endsWith('/history')) return route.fulfill({ json: demoHistory });
          return route.fulfill({
            json: {
              source: 'Controlled market fixtures',
              data: demoQuotes.filter((q) =>
                url.pathname.endsWith('/stocks')
                  ? q.type === 'stock'
                  : url.pathname.endsWith('/cryptos')
                    ? q.type === 'crypto'
                    : true,
              ),
            },
          });
        });
        const scans: string[] = [];
        await page.route('**/api/wallet/read-only?**', (route) => {
          const url = new URL(route.request().url());
          const ecosystem = url.searchParams.get('ecosystem')!;
          scans.push(ecosystem);
          return route.fulfill({
            json: {
              address: url.searchParams.get('address'),
              ecosystem,
              positions: [
                {
                  symbol: ecosystem === 'solana' ? 'SOL' : 'ETH',
                  name: ecosystem === 'solana' ? 'Solana' : 'Ethereum',
                  quantityExact: '1.234567891',
                  quantity: 1.234567891,
                  chain: ecosystem === 'solana' ? 'Solana' : 'Ethereum',
                  source: 'native',
                  recognized: true,
                  price: '200',
                  estimatedValue: 246.9135782,
                  priceProvider: 'Controlled RPC test',
                  priceUpdatedAt: '2026-10-03T12:00:00Z',
                  stale: false,
                },
              ],
              networks: [ecosystem === 'solana' ? 'Solana' : 'Ethereum'],
              failedNetworks: [],
              warnings: [],
              partial: false,
              updatedAt: new Date().toISOString(),
              readOnly: true,
              coverage: 'native-and-spl-tokens',
            },
          });
        });
        await page.route('**/api/ai/import-file', (route) =>
          route.fulfill({
            json: {
              source: 'gemini',
              assets: [
                {
                  symbol: 'NVDA',
                  name: 'NVIDIA Corporation',
                  type: 'stock',
                  quantity: '0.5',
                  averagePrice: '123.45',
                  currency: 'USD',
                  transactionType: 'buy',
                  tradeDate: '2026-10-01T14:30:00Z',
                  fee: '0.25',
                  confidence: 1,
                  recognized: true,
                  currentQuote: { ...demoQuotes[0], price: '250', currency: 'USD' },
                  notes: 'Synthetic receipt test.',
                },
              ],
            },
          }),
        );
        const newsLanguages: string[] = [];
        await page.route('**/api/news?**', (route) => {
          const url = new URL(route.request().url());
          newsLanguages.push(url.searchParams.get('language') || 'en');
          return route.fulfill({
            json: {
              source: 'Controlled news provider',
              articles: Array.from({ length: 15 }, (_, i) => ({
                title: i === 0 ? 'News terminal' : `NVDA verified report ${i}`,
                description: 'Original provider text about NVIDIA.',
                url: `https://news.example/report-${i}`,
                publishedAt: '2026-10-03T12:00:00Z',
                source: { name: 'Original source' },
                provider: 'Controlled news provider',
                relatedAssets: [],
              })),
            },
          });
        });
        await page.goto(`${baseUrl}/portfolio`);
        await page.waitForURL(`${baseUrl}/auth`);
        await page.getByRole('button', { name: 'Register now', exact: true }).click();
        await page.getByLabel('Email address').fill(`features-${Date.now()}@example.test`);
        await page.getByLabel('Password', { exact: true }).fill('Isolated-test-password-2026');
        await page.getByRole('button', { name: 'Register', exact: true }).click();
        await page.getByRole('heading', { name: 'Capital overview' }).waitFor({ timeout: 20000 });
        await page.goto(`${baseUrl}/portfolio?addAsset=1`);
        await page.getByRole('heading', { name: 'Add positions with confidence' }).waitFor();
        await page.getByRole('button', { name: /Read-only wallet/ }).click();
        await page.getByLabel('Public wallet address').fill('0x' + 'a'.repeat(40));
        await page.getByRole('button', { name: 'Link address', exact: true }).click();
        await page.getByRole('heading', { name: 'Tracked wallets', exact: true }).waitFor();
        expect(await page.locator('table').innerText()).toContain('1.234567891');
        await page.getByRole('button', { name: 'Link address', exact: true }).click();
        await expect.poll(async () => scans.length).toBeGreaterThanOrEqual(2);
        await page.getByLabel('Wallet ecosystem').selectOption('solana');
        await page.getByLabel('Public wallet address').fill('11111111111111111111111111111111');
        await page.getByRole('button', { name: 'Link address', exact: true }).click();
        await expect
          .poll(async () =>
            page.getByRole('button', { name: 'Stop tracking', exact: true }).count(),
          )
          .toBe(2);
        await page.getByRole('button', { name: 'Cancel import', exact: true }).click();
        await page.reload();
        await page.getByRole('heading', { name: 'Tracked wallets', exact: true }).waitFor();
        expect(await page.getByRole('button', { name: 'Stop tracking', exact: true }).count()).toBe(
          2,
        );
        await page.goto(`${baseUrl}/transactions`);
        expect(await page.locator('main').innerText()).not.toContain('1.234567891');
        await page.goto(`${baseUrl}/portfolio?addAsset=1`);
        await page.getByRole('button', { name: /AI import/ }).click();
        await page.locator('input[type=file]').setInputFiles('server/fixtures/receipt.png');
        await page.getByLabel('Receipt operation 1').waitFor();
        expect(await page.getByLabel('Receipt date 1').inputValue()).toBe('2026-10-01T11:30');
        expect(await page.locator('table').innerText()).toContain('250 USD');
        const dateBefore = await page.getByLabel('Receipt date 1').inputValue();
        await page.getByRole('button', { name: 'Change language', exact: true }).click();
        await page.getByRole('button', { name: /Español/ }).click();
        expect(await page.locator('html').getAttribute('lang')).toBe('es');
        expect(await page.locator('input[type=datetime-local]').inputValue()).toBe(dateBefore);
        expect(
          await page
            .locator('select')
            .filter({ has: page.locator('option[value="buy"]') })
            .inputValue(),
        ).toBe('buy');
        await page.getByRole('button', { name: 'Cambiar idioma', exact: true }).click();
        await page.getByRole('button', { name: /Português/ }).click();
        expect(await page.locator('html').getAttribute('lang')).toBe('pt');
        await page.getByRole('button', { name: 'Mudar idioma', exact: true }).click();
        await page.getByRole('button', { name: /English/ }).click();
        await page.getByRole('button', { name: 'Import valid rows', exact: true }).click();
        await page.getByRole('heading', { name: 'Capital overview' }).waitFor();
        await page.goto(`${baseUrl}/transactions`);
        await expect.poll(async () => page.locator('table').innerText()).toContain('123.45');
        await page.goto(`${baseUrl}/news`);
        await page.getByRole('link', { name: 'News terminal', exact: true }).waitFor();
        expect(await page.locator('article').count()).toBe(12);
        await page.getByRole('button', { name: 'Load more news', exact: true }).click();
        expect(await page.locator('article').count()).toBe(15);
        await page.getByRole('button', { name: 'Change language', exact: true }).click();
        await page.getByRole('button', { name: /Español/ }).click();
        await expect.poll(() => newsLanguages.includes('es')).toBe(true);
        expect(await page.getByRole('link', { name: 'News terminal', exact: true }).count()).toBe(
          1,
        );
        await page.reload();
        await expect.poll(async () => page.locator('html').getAttribute('lang')).toBe('es');
        expect(errors).toEqual([]);
        await page.screenshot({ path: '.codex-runtime/news-spanish.png', fullPage: false });
        const accountRoutes = [
          '/',
          '/portfolio',
          '/market',
          '/alerts',
          '/risk',
          '/briefing',
          '/news',
          '/watchlists',
          '/transactions',
          '/social',
          '/analytics',
          '/help',
          '/info',
        ];
        const publicRoutes = ['/landing', '/demo', '/privacy', '/security', '/pricing', '/terms'];
        const englishHeadings = new Map<string, string>();
        for (const [language, control, option] of [
          ['en', 'Cambiar idioma', 'English'],
          ['es', 'Change language', 'Español'],
          ['pt', 'Cambiar idioma', 'Português'],
        ]) {
          await page.goto(`${baseUrl}/news`);
          await page.getByRole('button', { name: control, exact: true }).click();
          await page.getByRole('button', { name: new RegExp(option) }).click();
          await expect.poll(async () => page.locator('html').getAttribute('lang')).toBe(language);
          for (const path of [...accountRoutes, ...publicRoutes]) {
            if (accountRoutes.includes(path))
              await page.locator(`aside a[href="${path}"]`).first().click();
            else await page.goto(`${baseUrl}${path}`);
            const heading = page.getByRole('heading', { level: 1 }).first();
            await heading.waitFor();
            const label = await heading.innerText();
            if (language === 'en') englishHeadings.set(path, label);
            else
              expect(label, `${language} heading on ${path}`).not.toBe(englishHeadings.get(path));
            expect(await page.locator('html').getAttribute('lang')).toBe(language);
          }
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${baseUrl}/news`);
        await page.getByRole('heading', { level: 1 }).waitFor();
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          390,
        );
        const more = page.getByRole('button', { name: 'Mais', exact: true });
        expect(
          await more.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return element.contains(
              document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
            );
          }),
        ).toBe(true);
        await more.click();
        await page.locator('a[href="/risk"]').last().waitFor();
        const infoLink = page.locator('a[href="/info"]').last();
        expect(
          await infoLink.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return element.contains(
              document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
            );
          }),
        ).toBe(true);
        await more.click();
        await page.screenshot({ path: '.codex-runtime/news-portuguese-mobile.png' });
        await page.goto(`${baseUrl}/market/stocks/NVDA`);
        await page.getByRole('heading', { level: 1 }).waitFor();
        expect(
          await more.evaluate((element) => {
            const box = element.getBoundingClientRect();
            return element.contains(
              document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2),
            );
          }),
        ).toBe(true);
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    }, 120000);
  },
);
