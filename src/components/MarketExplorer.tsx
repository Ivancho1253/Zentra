import { I18n, UiText } from './Localized';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AssetQuote } from '../../shared/domain';
import { savedFavoriteQuote, useFavorites } from '../lib/favorites';
import { cn } from '../lib/utils';
import CompanyLogo from './CompanyLogo';
import MarketAssetCard from './MarketAssetCard';
import { readJson } from '../lib/query';

interface MarketAsset {
  id?: string;
  symbol?: string;
  name?: string;
  currency?: string;
  exchange?: string;
  type?: string;
  price?: string | number | null;
  change?: string | number | null;
  marketCap?: string | number | null;
  raw?: Partial<AssetQuote> & { id?: string };
}

interface HeatMapRect {
  asset: MarketAsset;
  x: number;
  y: number;
  width: number;
  height: number;
  value: number;
}

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/[%,$\s]/g, '');
  if (!cleaned || cleaned.toLowerCase() === 'nan') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
};

const splitTreemap = (
  items: Array<{ asset: MarketAsset; value: number }>,
  x: number,
  y: number,
  width: number,
  height: number,
  _depth = 0,
): HeatMapRect[] => {
  const total = items.reduce((sum, item) => sum + Math.max(item.value, 0), 0);
  if (items.length === 0 || total <= 0 || width <= 0 || height <= 0) return [];

  const scaledItems = items.map((item) => ({
    ...item,
    area: (Math.max(item.value, 0) / total) * width * height,
  }));
  const rects: HeatMapRect[] = [];

  const worstRatio = (row: typeof scaledItems, side: number) => {
    if (row.length === 0 || side <= 0) return Number.POSITIVE_INFINITY;
    const areas = row.map((item) => item.area);
    const sum = areas.reduce((totalArea, area) => totalArea + area, 0);
    const max = Math.max(...areas);
    const min = Math.min(...areas);
    return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
  };

  const layoutRow = (
    row: typeof scaledItems,
    rect: { x: number; y: number; width: number; height: number },
  ) => {
    const rowArea = row.reduce((sum, item) => sum + item.area, 0);
    if (rect.width >= rect.height) {
      const rowHeight = rowArea / rect.width;
      let cursorX = rect.x;
      row.forEach((item) => {
        const itemWidth = item.area / rowHeight;
        rects.push({
          asset: item.asset,
          value: item.value,
          x: cursorX,
          y: rect.y,
          width: itemWidth,
          height: rowHeight,
        });
        cursorX += itemWidth;
      });
      rect.y += rowHeight;
      rect.height -= rowHeight;
    } else {
      const rowWidth = rowArea / rect.height;
      let cursorY = rect.y;
      row.forEach((item) => {
        const itemHeight = item.area / rowWidth;
        rects.push({
          asset: item.asset,
          value: item.value,
          x: rect.x,
          y: cursorY,
          width: rowWidth,
          height: itemHeight,
        });
        cursorY += itemHeight;
      });
      rect.x += rowWidth;
      rect.width -= rowWidth;
    }
  };

  const remaining = [...scaledItems];
  const rect = { x, y, width, height };
  let row: typeof scaledItems = [];

  while (remaining.length > 0) {
    const next = remaining[0];
    const side = Math.min(rect.width, rect.height);
    if (row.length === 0 || worstRatio([...row, next], side) <= worstRatio(row, side)) {
      row.push(next);
      remaining.shift();
    } else {
      layoutRow(row, rect);
      row = [];
    }
  }

  if (row.length > 0) layoutRow(row, rect);
  return rects;
};

const heatColor = (change: number | null) => {
  if (change === null) return 'rgb(58, 58, 58)';
  const intensity = Math.min(Math.abs(change) / 6, 1);
  if (change >= 0) {
    const green = Math.round(62 + intensity * 86);
    return `rgb(${Math.round(9 + intensity * 2)}, ${green}, ${Math.round(31 + intensity * 12)})`;
  }

  const red = Math.round(100 + intensity * 105);
  return `rgb(${red}, ${Math.round(24 + intensity * 16)}, ${Math.round(35 + intensity * 18)})`;
};

const DEFAULT_HEAT_ZOOM = 0.72;

export default function MarketExplorer() {
  const navigate = useNavigate();
  const heatMapRef = useRef<HTMLDivElement>(null);
  const heatViewportRef = useRef<HTMLDivElement>(null);
  const dragMovedRef = useRef(false);
  const stockQuery = useQuery({
    queryKey: ['market', 'stocks'],
    queryFn: ({ signal }) =>
      readJson<{ data: AssetQuote[]; source: string }>('/api/market/stocks', signal),
    refetchInterval: 60_000,
  });
  const cryptoQuery = useQuery({
    queryKey: ['market', 'cryptos'],
    queryFn: ({ signal }) =>
      readJson<{ data: AssetQuote[]; source: string }>('/api/market/cryptos', signal),
    refetchInterval: 60_000,
  });
  const normalize = (item: AssetQuote, stale = false): MarketAsset => ({
    ...item,
    exchange: item.exchange || undefined,
    raw: stale ? { ...item, stale: true, status: 'stale' } : item,
  });
  const stocks = (stockQuery.data?.data || []).map((item) => normalize(item, stockQuery.isError));
  const cryptos = (cryptoQuery.data?.data || []).map((item) =>
    normalize(item, cryptoQuery.isError),
  );
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'stocks' | 'cryptos' | 'heatmap' | 'favorites'>(
    'stocks',
  );
  const [heatMapType, setHeatMapType] = useState<'stocks' | 'cryptos'>('stocks');
  const [heatWeight, setHeatWeight] = useState<'moves' | 'market-cap'>('moves');
  const fitZoom = useRef(DEFAULT_HEAT_ZOOM);
  const [heatZoom, setHeatZoom] = useState(DEFAULT_HEAT_ZOOM);
  const [heatPan, setHeatPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [isHeatMapFullscreen, setIsHeatMapFullscreen] = useState(false);
  const favorites = useFavorites();
  const [error, setError] = useState('');
  const selectedQuery =
    activeTab === 'cryptos' || (activeTab === 'heatmap' && heatMapType === 'cryptos')
      ? cryptoQuery
      : stockQuery;
  const loading = activeTab === 'favorites' ? favorites.loading : selectedQuery.isPending;
  const dataSource =
    selectedQuery.data?.source || (selectedQuery.isError ? 'Unavailable' : 'Loading');
  useEffect(() => {
    setPage(1);
  }, [activeTab, search]);

  useEffect(() => {
    if (activeTab !== 'heatmap' || !heatMapRef.current) return;
    const resize = () => {
      fitZoom.current = Math.max(
        0.1,
        Math.min((heatMapRef.current!.clientWidth - 16) / 1600, 0.72),
      );
      setHeatZoom(fitZoom.current);
      setHeatPan({ x: 0, y: 0 });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(heatMapRef.current);
    resize();
    return () => observer.disconnect();
  }, [activeTab, loading]);

  useEffect(() => {
    const viewport = heatViewportRef.current;
    if (activeTab !== 'heatmap' || !viewport) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      setHeatZoom((zoom) => Math.min(3.5, Math.max(0.1, zoom + (event.deltaY > 0 ? -0.12 : 0.12))));
    };
    viewport.addEventListener('wheel', wheel, { passive: false });
    return () => viewport.removeEventListener('wheel', wheel);
  }, [activeTab, loading]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsHeatMapFullscreen(document.fullscreenElement === heatMapRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const getAssetsToDisplay = () => {
    const allAssets = [...stocks, ...cryptos];
    if (activeTab === 'favorites')
      return [
        ...new Map(
          favorites.data.map((favorite) => {
            const asset =
              allAssets.find(
                (item) => item.symbol === favorite.symbol && item.type === favorite.type,
              ) || normalize(savedFavoriteQuote(favorite));
            return [`${favorite.type}:${favorite.symbol}`, asset] as const;
          }),
        ).values(),
      ];
    if (activeTab === 'stocks') return stocks;
    if (activeTab === 'cryptos') return cryptos;
    return heatMapType === 'stocks' ? stocks : cryptos;
  };

  const filteredAssets = getAssetsToDisplay().filter(
    (asset) =>
      (asset.symbol?.toLowerCase() || '').includes(search.toLowerCase()) ||
      (asset.name?.toLowerCase() || '').includes(search.toLowerCase()),
  );

  const motionItem = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } };
  const heatAssets = (heatMapType === 'stocks' ? stocks : cryptos).filter((asset) => asset.symbol);
  const heatItems = heatAssets
    .flatMap((asset) => {
      if (asset.raw?.stale) return [];
      if (heatWeight === 'moves')
        return toNumber(asset.price) && toNumber(asset.change) !== null && !asset.raw?.stale
          ? [{ asset, value: 1 }]
          : [];
      const marketCap = toNumber(asset.marketCap);
      return marketCap && marketCap > 0 ? [{ asset, value: marketCap }] : [];
    })
    .sort((a, b) => b.value - a.value);
  const heatMapWidth = 1600;
  const heatMapHeight = 900;
  const heatRects = splitTreemap(heatItems, 0, 0, heatMapWidth, heatMapHeight);
  const resetHeatMap = () => {
    setHeatZoom(fitZoom.current);
    setHeatPan({ x: 0, y: 0 });
  };
  const zoomHeatMap = (nextZoom: number) => {
    setHeatZoom(Math.min(Math.max(nextZoom, 0.1), 3.5));
  };
  const toggleHeatMapFullscreen = async () => {
    if (!heatMapRef.current) return;

    try {
      if (document.fullscreenElement === heatMapRef.current) {
        await document.exitFullscreen();
        return;
      }

      await heatMapRef.current.requestFullscreen();
    } catch {
      setError('Full screen is unavailable in this browser. Zoom and drag remain available.');
    }
  };
  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    dragMovedRef.current = false;
    setDragStart({ x: event.clientX, y: event.clientY, panX: heatPan.x, panY: heatPan.y });
  };
  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    const deltaX = event.clientX - dragStart.x;
    const deltaY = event.clientY - dragStart.y;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
      dragMovedRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (!dragMovedRef.current) return;
    setHeatPan({
      x: dragStart.panX + deltaX,
      y: dragStart.panY + deltaY,
    });
  };
  const handleDragEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragStart(null);
  };
  const shouldBlockTileClick = () => {
    if (!dragMovedRef.current) return false;
    window.setTimeout(() => {
      dragMovedRef.current = false;
    }, 0);
    return true;
  };

  return (
    <motion.div
      className="app-page"
      initial="hidden"
      animate="show"
      transition={{ staggerChildren: 0.06 }}
    >
      <motion.section variants={motionItem} className="app-hero">
        <I18n.div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <I18n.div className="flex items-start gap-4">
            <I18n.button
              aria-label="Back"
              onClick={() => navigate(-1)}
              className="rounded-2xl border border-border-accent bg-bg/50 p-3 transition-all hover:border-accent hover:text-accent"
            >
              <ArrowLeft className="h-5 w-5" />
            </I18n.button>
            <I18n.div>
              <I18n.div className="accent-chip mb-4">
                <Sparkles className="h-3.5 w-3.5" /> Markets
              </I18n.div>
              <I18n.h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
                Asset discovery
              </I18n.h1>
              <I18n.p className="mt-3 max-w-2xl text-sm text-text-dim">
                Stocks, crypto and favorites with asset logos, quick filters and a visual view of
                market moves.
              </I18n.p>
            </I18n.div>
          </I18n.div>
          <I18n.div className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-dim" />
            <I18n.input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search symbol or company"
              className="w-full rounded-2xl border border-border-accent bg-bg/65 py-4 pl-12 pr-4 text-sm font-bold outline-none transition-all focus:border-accent focus:shadow-[0_0_32px_rgba(124,255,26,0.12)]"
            />
          </I18n.div>
        </I18n.div>
        <I18n.div className="absolute bottom-0 left-0 h-px w-full scanline" />
      </motion.section>

      {(error || favorites.error || selectedQuery.isError) && (
        <motion.div
          variants={motionItem}
          className="flex items-center gap-3 rounded-2xl border border-loss/40 bg-loss/10 px-4 py-3 text-xs font-bold text-loss"
        >
          <AlertCircle className="h-4 w-4" />
          <UiText>
            {error ||
              favorites.error ||
              'Could not refresh this market. Other market categories remain available.'}
          </UiText>
          {selectedQuery.isError && (
            <I18n.button onClick={() => void selectedQuery.refetch()} className="ml-2 underline">
              Retry
            </I18n.button>
          )}
        </motion.div>
      )}

      <motion.div
        variants={motionItem}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <I18n.div className="flex gap-2 overflow-x-auto pb-1">
          {(['stocks', 'cryptos', 'heatmap', 'favorites'] as const).map((tab) => (
            <I18n.button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'whitespace-nowrap rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-widest transition-all',
                activeTab === tab
                  ? 'bg-accent text-bg shadow-[0_0_24px_rgba(124,255,26,0.24)]'
                  : 'border border-border-accent bg-surface text-text-dim hover:border-accent/40 hover:text-text-main',
              )}
            >
              {tab === 'cryptos' ? 'Crypto' : tab === 'heatmap' ? 'Heat Map' : tab}
            </I18n.button>
          ))}
        </I18n.div>
        <I18n.div className="flex flex-wrap gap-2">
          <I18n.div className="quiet-chip">{filteredAssets.length} visible assets</I18n.div>
          <I18n.div className="quiet-chip">
            Source: {dataSource} · Provider timestamps on each asset
          </I18n.div>
        </I18n.div>
      </motion.div>

      {loading ? (
        <I18n.div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, index) => (
            <I18n.div
              key={index}
              className="h-72 animate-pulse rounded-3xl border border-border-accent bg-surface"
            />
          ))}
        </I18n.div>
      ) : activeTab === 'heatmap' ? (
        <motion.div
          ref={heatMapRef}
          variants={motionItem}
          className="panel-card overflow-hidden p-0 fullscreen:rounded-none fullscreen:border-0 fullscreen:bg-bg"
        >
          <I18n.div className="flex flex-col gap-3 border-b border-border-accent bg-bg/55 p-3 md:flex-row md:items-center md:justify-between">
            <I18n.div className="flex items-center gap-2">
              <I18n.div className="accent-chip">Heat Map</I18n.div>
              <I18n.span className="hidden text-[10px] font-black uppercase tracking-widest text-text-dim sm:inline">
                {heatWeight === 'moves'
                  ? 'Daily changes · equal-sized tiles'
                  : 'Known market caps · proportional tiles'}
              </I18n.span>
            </I18n.div>
            <I18n.div className="flex flex-wrap items-center gap-2">
              <I18n.select
                aria-label="Heat map weighting"
                className="terminal-input"
                value={heatWeight}
                onChange={(event) => setHeatWeight(event.target.value as 'moves' | 'market-cap')}
              >
                <I18n.option value="moves">Daily moves</I18n.option>
                <I18n.option value="market-cap">Market cap</I18n.option>
              </I18n.select>
              {(['stocks', 'cryptos'] as const).map((type) => (
                <I18n.button
                  key={type}
                  onClick={() => {
                    setHeatMapType(type);
                    resetHeatMap();
                  }}
                  className={cn(
                    'rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all',
                    heatMapType === type
                      ? 'bg-accent text-bg'
                      : 'border border-border-accent bg-surface text-text-dim hover:border-accent/40 hover:text-text-main',
                  )}
                >
                  {type === 'stocks' ? 'Stocks' : 'Crypto'}
                </I18n.button>
              ))}
              <I18n.div className="ml-0 flex items-center overflow-hidden rounded-xl border border-border-accent bg-surface md:ml-2">
                <I18n.button
                  onClick={() => zoomHeatMap(heatZoom - 0.2)}
                  className="p-2 text-text-dim transition-all hover:bg-accent/10 hover:text-accent"
                  title="Zoom out"
                >
                  <Minus className="h-4 w-4" />
                </I18n.button>
                <I18n.button
                  onClick={() => zoomHeatMap(heatZoom + 0.2)}
                  className="border-l border-border-accent p-2 text-text-dim transition-all hover:bg-accent/10 hover:text-accent"
                  title="Zoom in"
                >
                  <Plus className="h-4 w-4" />
                </I18n.button>
                <I18n.button
                  onClick={resetHeatMap}
                  className="border-l border-border-accent px-3 py-2 text-[10px] font-black uppercase tracking-widest text-text-dim transition-all hover:bg-accent/10 hover:text-accent"
                  title="Reset view"
                >
                  Reset
                </I18n.button>
                <I18n.button
                  onClick={toggleHeatMapFullscreen}
                  className="border-l border-border-accent p-2 text-text-dim transition-all hover:bg-accent/10 hover:text-accent"
                  title={isHeatMapFullscreen ? 'Exit full screen' : 'Full screen'}
                >
                  {isHeatMapFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </I18n.button>
              </I18n.div>
            </I18n.div>
          </I18n.div>

          <I18n.div
            ref={heatViewportRef}
            className="relative h-[72vh] min-h-[560px] cursor-grab touch-none select-none overflow-hidden bg-[#050705] active:cursor-grabbing fullscreen:h-[calc(100vh-57px)] fullscreen:min-h-0"
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          >
            {!heatRects.length && (
              <I18n.p className="relative z-10 p-6 text-sm text-text-dim" role="status">
                {heatWeight === 'market-cap'
                  ? 'Market caps are unavailable from these providers. Choose Daily moves to view observed changes.'
                  : 'No observed daily changes are available for this category.'}
              </I18n.p>
            )}
            <I18n.div
              className={cn(
                'absolute left-1/2 top-1/2 origin-center',
                dragStart ? '' : 'transition-transform duration-100',
              )}
              style={{
                width: heatMapWidth,
                height: heatMapHeight,
                transform: `translate(calc(-50% + ${heatPan.x}px), calc(-50% + ${heatPan.y}px)) scale(${heatZoom})`,
              }}
            >
              {heatRects.map((rect) => {
                const symbol = rect.asset.symbol || '';
                const assetType = heatMapType === 'cryptos' ? 'cryptos' : 'stocks';
                const changeValue = toNumber(rect.asset.change);
                const width = Math.max(rect.width, 0);
                const height = Math.max(rect.height, 0);
                const compact = width < 100 || height < 80;
                const tiny = width < 58 || height < 48;
                const formattedChange =
                  changeValue !== null
                    ? `${changeValue >= 0 ? '+' : ''}${changeValue.toFixed(2)}%`
                    : 'N/A';

                return (
                  <Link
                    key={`${heatMapType}-${symbol}`}
                    to={`/market/${assetType}/${symbol}`}
                    onClick={(event) => {
                      if (shouldBlockTileClick()) event.preventDefault();
                    }}
                    draggable={false}
                    className="absolute flex items-center justify-center overflow-hidden border border-black/80 text-center transition-all hover:z-20 hover:border-white/70 hover:brightness-125"
                    style={{
                      left: rect.x,
                      top: rect.y,
                      width,
                      height,
                      background: heatColor(changeValue),
                    }}
                    title={`${symbol} ${formattedChange} · ${rect.asset.raw?.provider || 'Unknown provider'} · ${rect.asset.currency || 'Unknown currency'} · ${rect.asset.raw?.status || 'unavailable'} · ${rect.asset.raw?.updatedAt || 'No provider timestamp'}`}
                  >
                    {!tiny && (
                      <I18n.div className="flex max-w-full flex-col items-center justify-center px-2 text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]">
                        {!compact && (
                          <CompanyLogo
                            symbol={symbol}
                            name={rect.asset.name || symbol}
                            type={heatMapType === 'cryptos' ? 'crypto' : 'stock'}
                            className="mb-3 h-14 w-14 rounded-full border-black/30 bg-black/35"
                            imgClassName="h-9 w-9"
                          />
                        )}
                        <I18n.div
                          className={cn(
                            'font-black tracking-tight',
                            compact ? 'text-xs' : 'text-2xl',
                          )}
                        >
                          {symbol}
                        </I18n.div>
                        <I18n.div
                          className={cn('font-medium', compact ? 'text-[10px]' : 'text-xl')}
                        >
                          {formattedChange}
                        </I18n.div>
                      </I18n.div>
                    )}
                  </Link>
                );
              })}
            </I18n.div>
            <I18n.div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white/70">
              Wheel to zoom - hold click and drag to move - click tile for chart
            </I18n.div>
          </I18n.div>
        </motion.div>
      ) : (
        <motion.div
          variants={motionItem}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
        >
          {filteredAssets.slice((page - 1) * 12, page * 12).map((asset) => (
            <MarketAssetCard
              key={asset.type + ':' + asset.symbol}
              asset={asset.raw as AssetQuote}
              favorite={favorites.has(asset.raw as AssetQuote)}
              favoriteBusy={favorites.busy || favorites.loading}
              onFavorite={() => favorites.toggle(asset.raw as AssetQuote)}
            />
          ))}
          {filteredAssets.length === 0 && (
            <I18n.div className="panel-card col-span-full p-8 text-center">
              <I18n.div className="text-sm font-black">No assets found</I18n.div>
              <I18n.div className="mt-2 text-xs text-text-dim">
                Clear the search or select another filter.
              </I18n.div>
            </I18n.div>
          )}
        </motion.div>
      )}
      {activeTab !== 'heatmap' && filteredAssets.length > 12 && (
        <I18n.nav
          aria-label="Market pages"
          className="flex flex-wrap items-center justify-center gap-4"
        >
          <I18n.button
            className="secondary-button"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous page
          </I18n.button>
          <I18n.span className="text-xs text-text-dim">
            Page {page} of {Math.ceil(filteredAssets.length / 12)}
          </I18n.span>
          <I18n.button
            className="secondary-button"
            disabled={page * 12 >= filteredAssets.length}
            onClick={() => setPage(page + 1)}
          >
            Next page
          </I18n.button>
        </I18n.nav>
      )}
    </motion.div>
  );
}
