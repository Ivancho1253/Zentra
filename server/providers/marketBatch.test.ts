import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./transport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./transport')>()),
  providerGet: vi.fn(),
}));
import { providerGet } from './transport';
import { YahooMarketProvider } from './market';
const get = vi.mocked(providerGet);
describe('stock batch quote adapter', () => {
  beforeEach(() => get.mockReset());
  it('maps share classes and ignores unsolicited or invalid provider rows', async () => {
    get.mockResolvedValue({
      spark: {
        result: [
          {
            symbol: 'BRK-B',
            response: [
              {
                meta: {
                  regularMarketPrice: 520,
                  chartPreviousClose: 500,
                  regularMarketTime: 1791849600,
                  currency: 'USD',
                },
              },
            ],
          },
          { symbol: 'UNREQUESTED', response: [{ meta: { regularMarketPrice: 99 } }] },
          { symbol: 'MSFT', response: [{ meta: { regularMarketPrice: -1 } }] },
        ],
      },
    });
    const quotes = await new YahooMarketProvider().quotes(['BRK.B', 'MSFT']);
    expect(quotes).toHaveLength(1);
    expect(quotes[0]).toMatchObject({
      symbol: 'BRK.B',
      price: '520',
      change: '4',
      provider: 'Yahoo Finance',
      status: 'delayed',
    });
    expect(String(get.mock.calls[0][1])).toContain('BRK-B');
    expect(quotes[0].updatedAt).not.toBeNull();
  });
  it('rejects empty provider responses and oversized batches', async () => {
    get.mockResolvedValue({ spark: { result: null } });
    await expect(new YahooMarketProvider().quotes(['AAPL'])).rejects.toThrow();
    await expect(new YahooMarketProvider().quotes(Array(21).fill('AAPL'))).rejects.toThrow();
    expect(get).toHaveBeenCalledTimes(1);
  });
});
