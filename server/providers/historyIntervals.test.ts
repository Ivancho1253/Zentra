import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./transport', async (original) => ({
  ...(await original<typeof import('./transport')>()),
  providerGet: vi.fn(),
}));
import { providerGet } from './transport';
import { TwelveDataProvider, YahooMarketProvider } from './market';
const get = vi.mocked(providerGet);
const yahoo = () => ({
  chart: {
    result: [
      {
        meta: { currency: 'USD', exchangeTimezoneName: 'America/New_York' },
        timestamp: Array.from({ length: 7 }, (_, i) => 1704205800 + i * 3600),
        indicators: {
          quote: [
            {
              open: Array(7).fill(100),
              high: Array(7).fill(105),
              low: Array(7).fill(95),
              close: Array(7).fill(102),
              volume: Array(7).fill(100),
            },
          ],
        },
      },
    ],
  },
});
describe('independent history intervals and coverage', () => {
  beforeEach(() => get.mockReset());
  it('requests all daily observations instead of silently replacing MAX with monthly candles', async () => {
    get.mockResolvedValue(yahoo());
    const data = await new YahooMarketProvider().history('NVDA', 'stock', 'MAX', '1d');
    const url = new URL(String(get.mock.calls[0][1]));
    expect(url.searchParams.get('interval')).toBe('1d');
    expect(url.searchParams.get('period1')).toBe('0');
    expect(data).toMatchObject({ interval: '1d', coverage: 'available', nextBefore: null });
  });
  it('reports hourly retention limits and aggregates exact four-hour session candles', async () => {
    get.mockResolvedValue(yahoo());
    const data = await new YahooMarketProvider().history('NVDA', 'stock', 'MAX', '4h');
    const url = new URL(String(get.mock.calls[0][1]));
    expect(url.searchParams.get('range')).toBe('730d');
    expect(url.searchParams.get('interval')).toBe('60m');
    expect(data.candles).toHaveLength(2);
    expect(data.candles.map((bar) => bar.volume)).toEqual([400, 300]);
    expect(data.coverage).toBe('limited');
  });
  it('paginates 5000-record Twelve Data windows backwards without duplicate boundary bars', async () => {
    const values = Array.from({ length: 5000 }, (_, i) => ({
      datetime: new Date(Date.UTC(2026, 0, 1) - i * 3600000).toISOString(),
      open: '100',
      high: '105',
      low: '95',
      close: '102',
      volume: '100',
    }));
    get.mockResolvedValue({ values });
    const provider = new TwelveDataProvider('test-only');
    const data = await provider.history('EURUSD=X', 'forex', 'MAX', '1h');
    const url = new URL(String(get.mock.calls[0][1]));
    expect(url.searchParams.get('symbol')).toBe('EUR/USD');
    expect(url.searchParams.get('interval')).toBe('1h');
    expect(url.searchParams.get('outputsize')).toBe('5000');
    expect(data.nextBefore).toBe(data.candles[0].timestamp - 1);
    expect(data.coverage).toBe('partial');
    get.mockResolvedValue({
      values: [
        values.at(-1),
        { ...values.at(-1), datetime: new Date(data.nextBefore! - 3600000).toISOString() },
      ],
    });
    const older = await provider.history('EURUSD=X', 'forex', 'MAX', '1h', data.nextBefore!);
    expect(older.candles).toHaveLength(1);
    expect(older.candles[0].timestamp).toBeLessThan(data.candles[0].timestamp);
    expect(older.nextBefore).toBeNull();
  });
  it('removes the zero-volume closing quote from hourly candles', async () => {
    const payload = yahoo(),
      row = payload.chart.result[0],
      series = row.indicators.quote[0];
    const time = row.timestamp.at(-1)! + 1800;
    Object.assign(row.meta, { regularMarketTime: time });
    row.timestamp.push(time);
    series.open.push(102);
    series.high.push(102);
    series.low.push(102);
    series.close.push(102);
    series.volume.push(0);
    get.mockResolvedValue(payload);
    const data = await new YahooMarketProvider().history('NVDA', 'stock', 'MAX', '1h');
    expect(data.candles).toHaveLength(7);
    expect(data.updatedAt).toBe(new Date(time * 1000).toISOString());
  });
});
