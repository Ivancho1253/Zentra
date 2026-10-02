import { z } from 'zod';
import type { Currency, FXRate } from '../../shared/domain';
import type { FXProvider } from './contracts';
import { providerGet } from './transport';
export const currencySchema = z.enum(['USD', 'EUR', 'ARS', 'GBP']);
export class ExchangeRateProvider implements FXProvider {
  readonly name = 'ExchangeRate-API';
  async rates(base: Currency): Promise<FXRate[]> {
    const data = z
      .object({
        result: z.literal('success'),
        base_code: currencySchema,
        time_last_update_unix: z.number().positive(),
        rates: z.record(z.string(), z.number().positive()),
      })
      .parse(await providerGet(this.name, `https://open.er-api.com/v6/latest/${base}`));
    if (data.base_code !== base) throw new Error('Incorrect FX base');
    return currencySchema.options.flatMap((quote) =>
      data.rates[quote]
        ? [
            {
              base,
              quote,
              rate: String(data.rates[quote]),
              provider: this.name,
              updatedAt: new Date(data.time_last_update_unix * 1000).toISOString(),
            },
          ]
        : [],
    );
  }
  async rate(base: Currency, quote: Currency): Promise<FXRate> {
    const rate = (await this.rates(base)).find((r) => r.quote === quote);
    if (!rate) throw new Error('Currency is not covered by the provider');
    return rate;
  }
}
