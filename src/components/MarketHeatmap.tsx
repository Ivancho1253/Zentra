import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { AssetQuote } from '../../shared/domain';
import { sp500Metadata } from '../../shared/catalog';
import { heatmapColor, observedChange, treemap } from '../../shared/treemap';
import { useLanguage } from '../contexts/LanguageContext';
import { I18n, UiText } from './Localized';

export default function MarketHeatmap({
  assets,
  kind,
}: {
  assets: AssetQuote[];
  kind: 'stock' | 'crypto';
}) {
  const { locale, text } = useLanguage();
  const navigate = useNavigate();
  const host = useRef<HTMLDivElement>(null);
  const moved = useRef(false);
  const drag = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
  const [size, setSize] = useState({ width: 1100, height: 620 });
  const [sector, setSector] = useState('all');
  const [weighting, setWeighting] = useState<'weight' | 'equal'>('weight');
  const [hovered, setHovered] = useState<AssetQuote | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const reset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  useEffect(() => {
    if (!host.current) return;
    const element = host.current;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [expanded]);
  useEffect(() => {
    setSector('all');
    setHovered(null);
    reset();
  }, [kind]);
  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded]);
  const sectors = [
    ...new Set(
      assets.map(
        (asset) => asset.sector || (kind === 'crypto' ? 'Digital assets' : 'Other stocks'),
      ),
    ),
  ];
  const visible = assets.filter(
    (asset) =>
      sector === 'all' ||
      (asset.sector || (kind === 'crypto' ? 'Digital assets' : 'Other stocks')) === sector,
  );
  const canWeight = visible.every((asset) =>
    kind === 'stock' ? Number(asset.indexWeight) > 0 : Number(asset.marketCap) > 0,
  );
  const weighted = weighting === 'weight' && canWeight;
  const valueOf = (asset: AssetQuote) =>
    !weighted
      ? 1
      : kind === 'stock'
        ? Math.max(asset.indexWeight || 0.06, 0.005)
        : Math.max(Number(asset.marketCap) || 1, 1);
  const groups = useMemo(() => {
    const grouped = new Map<string, AssetQuote[]>();
    for (const asset of visible) {
      const label = asset.sector || (kind === 'crypto' ? 'Digital assets' : 'Other stocks');
      grouped.set(label, [...(grouped.get(label) || []), asset]);
    }
    return treemap(
      [...grouped].map(([name, quotes]) => ({
        item: { name, quotes },
        value: quotes.reduce(
          (sum, quote) =>
            sum +
            (!weighted
              ? 1
              : kind === 'stock'
                ? Math.max(quote.indexWeight || 0.06, 0.005)
                : Math.max(Number(quote.marketCap) || 1, 1)),
          0,
        ),
      })),
      size.width,
      size.height,
    );
  }, [visible, kind, weighted, size]);
  const changes = visible.map(observedChange).filter((change): change is number => change !== null);
  const counts = {
    up: changes.filter((change) => change > 0).length,
    down: changes.filter((change) => change < 0).length,
    unknown: visible.length - changes.length,
  };
  const clampPan = (next: { x: number; y: number }, nextZoom: number) => ({
    x: Math.max(size.width * (1 - nextZoom), Math.min(0, next.x)),
    y: Math.max(size.height * (1 - nextZoom), Math.min(0, next.y)),
  });
  const zoomTo = (requested: number, x = size.width / 2, y = size.height / 2) => {
    const next = Math.max(1, Math.min(5, requested));
    setPan(
      clampPan({ x: x - ((x - pan.x) * next) / zoom, y: y - ((y - pan.y) * next) / zoom }, next),
    );
    setZoom(next);
  };
  return (
    <I18n.section
      className={`market-map panel-card overflow-hidden !p-0 ${expanded ? 'market-map-expanded' : ''}`}
      aria-label="Market heat map"
    >
      <I18n.div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-accent px-4 py-3">
        <I18n.div className="flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-accent" />
          <I18n.h2 className="font-bold">Sector heat map</I18n.h2>
          <span className="font-mono text-xs text-text-dim">{visible.length}</span>
        </I18n.div>
        <I18n.div className="flex flex-wrap items-center gap-2">
          <I18n.select
            aria-label="Heat map sector"
            value={sector}
            onChange={(event) => {
              setSector(event.target.value);
              reset();
            }}
            className="terminal-input !w-auto !py-2 !text-xs"
          >
            <I18n.option value="all">All sectors</I18n.option>
            {sectors.map((item) => (
              <I18n.option key={item} value={item}>
                {item}
              </I18n.option>
            ))}
          </I18n.select>
          <I18n.select
            aria-label="Heat map sizing"
            value={weighted ? 'weight' : 'equal'}
            onChange={(event) => {
              setWeighting(event.target.value as 'weight' | 'equal');
              reset();
            }}
            className="terminal-input !w-auto !py-2 !text-xs"
          >
            <I18n.option value="weight" disabled={!canWeight}>
              {kind === 'stock' ? 'Index weight' : 'Market cap'}
            </I18n.option>
            <I18n.option value="equal">Equal size</I18n.option>
          </I18n.select>
          <I18n.button
            aria-label="Zoom out"
            className="icon-button"
            onClick={() => zoomTo(zoom / 1.3)}
            disabled={zoom === 1}
          >
            <Minus size={15} />
          </I18n.button>
          <I18n.button
            aria-label="Zoom in"
            className="icon-button"
            onClick={() => zoomTo(zoom * 1.3)}
          >
            <Plus size={15} />
          </I18n.button>
          <I18n.button aria-label="Reset view" className="icon-button" onClick={reset}>
            <RotateCcw size={15} />
          </I18n.button>
          <I18n.button
            aria-label={expanded ? 'Close expanded map' : 'Expand heat map'}
            className="icon-button"
            onClick={() => {
              setExpanded(!expanded);
              reset();
            }}
          >
            {expanded ? <X size={15} /> : <Maximize2 size={15} />}
          </I18n.button>
        </I18n.div>
      </I18n.div>
      <I18n.div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-[11px] text-text-dim">
        <div className="flex gap-4">
          <span className="text-accent">
            ↑ {counts.up} <UiText>Advancing</UiText>
          </span>
          <span className="text-loss">
            ↓ {counts.down} <UiText>Declining</UiText>
          </span>
          <span>
            {counts.unknown} <UiText>Without a current move</UiText>
          </span>
        </div>
        <I18n.span>Color: daily change</I18n.span>
      </I18n.div>
      <div
        ref={host}
        className="market-map-viewport relative overflow-hidden touch-none select-none"
        style={{ touchAction: zoom > 1 ? 'none' : 'pan-y' }}
        onWheel={(event) => {
          if (!event.ctrlKey && !event.metaKey) return;
          event.preventDefault();
          const box = event.currentTarget.getBoundingClientRect();
          zoomTo(
            zoom * (event.deltaY < 0 ? 1.15 : 1 / 1.15),
            event.clientX - box.left,
            event.clientY - box.top,
          );
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          moved.current = false;
          drag.current = { x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const dx = event.clientX - drag.current.x,
            dy = event.clientY - drag.current.y;
          if (Math.abs(dx) + Math.abs(dy) > 5) {
            moved.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            setPan(clampPan({ x: drag.current.panX + dx, y: drag.current.panY + dy }, zoom));
          }
        }}
        onPointerUp={(event) => {
          drag.current = null;
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {!visible.length && (
          <I18n.p className="p-8 text-sm text-text-dim">No assets match these filters.</I18n.p>
        )}
        <div
          style={{
            width: size.width,
            height: size.height,
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
          }}
        >
          {groups.map((group) => {
            const padding = 3,
              header = group.height > 50 ? 23 : 0;
            const tiles = treemap(
              group.item.quotes.map((asset) => ({ item: asset, value: valueOf(asset) })),
              Math.max(1, group.width - padding * 2),
              Math.max(1, group.height - header - padding * 2),
            );
            return (
              <div
                key={group.item.name}
                className="absolute overflow-hidden rounded-sm bg-bg/80"
                style={{ left: group.x, top: group.y, width: group.width, height: group.height }}
              >
                {header > 0 && (
                  <button
                    className="flex w-full items-center justify-between truncate px-2 text-[10px] font-semibold tracking-wide text-text-dim hover:text-accent"
                    style={{ height: header }}
                    onClick={() => {
                      setSector(group.item.name);
                      reset();
                    }}
                  >
                    <span className="truncate">{text(group.item.name)}</span>
                    <span className="ml-2 shrink-0 opacity-55">{group.item.quotes.length}</span>
                  </button>
                )}
                {tiles.map((tile) => {
                  const asset = tile.item,
                    change = observedChange(asset);
                  const move =
                    change === null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
                  const readable = tile.width * zoom > 30 && tile.height * zoom > 22;
                  const roomy = tile.width * zoom > 70 && tile.height * zoom > 50;
                  return (
                    <button
                      key={asset.symbol}
                      className="heat-tile absolute flex flex-col items-center justify-center overflow-hidden border border-bg/80 text-white transition-[filter] hover:z-10 hover:brightness-125 focus:z-10 focus:outline focus:outline-2 focus:outline-white"
                      style={{
                        left: tile.x + padding,
                        top: tile.y + header + padding,
                        width: Math.max(1, tile.width - 1),
                        height: Math.max(1, tile.height - 1),
                        background: heatmapColor(change),
                      }}
                      aria-label={`${asset.symbol} ${move}`}
                      title={`${asset.name} · ${move}`}
                      onMouseEnter={() => setHovered(asset)}
                      onFocus={() => setHovered(asset)}
                      onMouseLeave={() => setHovered(null)}
                      onClick={() => {
                        if (moved.current) {
                          moved.current = false;
                          return;
                        }
                        navigate(`/charts?symbol=${encodeURIComponent(asset.symbol)}&type=${kind}`);
                      }}
                    >
                      {readable && (
                        <span
                          className="font-semibold leading-tight tracking-tight"
                          style={{
                            fontSize: Math.max(
                              7,
                              Math.min(25, Math.min(tile.width / 4.8, tile.height / 3)),
                            ),
                          }}
                        >
                          {asset.symbol}
                        </span>
                      )}
                      {roomy && (
                        <span
                          className="mt-0.5 font-mono opacity-85"
                          style={{ fontSize: Math.max(7, Math.min(14, tile.width / 9)) }}
                        >
                          {move}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        {hovered && (
          <div className="pointer-events-none absolute bottom-4 left-4 z-20 max-w-[280px] rounded-xl border border-border-accent bg-surface/95 p-4 shadow-xl backdrop-blur">
            <div className="flex justify-between gap-6">
              <span className="text-lg font-bold">{hovered.symbol}</span>
              <ArrowUpRight size={16} className="text-accent" />
            </div>
            <p className="mt-1 text-xs text-text-dim">{hovered.name}</p>
            <div className="mt-3 flex justify-between gap-6 font-mono text-sm">
              <span>
                {hovered.price
                  ? new Intl.NumberFormat(locale, {
                      style: 'currency',
                      currency: hovered.currency,
                      maximumFractionDigits: Number(hovered.price) < 1 ? 6 : 2,
                    }).format(Number(hovered.price))
                  : '—'}
              </span>
              <span style={{ color: (observedChange(hovered) || 0) < 0 ? '#ff8e99' : '#79e3b2' }}>
                {observedChange(hovered) === null
                  ? '—'
                  : `${Number(hovered.change) >= 0 ? '+' : ''}${Number(hovered.change).toFixed(2)}%`}
              </span>
            </div>
            <p className="mt-2 text-[10px] text-text-dim">
              {hovered.provider} · {text(hovered.status)}
            </p>
            {hovered.updatedAt && (
              <p className="mt-1 text-[10px] text-text-dim">
                {new Date(hovered.updatedAt).toLocaleString(locale)}
              </p>
            )}
          </div>
        )}
      </div>
      <I18n.footer className="flex flex-wrap justify-between gap-3 border-t border-border-accent px-4 py-3 text-[10px] text-text-dim">
        <div className="flex items-center gap-1">
          {[-3, -2, -1, 0, 1, 2, 3].map((value) => (
            <span
              key={value}
              className="rounded-sm px-2 py-1 font-mono text-white/85"
              style={{ background: heatmapColor(value) }}
            >
              {value > 0 ? '+' : ''}
              {value}%
            </span>
          ))}
          <I18n.span className="ml-2">Gray: unavailable</I18n.span>
        </div>
        <I18n.span>
          {kind === 'stock' && weighted ? (
            <>
              <UiText>Fund weights</UiText> · {sp500Metadata.asOf}
            </>
          ) : (
            'Click a tile to open its chart'
          )}
        </I18n.span>
      </I18n.footer>
    </I18n.section>
  );
}
