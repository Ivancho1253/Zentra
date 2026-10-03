import { useQuery } from '@tanstack/react-query';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  type UTCTimestamp,
} from 'lightweight-charts';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AssetType, HistoryRange, MarketHistory } from '../../shared/domain';
import { movingAverage } from '../../shared/indicators';
import { readJson } from '../lib/query';
const ranges: HistoryRange[] = ['1D', '5D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'MAX'];
export default function FinancialChart({
  symbol,
  type,
  fixture,
}: {
  symbol: string;
  type: AssetType;
  fixture?: MarketHistory;
}) {
  const [range, setRange] = useState<HistoryRange>('1M');
  const [mode, setMode] = useState<'candle' | 'line'>('candle');
  const [sma, setSma] = useState(false);
  const [hover, setHover] = useState('');
  const [light, setLight] = useState(document.documentElement.classList.contains('light'));
  const host = useRef<HTMLDivElement>(null);
  const query = useQuery({
    queryKey: ['history', type, symbol, range],
    queryFn: ({ signal }) =>
      readJson<MarketHistory>(
        `/api/market/history?symbol=${encodeURIComponent(symbol)}&type=${type}&range=${range}`,
        signal,
      ),
    enabled: !fixture,
    staleTime: 300_000,
  });
  const history = useMemo(
    () =>
      fixture ||
      (query.isError && query.data
        ? { ...query.data, stale: true, status: 'stale' as const }
        : query.data),
    [fixture, query.data, query.isError],
  );
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setLight(document.documentElement.classList.contains('light')),
    );
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!host.current || !history?.candles.length) return;
    const formatPrice = (value: number) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: history.currency,
        maximumFractionDigits: Math.abs(value) < 1 ? 8 : 2,
      }).format(value);
    const priceFormat = {
      type: 'custom' as const,
      minMove: 0.00000001,
      formatter: formatPrice,
    };
    const chart = createChart(host.current, {
      autoSize: true,
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: light ? '#ffffff' : '#101416' },
        textColor: light ? '#344047' : '#9ba8ad',
        attributionLogo: true,
      },
      grid: {
        vertLines: { color: light ? '#eef1f3' : '#1c2429' },
        horzLines: { color: light ? '#eef1f3' : '#1c2429' },
      },
      timeScale: { timeVisible: range === '1D' || range === '5D', secondsVisible: false },
      localization: { locale: 'en-US' },
    });
    const ordered = [...new Map(history.candles.map((c) => [c.timestamp, c])).values()].sort(
      (a, b) => a.timestamp - b.timestamp,
    );
    const time = (timestamp: number) => Math.floor(timestamp / 1000) as UTCTimestamp;
    const series =
      mode === 'candle'
        ? chart.addSeries(CandlestickSeries, {
            upColor: '#6adea7',
            downColor: '#ff727d',
            borderVisible: false,
            wickUpColor: '#6adea7',
            wickDownColor: '#ff727d',
            priceFormat,
          })
        : chart.addSeries(LineSeries, { color: '#6adea7', lineWidth: 2, priceFormat });
    if (mode === 'candle')
      series.setData(
        ordered.map((c) => ({
          time: time(c.timestamp),
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        })),
      );
    else series.setData(ordered.map((c) => ({ time: time(c.timestamp), value: c.close })));
    series.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.25 } });
    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: 'volume',
      priceFormat: {
        type: 'custom',
        minMove: 1,
        formatter: (value: number) =>
          new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
            value,
          ),
      },
    });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volume.setData(
      ordered
        .filter((c) => c.volume !== null)
        .map((c) => ({
          time: time(c.timestamp),
          value: c.volume!,
          color: c.close >= c.open ? '#6adea744' : '#ff727d44',
        })),
    );
    if (sma)
      chart
        .addSeries(LineSeries, { color: '#daa95e', lineWidth: 1, title: 'SMA 20', priceFormat })
        .setData(movingAverage(ordered).map((p) => ({ time: time(p.timestamp), value: p.value })));
    chart.subscribeCrosshairMove((param) => {
      const price = param.seriesData.get(series);
      if (!price) {
        setHover('');
        return;
      }
      const value = 'close' in price ? price.close : 'value' in price ? price.value : null;
      setHover(
        `${typeof param.time === 'number' ? new Date(param.time * 1000).toISOString().replace('T', ' ').slice(0, 16) : ''} UTC · ${value == null ? '' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 }).format(value)} ${history.currency}`,
      );
    });
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [history, mode, sma, range, light]);
  return (
    <section className="terminal-panel overflow-hidden" aria-label={`${symbol} financial chart`}>
      <div className="flex flex-wrap justify-between gap-3 border-b border-border-accent px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              disabled={!!fixture && r !== '1M'}
              aria-pressed={range === r}
              className={`chart-control ${range === r ? 'active' : ''}`}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            className={`chart-control ${mode === 'candle' ? 'active' : ''}`}
            onClick={() => setMode('candle')}
          >
            Candles
          </button>
          <button
            className={`chart-control ${mode === 'line' ? 'active' : ''}`}
            onClick={() => setMode('line')}
          >
            Line
          </button>
          <button
            className={`chart-control ${sma ? 'active' : ''}`}
            onClick={() => setSma(!sma)}
            aria-pressed={sma}
          >
            SMA 20
          </button>
        </div>
      </div>
      <div className="h-7 px-4 pt-2 font-mono text-[11px] text-text-dim" aria-live="polite">
        {hover || `${symbol} · ${history?.currency || '—'} · UTC`}
      </div>
      {history?.candles.length ? (
        <div ref={host} className="h-[360px] w-full" />
      ) : (
        <div
          className="flex h-[360px] items-center justify-center p-8 text-sm text-text-dim"
          role="status"
        >
          {query.isPending
            ? 'Loading provider candles…'
            : 'Historical data is unavailable for this asset. No synthetic chart is shown.'}
        </div>
      )}
      <footer className="flex flex-wrap justify-between gap-2 border-t border-border-accent px-4 py-3 text-[10px] text-text-dim">
        {!fixture && !query.isPending && (!history?.candles.length || query.isError) && (
          <button
            className="text-accent underline"
            disabled={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {query.isFetching ? 'Retrying history...' : 'Retry chart data'}
          </button>
        )}
        <span>
          {fixture ? 'DEMO DATA' : history?.stale ? 'Stale' : history?.status || 'Unavailable'} ·{' '}
          {history?.provider || 'Awaiting provider'} ·{' '}
          {history?.updatedAt ? new Date(history.updatedAt).toLocaleString() : 'No timestamp'}
        </span>
        <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">
          TradingView Lightweight Charts™
        </a>
      </footer>
    </section>
  );
}
