import { useId, useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { ExternalLink, RefreshCw } from 'lucide-react';
import type { AssetQuote, AssetType, MarketHistory, NewsItem } from '../../shared/domain';
import {
  technicalResearch,
  type AssetFundamentals,
  type FinancialValue,
  type TechnicalReading,
} from '../../shared/assetResearch';
import { useLanguage } from '../contexts/LanguageContext';
import { readJson } from '../lib/query';

type Tab = 'technical' | 'fundamentals' | 'news';
const tabs: { id: Tab; label: string }[] = [
  { id: 'technical', label: 'Technical analysis' },
  { id: 'fundamentals', label: 'Fundamentals' },
  { id: 'news', label: 'Asset news' },
];
const numberValue = (value: string | null | undefined) =>
  value == null || value.trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);

export default function AssetAnalysis({
  symbol,
  type,
  quote,
}: {
  symbol: string;
  type: AssetType;
  quote?: AssetQuote;
}) {
  const { text, locale, language } = useLanguage();
  const [tab, setTab] = useState<Tab>('technical');
  const sectionId = useId();
  const history = useInfiniteQuery({
    queryKey: ['chart-history', type, symbol, '1d'],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ signal, pageParam }) =>
      readJson<MarketHistory>(
        `/api/market/history?symbol=${encodeURIComponent(symbol)}&type=${type}&range=MAX&interval=1d${pageParam ? `&before=${pageParam}` : ''}`,
        signal,
      ),
    getNextPageParam: (page) => page.nextBefore || undefined,
    staleTime: 300_000,
    enabled: tab !== 'news',
  });
  const report = useMemo(
    () =>
      technicalResearch(
        history.data?.pages.flatMap((page) => page.candles) || [],
        type === 'crypto',
      ),
    [history.data?.pages, type],
  );
  const dailySource = history.data?.pages[0];
  const fundamentals = useQuery({
    queryKey: ['fundamentals', type, symbol],
    queryFn: ({ signal }) =>
      readJson<AssetFundamentals>(
        `/api/market/fundamentals?symbol=${encodeURIComponent(symbol)}&type=${type}`,
        signal,
      ),
    enabled: tab === 'fundamentals' && type === 'stock',
    staleTime: 86_400_000,
  });
  const companyName = quote?.name || symbol;
  const searchName = companyName
    .replace(/"/g, '')
    .replace(/,?\s+(inc\.?|corporation|corp\.?|holdings).*$/i, '')
    .trim()
    .slice(0, 85);
  const newsSearch = companyName === symbol || !searchName ? symbol : `"${searchName}" ${symbol}`;
  const news = useQuery({
    queryKey: ['asset-research-news', type, symbol, language, companyName],
    queryFn: ({ signal }) =>
      readJson<{ articles: NewsItem[]; stale?: boolean; source?: string }>(
        `/api/news?q=${encodeURIComponent(newsSearch)}&language=${language}`,
        signal,
      ),
    enabled: tab === 'news',
    staleTime: 180_000,
  });
  const digits = type === 'forex' ? 6 : 2;
  const format = (value: number | null | undefined, places = digits, compact = false) =>
    value == null || !Number.isFinite(value)
      ? '—'
      : new Intl.NumberFormat(locale, {
          maximumFractionDigits: places,
          ...(compact ? { notation: 'compact' } : {}),
        }).format(value);
  const percent = (value: number | null | undefined) =>
    value == null ? '—' : `${format(value, 2)}%`;
  const date = (value: string | number | null | undefined) =>
    value == null || !Number.isFinite(new Date(value).getTime())
      ? '—'
      : new Date(value).toLocaleDateString(locale, {
          timeZone: 'UTC',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
  const metric = (label: string, value: string, detail?: string) => (
    <div className="min-w-0 py-3" key={label}>
      <dt className="text-[11px] text-text-dim">{text(label)}</dt>
      <dd className="mt-1 truncate text-sm font-medium tabular-nums" title={detail}>
        {value}
      </dd>
    </div>
  );
  const readingLabel = (item: TechnicalReading, moving = false) => {
    if (!item.reading) return text('Insufficient history');
    if (moving)
      return text(
        item.reading === 'above'
          ? 'Price above average'
          : item.reading === 'below'
            ? 'Price below average'
            : 'At the average',
      );
    if (item.id === 'macd')
      return text(
        item.reading === 'above'
          ? 'Above signal'
          : item.reading === 'below'
            ? 'Below signal'
            : 'At signal',
      );
    if (item.id === 'adx')
      return text(item.reading === 'strong' ? 'Trend strength ≥ 25' : 'Trend strength < 25');
    if (item.id === 'rsi')
      return text(
        item.reading === 'high'
          ? 'Above 70'
          : item.reading === 'low'
            ? 'Below 30'
            : 'Between 30 and 70',
      );
    return text(
      item.reading === 'high'
        ? 'Above 80'
        : item.reading === 'low'
          ? 'Below 20'
          : 'Between 20 and 80',
    );
  };
  const readingTable = (title: string, rows: TechnicalReading[], moving = false) => (
    <div className="min-w-0">
      <h3 className="mb-3 text-sm font-medium">{text(title)}</h3>
      <table className="w-full text-xs">
        <thead className="text-text-dim">
          <tr>
            <th className="pb-2 text-left font-normal">{text('Indicator')}</th>
            <th className="pb-2 text-right font-normal">{text('Value')}</th>
            <th className="pb-2 pl-4 text-right font-normal">{text('Context')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item) => (
            <tr key={item.id} className="border-t border-border-accent">
              <td className="py-3">{item.label}</td>
              <td className="py-3 text-right font-medium tabular-nums">
                {format(item.value, item.id === 'macd' ? 4 : moving ? digits : 2)}
              </td>
              <td className="py-3 pl-4 text-right text-text-dim">{readingLabel(item, moving)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const annual = fundamentals.data?.annual[0];
  const balance = fundamentals.data?.balance;
  const financial = (value: FinancialValue | null | undefined, compact = true) =>
    value
      ? `${format(value.value, 2, compact)} ${value.unit === 'USD/shares' ? 'USD' : value.unit}`
      : '—';
  const financialTitle = (value: FinancialValue | null | undefined) =>
    value
      ? `${format(value.value)} ${value.unit} · ${text('Period ending')} ${date(value.periodEnd)} · ${text('Filed')} ${date(value.filedAt)} · ${value.concept}`
      : undefined;
  const recentNews = (news.data?.articles || [])
    .filter((article) => /^https?:\/\//i.test(article.url))
    .slice(0, 8);
  const marketMetrics = (
    <>
      <h3 className="text-sm font-medium">{text('Market data')}</h3>
      <dl className="mt-2 grid grid-cols-2 gap-x-8 sm:grid-cols-3 lg:grid-cols-4">
        {metric(
          'Market capitalization',
          format(numberValue(quote?.marketCap), 2, true),
          quote?.currency,
        )}
        {metric('Daily volume', format(numberValue(quote?.volume), 2, true), quote?.volumeUnit)}
        {metric('Exchange', quote?.exchange || '—')}
        {metric('Sector', quote?.sector ? text(quote.sector) : '—')}
        {metric('Currency', quote?.currency || dailySource?.currency || '—')}
        {metric('52-week low / high', `${format(report.yearLow)} / ${format(report.yearHigh)}`)}
        {type === 'crypto' &&
          metric('Circulating supply', format(numberValue(quote?.circulatingSupply), 2, true))}
        {type === 'crypto' &&
          metric('Total supply', format(numberValue(quote?.totalSupply), 2, true))}
        {type === 'crypto' && metric('All-time high', format(numberValue(quote?.allTimeHigh)))}
      </dl>
      <p className="mt-1 text-[11px] leading-relaxed text-text-dim">
        {quote?.provider || text('Unavailable')} · {text('Quote updated')} {date(quote?.updatedAt)}{' '}
        · {text(quote?.stale ? 'stale' : quote?.status || 'unavailable')}
      </p>
      {!report.yearComplete && (
        <p className="mt-1 text-[11px] text-text-dim">
          {text('The price range covers only the loaded history.')}
        </p>
      )}
    </>
  );
  return (
    <section
      className="min-w-0 border-t border-border-accent bg-bg"
      data-testid="asset-analysis"
      aria-label={text('Asset research')}
    >
      <div
        className="flex min-w-0 items-center gap-1 overflow-x-auto border-b border-border-accent px-3 sm:px-5"
        role="tablist"
        aria-label={text('Asset research')}
      >
        {tabs.map((item, index) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`${sectionId}-${item.id}`}
            aria-controls={`${sectionId}-panel`}
            aria-selected={tab === item.id}
            tabIndex={tab === item.id ? 0 : -1}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => {
              const next =
                event.key === 'ArrowRight'
                  ? (index + 1) % tabs.length
                  : event.key === 'ArrowLeft'
                    ? (index + tabs.length - 1) % tabs.length
                    : event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? tabs.length - 1
                        : -1;
              if (next < 0) return;
              event.preventDefault();
              setTab(tabs[next].id);
              document.getElementById(`${sectionId}-${tabs[next].id}`)?.focus();
            }}
            className={`relative shrink-0 px-3 py-4 text-sm transition-colors ${tab === item.id ? 'font-medium text-text-main' : 'text-text-dim hover:text-text-main'}`}
          >
            {text(item.label)}
            {tab === item.id && <span className="absolute inset-x-3 bottom-0 h-0.5 bg-accent" />}
          </button>
        ))}
      </div>
      <div
        id={`${sectionId}-panel`}
        role="tabpanel"
        aria-labelledby={`${sectionId}-${tab}`}
        className="min-w-0 p-4 sm:p-6"
      >
        {tab === 'technical' && (
          <>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-medium">{text('Daily technical snapshot')}</h2>
                <p className="mt-1 text-xs text-text-dim">
                  {symbol} · {text('Daily close')} {format(report.last?.close)} ·{' '}
                  {date(report.last?.timestamp)}
                </p>
              </div>
              <button
                type="button"
                className="flex items-center gap-2 text-xs text-text-dim hover:text-text-main disabled:opacity-50"
                disabled={history.isFetching}
                onClick={() => void history.refetch()}
              >
                <RefreshCw size={13} className={history.isFetching ? 'animate-spin' : ''} />
                {text('Refresh analysis')}
              </button>
            </div>
            {history.isPending ? (
              <p className="py-8 text-sm text-text-dim">{text('Loading daily history…')}</p>
            ) : !report.last ? (
              <p className="py-8 text-sm text-text-dim">
                {text('Daily history is unavailable. Retry when the source recovers.')}
              </p>
            ) : (
              <>
                <div className="grid gap-7 xl:grid-cols-2">
                  {readingTable('Moving averages', report.moving, true)}
                  {readingTable('Momentum and trend', report.oscillators)}
                </div>
                <div className="mt-6 grid gap-7 lg:grid-cols-2">
                  <div>
                    <h3 className="text-sm font-medium">{text('Performance and volatility')}</h3>
                    <dl className="mt-2 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
                      {report.performance.map((item) =>
                        metric(
                          item.days === 30
                            ? '1-month return'
                            : item.days === 90
                              ? '3-month return'
                              : '1-year return',
                          percent(item.value),
                        ),
                      )}
                      {metric('Annualized volatility (30 sessions)', percent(report.volatility))}
                      {metric('ATR (14)', `${format(report.atr)} · ${percent(report.atrPercent)}`)}
                      {metric('Maximum drawdown (loaded year)', percent(report.drawdown))}
                    </dl>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium">{text('Price levels')}</h3>
                    <dl className="mt-2 grid grid-cols-2 gap-x-6 sm:grid-cols-3">
                      {metric('Bollinger lower (20, 2)', format(report.bands.lower))}
                      {metric('Bollinger middle', format(report.bands.middle))}
                      {metric('Bollinger upper (20, 2)', format(report.bands.upper))}
                      {metric('Pivot', format(report.pivots?.p))}
                      {metric(
                        'Support S1 / S2',
                        `${format(report.pivots?.s1)} / ${format(report.pivots?.s2)}`,
                      )}
                      {metric(
                        'Resistance R1 / R2',
                        `${format(report.pivots?.r1)} / ${format(report.pivots?.r2)}`,
                      )}
                    </dl>
                    <p className="text-[11px] text-text-dim">
                      {text('Classic pivots use the preceding daily candle.')}{' '}
                      {date(report.pivots?.timestamp)}
                    </p>
                  </div>
                </div>
                <p className="mt-6 border-t border-border-accent pt-3 text-[11px] leading-relaxed text-text-dim">
                  {dailySource?.provider} · {text(dailySource?.status || 'unavailable')} ·{' '}
                  {text('Calculated from daily candles')} · {format(report.count, 0)}{' '}
                  {text('candles')} · {text('Source updated')} {date(dailySource?.updatedAt)}
                  {(dailySource?.stale || history.isError) && ` · ${text('stale')}`}
                  <br />
                  {text(
                    'Readings describe observed prices; they are not buy or sell recommendations.',
                  )}
                </p>
              </>
            )}
          </>
        )}
        {tab === 'fundamentals' && (
          <>
            {marketMetrics}
            {type !== 'stock' ? (
              <p className="mt-6 border-t border-border-accent pt-4 text-xs leading-relaxed text-text-dim">
                {text(
                  type === 'crypto'
                    ? 'Crypto assets have supply and market metrics; company income statements do not apply.'
                    : type === 'etf'
                      ? 'Fund holdings and expense ratios are not supplied by this data source.'
                      : 'Company financial statements do not apply to this asset type.',
                )}
              </p>
            ) : (
              <div className="mt-6 border-t border-border-accent pt-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-base font-medium">{text('Company financials')}</h2>
                  {fundamentals.data?.source && (
                    <a
                      href={fundamentals.data.source}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-text-dim hover:text-text-main"
                    >
                      SEC EDGAR
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
                {fundamentals.isPending ? (
                  <p className="py-8 text-sm text-text-dim">{text('Loading issuer filings…')}</p>
                ) : !annual && !balance ? (
                  <div className="py-6">
                    <p className="text-sm text-text-dim">
                      {text(
                        fundamentals.data?.reason === 'issuer-not-found'
                          ? 'No matching SEC issuer was found for this symbol.'
                          : fundamentals.data?.reason === 'unsupported-taxonomy'
                            ? 'This issuer has no supported US-GAAP statements in USD.'
                            : 'Financial filings are temporarily unavailable.',
                      )}
                    </p>
                    <button
                      type="button"
                      onClick={() => void fundamentals.refetch()}
                      className="mt-3 text-xs text-accent"
                    >
                      {text('Retry financials')}
                    </button>
                  </div>
                ) : (
                  <>
                    {annual && (
                      <>
                        <p className="mt-2 text-xs text-text-dim">
                          {text('Annual period ending')} {date(annual.periodEnd)} · USD
                        </p>
                        <dl className="mt-2 grid grid-cols-2 gap-x-8 sm:grid-cols-3 lg:grid-cols-4">
                          {metric(
                            'Annual revenue',
                            financial(annual.revenue),
                            financialTitle(annual.revenue),
                          )}
                          {metric(
                            'Annual net income',
                            financial(annual.netIncome),
                            financialTitle(annual.netIncome),
                          )}
                          {metric(
                            'Diluted EPS (annual)',
                            financial(annual.dilutedEps, false),
                            financialTitle(annual.dilutedEps),
                          )}
                          {metric('Net margin (annual)', percent(annual.netMargin))}
                          {metric('Revenue growth (annual)', percent(annual.revenueGrowth))}
                          {metric(
                            'Operating cash flow (annual)',
                            financial(annual.operatingCashFlow),
                            financialTitle(annual.operatingCashFlow),
                          )}
                        </dl>
                      </>
                    )}
                    {balance && (
                      <>
                        <h3 className="mt-5 text-sm font-medium">
                          {text('Balance sheet')}{' '}
                          <span className="ml-2 text-xs font-normal text-text-dim">
                            {date(balance.periodEnd)}
                          </span>
                        </h3>
                        <dl className="mt-2 grid grid-cols-2 gap-x-8 sm:grid-cols-3 lg:grid-cols-4">
                          {metric(
                            'Total assets',
                            financial(balance.assets),
                            financialTitle(balance.assets),
                          )}
                          {metric(
                            'Total liabilities',
                            financial(balance.liabilities),
                            financialTitle(balance.liabilities),
                          )}
                          {metric(
                            'Shareholders equity',
                            financial(balance.equity),
                            financialTitle(balance.equity),
                          )}
                          {metric(
                            'Cash and equivalents',
                            financial(balance.cash),
                            financialTitle(balance.cash),
                          )}
                          {metric(
                            'Current assets',
                            financial(balance.currentAssets),
                            financialTitle(balance.currentAssets),
                          )}
                          {metric(
                            'Current liabilities',
                            financial(balance.currentLiabilities),
                            financialTitle(balance.currentLiabilities),
                          )}
                          {metric('Current ratio', format(balance.currentRatio))}
                        </dl>
                      </>
                    )}
                    {(fundamentals.data?.annual.length || 0) > 1 && (
                      <div className="mt-5 overflow-x-auto">
                        <table className="w-full min-w-[560px] text-xs">
                          <thead className="text-text-dim">
                            <tr>
                              {[
                                'Period ending',
                                'Revenue',
                                'Net income',
                                'Diluted EPS',
                                'Net margin',
                                'Filing',
                              ].map((label) => (
                                <th
                                  key={label}
                                  className={`pb-3 font-normal ${label === 'Period ending' ? 'text-left' : 'text-right'}`}
                                >
                                  {text(label)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {fundamentals.data?.annual.map((year) => {
                              const filing = year.revenue || year.netIncome || year.dilutedEps;
                              return (
                                <tr key={year.periodEnd} className="border-t border-border-accent">
                                  <td className="py-3">{date(year.periodEnd)}</td>
                                  <td
                                    className="py-3 text-right tabular-nums"
                                    title={financialTitle(year.revenue)}
                                  >
                                    {financial(year.revenue)}
                                  </td>
                                  <td
                                    className="py-3 text-right tabular-nums"
                                    title={financialTitle(year.netIncome)}
                                  >
                                    {financial(year.netIncome)}
                                  </td>
                                  <td className="py-3 text-right tabular-nums">
                                    {financial(year.dilutedEps, false)}
                                  </td>
                                  <td className="py-3 text-right tabular-nums">
                                    {percent(year.netMargin)}
                                  </td>
                                  <td className="py-3 text-right">
                                    {filing && (
                                      <a
                                        href={`https://www.sec.gov/Archives/edgar/data/${Number(fundamentals.data!.cik)}/${filing.accession.replace(/-/g, '')}/`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-text-dim hover:text-text-main"
                                      >
                                        {filing.form}
                                        <ExternalLink size={11} />
                                      </a>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                    <p className="mt-5 text-[11px] leading-relaxed text-text-dim">
                      SEC EDGAR · {text('Retrieved')} {date(fundamentals.data?.fetchedAt)}
                      {fundamentals.data?.stale && ` · ${text('stale')}`}
                      <br />
                      {text(
                        'Annual figures and the latest balance sheet may cover different periods. Missing values are not estimated. P/E and forward estimates are not supplied.',
                      )}
                    </p>
                  </>
                )}
              </div>
            )}
          </>
        )}
        {tab === 'news' && (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-medium">
                {text('News about')} {companyName}
              </h2>
              <button
                type="button"
                onClick={() => void news.refetch()}
                disabled={news.isFetching}
                className="flex items-center gap-2 text-xs text-text-dim disabled:opacity-50"
              >
                <RefreshCw size={13} className={news.isFetching ? 'animate-spin' : ''} />
                {text('Refresh news')}
              </button>
            </div>
            {news.isPending ? (
              <p className="py-8 text-sm text-text-dim">{text('Loading asset news…')}</p>
            ) : !recentNews.length ? (
              <p className="py-8 text-sm text-text-dim">
                {text('No asset headlines are available right now.')}
              </p>
            ) : (
              <div className="grid gap-x-8 md:grid-cols-2">
                {recentNews.map((article, index) => (
                  <a
                    key={`${article.url}:${index}`}
                    href={article.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group border-t border-border-accent py-4"
                  >
                    <p className="mb-2 text-[11px] text-text-dim">
                      {article.source.name} · {date(article.publishedAt)}
                    </p>
                    <h3 className="text-sm font-medium leading-relaxed group-hover:text-accent">
                      {article.title}
                      <ExternalLink size={11} className="ml-1 inline" />
                    </h3>
                    {article.description && (
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-dim">
                        {article.description}
                      </p>
                    )}
                  </a>
                ))}
              </div>
            )}
            {news.data?.source && (
              <p className="mt-4 text-[11px] text-text-dim">
                {news.data.source}
                {news.data.stale && ` · ${text('stale')}`} ·{' '}
                {text('Headlines are retrieved for the selected asset query.')}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
