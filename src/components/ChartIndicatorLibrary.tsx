import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Search, Settings2, X } from 'lucide-react';
import {
  chartIndicators,
  type IndicatorId,
  type IndicatorSettings,
} from '../../shared/chartIndicators';
import { useLanguage } from '../contexts/LanguageContext';
import { I18n, UiText } from './Localized';

export type ActiveIndicators = Partial<Record<IndicatorId, IndicatorSettings>>;
const descriptions: Record<IndicatorId, string> = {
  sma: 'Simple moving average',
  ema: 'Exponential moving average',
  sma50: '50-period moving average',
  sma200: '200-period moving average',
  bb: 'Volatility bands',
  vwap: 'Volume-weighted session price',
  rsi: 'Relative strength index',
  macd: 'Momentum and signal line',
  stochastic: 'Stochastic oscillator',
  atr: 'Average true range',
  adx: 'Trend strength and direction',
  obv: 'Cumulative volume flow',
  ichimoku: 'Trend, momentum and cloud',
};
export default function ChartIndicatorLibrary({
  active,
  onChange,
  intraday,
  hasVolume,
  open,
  onClose,
  initialIndicator,
}: {
  active: ActiveIndicators;
  onChange: (next: ActiveIndicators) => void;
  intraday: boolean;
  hasVolume: boolean;
  open: boolean;
  onClose: () => void;
  initialIndicator?: IndicatorId;
}) {
  const { text } = useLanguage();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'active'>('all');
  const [settingsId, setSettingsId] = useState<IndicatorId | undefined>();
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    setSettingsId(initialIndicator);
    setSearch('');
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        closeRef.current();
      }
      if (event.key !== 'Tab') return;
      const nodes = [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [tabindex="0"]',
        ) || []),
      ];
      const first = nodes[0],
        last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('keydown', key, true);
      previous?.focus();
    };
  }, [open, initialIndicator]);
  const update = (id: IndicatorId, key: keyof IndicatorSettings, value: string) => {
    const current = active[id]!;
    let number = Number(value);
    if (!Number.isFinite(number)) return;
    number =
      key === 'multiplier'
        ? Math.min(10, Math.max(0.1, number))
        : Math.min(500, Math.max(1, Math.round(number)));
    if (id === 'macd' && key === 'fast') number = Math.min(number, current.slow - 1);
    if (id === 'macd' && key === 'slow') number = Math.max(number, current.fast + 1);
    onChange({ ...active, [id]: { ...current, [key]: number } });
  };
  if (!open) return null;
  return createPortal(
    <div
      className="chart-indicator-dialog fixed inset-0 z-[160] flex items-center justify-center bg-black/55 p-3"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={text('Indicators')}
        className="flex max-h-[min(720px,88dvh)] w-full max-w-[780px] flex-col overflow-hidden rounded-lg border border-border-accent bg-bg shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-border-accent px-5 py-4">
          <I18n.h2 className="text-lg font-semibold text-text-main">Indicators</I18n.h2>
          <I18n.button
            className="chart-control !p-2"
            aria-label="Close indicators"
            onClick={onClose}
          >
            <X size={18} />
          </I18n.button>
        </header>
        <div className="px-5 py-3">
          <label className="flex items-center gap-2 rounded border border-border-accent bg-surface px-3 py-2">
            <Search size={16} className="text-text-dim" />
            <I18n.input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search indicators"
              placeholder="Search indicators"
              className="w-full bg-transparent text-sm text-text-main outline-none"
            />
          </label>
        </div>
        <nav
          className="flex gap-5 border-b border-border-accent px-5"
          aria-label={text('Indicator categories')}
        >
          <I18n.button
            className={
              'pb-3 text-sm ' +
              (tab === 'all' ? 'border-b-2 border-accent text-text-main' : 'text-text-dim')
            }
            onClick={() => setTab('all')}
            aria-pressed={tab === 'all'}
          >
            Built-in
          </I18n.button>
          <I18n.button
            className={
              'pb-3 text-sm ' +
              (tab === 'active' ? 'border-b-2 border-accent text-text-main' : 'text-text-dim')
            }
            onClick={() => setTab('active')}
            aria-pressed={tab === 'active'}
          >
            On chart{' '}
            <span className="ml-1 text-xs text-text-dim">{Object.keys(active).length}</span>
          </I18n.button>
        </nav>
        <div className="grid min-h-0 grid-cols-1 overflow-y-auto px-2 py-2 sm:grid-cols-2">
          {chartIndicators
            .filter(
              (spec) =>
                (tab === 'all' || active[spec.id]) &&
                (spec.label + ' ' + text(descriptions[spec.id]))
                  .toLowerCase()
                  .includes(search.toLowerCase()),
            )
            .map((spec) => {
              const settings = active[spec.id];
              const disabled = (spec.volume && !hasVolume) || (spec.id === 'vwap' && !intraday);
              const fields: [keyof IndicatorSettings, string][] =
                spec.id === 'macd'
                  ? [
                      ['fast', 'Fast'],
                      ['slow', 'Slow'],
                      ['signal', 'Signal'],
                    ]
                  : spec.id === 'ichimoku'
                    ? [
                        ['fast', 'Conversion'],
                        ['slow', 'Base'],
                        ['period', 'Span B'],
                        ['signal', 'Displacement'],
                      ]
                    : ['vwap', 'obv'].includes(spec.id)
                      ? []
                      : [
                          ['period', 'Period'],
                          ...(spec.id === 'bb'
                            ? [['multiplier', 'Deviation'] as [keyof IndicatorSettings, string]]
                            : []),
                          ...(spec.id === 'stochastic'
                            ? [['signal', 'Signal'] as [keyof IndicatorSettings, string]]
                            : []),
                        ];
              return (
                <div key={spec.id} className="rounded px-3 py-2 hover:bg-surface">
                  <div className="flex items-center gap-3">
                    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-accent"
                        aria-label={spec.label}
                        checked={!!settings}
                        disabled={disabled && !settings}
                        onChange={() => {
                          const next = { ...active };
                          if (settings) {
                            delete next[spec.id];
                            if (settingsId === spec.id) setSettingsId(undefined);
                          } else next[spec.id] = { ...spec.defaults };
                          onChange(next);
                        }}
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-text-main">
                          <UiText>{spec.label}</UiText>
                        </span>
                        <span className="block text-xs text-text-dim">
                          <UiText>{descriptions[spec.id]}</UiText>
                        </span>
                      </span>
                    </label>
                    {settings && <Check size={15} className="text-accent" />}
                    {settings && (
                      <I18n.button
                        className={'chart-control !p-2 ' + (settingsId === spec.id ? 'active' : '')}
                        aria-label={'Settings ' + spec.label}
                        aria-expanded={settingsId === spec.id}
                        onClick={() => setSettingsId(settingsId === spec.id ? undefined : spec.id)}
                      >
                        <Settings2 size={15} />
                      </I18n.button>
                    )}
                  </div>
                  {disabled && (
                    <I18n.p className="ml-7 mt-1 text-[11px] text-text-dim">
                      {spec.id === 'vwap' && !intraday
                        ? 'VWAP requires hourly candles and reported volume.'
                        : 'The provider does not report volume.'}
                    </I18n.p>
                  )}
                  {settings && settingsId === spec.id && !disabled && (
                    <div className="ml-7 mt-3 flex flex-wrap gap-3 border-t border-border-accent pt-3">
                      {fields.map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2 text-xs text-text-dim">
                          <UiText>{label}</UiText>
                          <input
                            type="number"
                            className="w-16 rounded border border-border-accent bg-bg px-2 py-1 text-text-main"
                            aria-label={spec.label + ' ' + label}
                            min={key === 'multiplier' ? 0.1 : 1}
                            max={key === 'multiplier' ? 10 : 500}
                            step={key === 'multiplier' ? 0.1 : 1}
                            value={settings[key]}
                            onChange={(event) => update(spec.id, key, event.target.value)}
                          />
                        </label>
                      ))}
                      {!fields.length && (
                        <I18n.span className="text-xs text-text-dim">
                          This indicator uses the reported volume without a period setting.
                        </I18n.span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
        </div>
        <I18n.p className="border-t border-border-accent px-5 py-3 text-[11px] text-text-dim">
          Periods count candles in the selected interval. Indicators need enough history to
          initialize.
        </I18n.p>
      </div>
    </div>,
    document.body,
  );
}
