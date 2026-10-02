import { z } from 'zod';
import type { MarketEvent } from '../../shared/domain';
import type { MarketEventProvider } from './contracts';
import { endpoint, providerGet } from './transport';
export class FinnhubEventProvider implements MarketEventProvider {
  readonly name = 'Finnhub';
  constructor(private token: string) {}
  async events(): Promise<MarketEvent[]> {
    const from = new Date().toISOString().slice(0, 10),
      to = new Date(Date.now() + 31 * 86400000).toISOString().slice(0, 10);
    const data = z
      .object({
        earningsCalendar: z.array(
          z.object({
            symbol: z.string().min(1).max(20),
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          }),
        ),
      })
      .parse(
        await providerGet(
          this.name,
          endpoint('https://finnhub.io/api/v1/calendar/earnings', { from, to }),
          { 'X-Finnhub-Token': this.token },
        ),
      );
    return data.earningsCalendar
      .filter((e) => Number.isFinite(Date.parse(e.date)))
      .map((e) => ({
        symbol: e.symbol.toUpperCase(),
        date: e.date,
        kind: 'earnings',
        precision: 'date',
        provider: this.name,
        sourceUrl: `https://finnhub.io/`,
        updatedAt: null,
        fetchedAt: new Date().toISOString(),
      }));
  }
}
