import { collection, deleteDoc, doc, onSnapshot, query, setDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Flame,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Search,
  Sparkles,
  Star,
  TrendingUp,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AssetQuote } from '../../shared/domain';
import { auth, db } from '../lib/firebase';
import { cn } from '../lib/utils';
import CompanyLogo from './CompanyLogo';
import DataProvenance from './DataProvenance';

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
  const dragMovedRef = useRef(false);
  const [stocks, setStocks] = useState<MarketAsset[]>([]);
  const [cryptos, setCryptos] = useState<MarketAsset[]>([]);
  const [hotAssets, setHotAssets] = useState<MarketAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'stocks' | 'cryptos' | 'heatmap' | 'favorites'>(
    'stocks',
  );
  const [heatMapType, setHeatMapType] = useState<'stocks' | 'cryptos'>('stocks');
  const [heatZoom, setHeatZoom] = useState(DEFAULT_HEAT_ZOOM);
  const [heatPan, setHeatPan] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState<{
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);
  const [isHeatMapFullscreen, setIsHeatMapFullscreen] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [dataSource, setDataSource] = useState('Loading');

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = onSnapshot(
      query(collection(db, 'users', auth.currentUser.uid, 'favorites')),
      (snapshot) => {
        setFavorites(snapshot.docs.map((item) => item.id));
      },
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsHeatMapFullscreen(document.fullscreenElement === heatMapRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const normalize = (item: AssetQuote, defaultType: string): MarketAsset => ({
      ...item,
      type: item.type || defaultType,
      exchange: item.exchange || undefined,
      raw: item,
    });

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const [stocksRes, cryptosRes, hotRes] = await Promise.all([
          fetch('/api/market/stocks'),
          fetch('/api/market/cryptos'),
          fetch('/api/market/hot'),
        ]);

        if (!stocksRes.ok || !cryptosRes.ok || !hotRes.ok)
          throw new Error('Market services are temporarily unavailable.');

        const [stocksData, cryptosData, hotData] = await Promise.all([
          stocksRes.json(),
          cryptosRes.json(),
          hotRes.json(),
        ]);
        setStocks((stocksData.data || []).map((item: AssetQuote) => normalize(item, 'stock')));
        setCryptos((cryptosData.data || []).map((item: AssetQuote) => normalize(item, 'crypto')));
        setHotAssets(
          (hotData.data || []).map((item: AssetQuote) =>
            normalize(
              item,
              item.type || (['BTC', 'ETH', 'SOL'].includes(item.symbol) ? 'crypto' : 'stock'),
            ),
          ),
        );
        setDataSource(
          `${stocksData.source || (stocksData.fallback ? 'fallback' : 'market')} / ${cryptosData.source || (cryptosData.fallback ? 'fallback' : 'crypto')}`,
        );
      } catch (fetchError) {
        console.error('Error fetching market data:', fetchError);
        setError(fetchError instanceof Error ? fetchError.message : 'Unable to load market data.');
        setDataSource('Unavailable');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const toggleFavorite = async (event: React.MouseEvent, asset: MarketAsset) => {
    event.preventDefault();
    event.stopPropagation();
    if (!auth.currentUser) return;

    const id = asset.symbol || asset.raw?.symbol || asset.raw?.id;
    if (!id) return;

    const favRef = doc(db, 'users', auth.currentUser.uid, 'favorites', id);
    if (favorites.includes(id)) {
      await deleteDoc(favRef);
    } else {
      await setDoc(favRef, {
        symbol: id,
        name: asset.name || id,
        type: asset.type || 'stock',
        addedAt: new Date().toISOString(),
      });
    }
  };

  const getAssetsToDisplay = () => {
    const allAssets = [...stocks, ...cryptos];
    if (activeTab === 'favorites')
      return allAssets.filter((asset) => asset.symbol && favorites.includes(asset.symbol));
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
      const marketCap = toNumber(asset.marketCap);
      return marketCap && marketCap > 0 ? [{ asset, value: marketCap }] : [];
    })
    .sort((a, b) => b.value - a.value);
  const heatMapWidth = 1600;
  const heatMapHeight = 900;
  const heatRects = splitTreemap(heatItems, 0, 0, heatMapWidth, heatMapHeight);
  const resetHeatMap = () => {
    setHeatZoom(DEFAULT_HEAT_ZOOM);
    setHeatPan({ x: 0, y: 0 });
  };
  const zoomHeatMap = (nextZoom: number) => {
    setHeatZoom(Math.min(Math.max(nextZoom, 0.45), 3.5));
  };
  const handleHeatWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    zoomHeatMap(heatZoom + (event.deltaY > 0 ? -0.12 : 0.12));
  };
  const toggleHeatMapFullscreen = async () => {
    if (!heatMapRef.current) return;

    if (document.fullscreenElement === heatMapRef.current) {
      await document.exitFullscreen();
      return;
    }

    await heatMapRef.current.requestFullscreen();
  };
  const handleDragStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragMovedRef.current = false;
    setDragStart({ x: event.clientX, y: event.clientY, panX: heatPan.x, panY: heatPan.y });
  };
  const handleDragMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart) return;
    const deltaX = event.clientX - dragStart.x;
    const deltaY = event.clientY - dragStart.y;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) {
      dragMovedRef.current = true;
    }
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
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <button
              aria-label="Back"
              onClick={() => navigate(-1)}
              className="rounded-2xl border border-border-accent bg-bg/50 p-3 transition-all hover:border-accent hover:text-accent"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="accent-chip mb-4">
                <Sparkles className="h-3.5 w-3.5" /> Markets
              </div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
                Asset discovery
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-text-dim">
                Acciones, criptos y favoritos con logos reales, filtros rapidos y lectura visual de
                momentum.
              </p>
            </div>
          </div>
          <div className="relative w-full max-w-xl">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-dim" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search symbol or company"
              className="w-full rounded-2xl border border-border-accent bg-bg/65 py-4 pl-12 pr-4 text-sm font-bold outline-none transition-all focus:border-accent focus:shadow-[0_0_32px_rgba(124,255,26,0.12)]"
            />
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-px w-full scanline" />
      </motion.section>

      {error && (
        <motion.div
          variants={motionItem}
          className="flex items-center gap-3 rounded-2xl border border-loss/40 bg-loss/10 px-4 py-3 text-xs font-bold text-loss"
        >
          <AlertCircle className="h-4 w-4" />
          {error}
        </motion.div>
      )}

      <motion.div
        variants={motionItem}
        className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['stocks', 'cryptos', 'heatmap', 'favorites'] as const).map((tab) => (
            <button
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
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="quiet-chip">{filteredAssets.length} visible assets</div>
          <div className="quiet-chip">Source: {dataSource} · Provider timestamps on each asset</div>
        </div>
      </motion.div>

      {!loading && hotAssets.length > 0 && (
        <motion.div variants={motionItem} className="panel-card p-4">
          <div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-text-dim">
            <Flame className="h-4 w-4 text-accent" />
            Hot right now
          </div>
          <div className="flex gap-3 overflow-x-auto pb-3">
            {hotAssets.slice(0, 12).map((asset, index) => {
              const changeValue = toNumber(asset.change) ?? 0;
              const symbol = asset.symbol || asset.id || `hot-${index}`;
              return (
                <button
                  key={symbol}
                  onClick={() => {
                    setSearch(symbol);
                    setActiveTab(asset.type === 'crypto' ? 'cryptos' : 'stocks');
                  }}
                  className="min-w-[170px] rounded-2xl border border-border-accent bg-bg/45 p-3 text-left transition-all hover:border-accent/50 hover:bg-accent/10"
                >
                  <div className="flex items-center gap-3">
                    <CompanyLogo
                      symbol={symbol}
                      name={asset.name || symbol}
                      type={asset.type === 'crypto' ? 'crypto' : 'stock'}
                      className="h-10 w-10 rounded-xl"
                      imgClassName="h-6 w-6"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-black">{symbol}</div>
                      <div
                        className={cn(
                          'text-[10px] font-black',
                          changeValue >= 0 ? 'text-accent' : 'text-loss',
                        )}
                      >
                        {changeValue >= 0 ? '+' : ''}
                        {changeValue.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, index) => (
            <div
              key={index}
              className="h-72 animate-pulse rounded-3xl border border-border-accent bg-surface"
            />
          ))}
        </div>
      ) : activeTab === 'heatmap' ? (
        <motion.div
          ref={heatMapRef}
          variants={motionItem}
          className="panel-card overflow-hidden p-0 fullscreen:rounded-none fullscreen:border-0 fullscreen:bg-bg"
        >
          <div className="flex flex-col gap-3 border-b border-border-accent bg-bg/55 p-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <div className="accent-chip">Heat Map</div>
              <span className="hidden text-[10px] font-black uppercase tracking-widest text-text-dim sm:inline">
                {heatMapType === 'stocks' ? 'Stocks by company value' : 'Crypto by market cap'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['stocks', 'cryptos'] as const).map((type) => (
                <button
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
                </button>
              ))}
              <div className="ml-0 flex items-center overflow-hidden rounded-xl border border-border-accent bg-surface md:ml-2">
                <button
                  onClick={() => zoomHeatMap(heatZoom - 0.2)}
                  className="p-2 text-text-dim transition-all hover:bg-accent/10 hover:text-accent"
                  title="Zoom out"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  onClick={() => zoomHeatMap(heatZoom + 0.2)}
                  className="border-l border-border-accent p-2 text-text-dim transition-all hover:bg-accent/10 hover:text-accent"
                  title="Zoom in"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  onClick={resetHeatMap}
                  className="border-l border-border-accent px-3 py-2 text-[10px] font-black uppercase tracking-widest text-text-dim transition-all hover:bg-accent/10 hover:text-accent"
                  title="Reset view"
                >
                  Reset
                </button>
                <button
                  onClick={toggleHeatMapFullscreen}
                  className="border-l border-border-accent p-2 text-text-dim transition-all hover:bg-accent/10 hover:text-accent"
                  title={isHeatMapFullscreen ? 'Exit full screen' : 'Full screen'}
                >
                  {isHeatMapFullscreen ? (
                    <Minimize2 className="h-4 w-4" />
                  ) : (
                    <Maximize2 className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div
            className="relative h-[72vh] min-h-[560px] cursor-grab touch-none select-none overflow-hidden bg-[#050705] active:cursor-grabbing fullscreen:h-[calc(100vh-57px)] fullscreen:min-h-0"
            onWheel={handleHeatWheel}
            onPointerDown={handleDragStart}
            onPointerMove={handleDragMove}
            onPointerUp={handleDragEnd}
            onPointerCancel={handleDragEnd}
          >
            <div
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
                      <div className="flex max-w-full flex-col items-center justify-center px-2 text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.7)]">
                        {!compact && (
                          <CompanyLogo
                            symbol={symbol}
                            name={rect.asset.name || symbol}
                            type={heatMapType === 'cryptos' ? 'crypto' : 'stock'}
                            className="mb-3 h-14 w-14 rounded-full border-black/30 bg-black/35"
                            imgClassName="h-9 w-9"
                          />
                        )}
                        <div
                          className={cn(
                            'font-black tracking-tight',
                            compact ? 'text-xs' : 'text-2xl',
                          )}
                        >
                          {symbol}
                        </div>
                        <div className={cn('font-medium', compact ? 'text-[10px]' : 'text-xl')}>
                          {formattedChange}
                        </div>
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white/70">
              Wheel to zoom - hold click and drag to move - click tile for chart
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          variants={motionItem}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4"
        >
          {filteredAssets.map((asset, index) => {
            const changeValue = toNumber(asset.change);
            const priceValue = toNumber(asset.price);
            const isPositive = (changeValue ?? 0) >= 0;
            const symbol = asset.symbol || asset.id || `asset-${index}`;
            const assetType =
              asset.type === 'crypto' || asset.type === 'cryptocurrency' ? 'cryptos' : 'stocks';
            const formattedPrice =
              priceValue !== null && priceValue > 0
                ? new Intl.NumberFormat(undefined, {
                    style: 'currency',
                    currency: asset.currency || 'USD',
                    minimumFractionDigits: priceValue < 1 ? 4 : 2,
                    maximumFractionDigits: priceValue < 1 ? 6 : 2,
                  }).format(priceValue)
                : 'Unavailable';
            const formattedChange =
              changeValue !== null
                ? `${isPositive ? '+' : ''}${changeValue.toFixed(2)}%`
                : 'Unavailable';

            return (
              <motion.div
                key={symbol}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.025, 0.35) }}
              >
                <Link
                  to={`/market/${assetType}/${symbol}`}
                  className="panel-card group block h-full p-5"
                >
                  <div
                    className={cn(
                      'absolute left-0 top-0 h-1 w-full',
                      isPositive ? 'bg-accent' : 'bg-loss',
                    )}
                  />
                  <div className="relative z-10 flex h-full flex-col">
                    <DataProvenance quote={asset.raw as AssetQuote | undefined} />
                    <div className="mb-5 flex items-start justify-between gap-3">
                      <CompanyLogo
                        symbol={symbol}
                        name={asset.name || symbol}
                        type={asset.type === 'crypto' ? 'crypto' : 'stock'}
                        className="h-14 w-14 rounded-2xl shadow-lg"
                        imgClassName="h-9 w-9"
                      />
                      <button
                        onClick={(event) => toggleFavorite(event, asset)}
                        className="rounded-full border border-border-accent bg-bg/50 p-2 transition-all hover:border-accent hover:bg-accent/10"
                      >
                        <Star
                          className={cn(
                            'h-5 w-5 transition-colors',
                            favorites.includes(symbol)
                              ? 'fill-accent text-accent'
                              : 'text-text-dim',
                          )}
                        />
                      </button>
                    </div>
                    <div className="min-h-[74px]">
                      <div className="text-xl font-black tracking-tight">{symbol}</div>
                      <div className="mt-1 line-clamp-2 text-xs leading-5 text-text-dim">
                        {asset.name || 'Unknown asset'}
                      </div>
                    </div>
                    <div className="mt-5 rounded-2xl border border-border-accent/50 bg-bg/55 p-4 shadow-inner shadow-black/20">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">
                          Price
                        </span>
                        <span
                          className={cn(
                            'data-value text-lg font-black',
                            priceValue === null ? 'text-text-dim' : 'text-text-main',
                          )}
                        >
                          {formattedPrice}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-dim">
                          24h
                        </span>
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-sm font-black',
                            isPositive ? 'text-accent' : 'text-loss',
                          )}
                        >
                          {isPositive ? (
                            <ArrowUpRight className="h-4 w-4" />
                          ) : (
                            <TrendingUp className="h-4 w-4 rotate-180" />
                          )}
                          {formattedChange}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-border-accent/40 pt-4 text-[10px] font-black uppercase tracking-widest text-text-dim">
                      <span>{asset.exchange || 'Global'}</span>
                      <span>{asset.type || 'asset'}</span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
          {filteredAssets.length === 0 && (
            <div className="panel-card col-span-full p-8 text-center">
              <div className="text-sm font-black">No assets found</div>
              <div className="mt-2 text-xs text-text-dim">
                Clear the search or select another filter.
              </div>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
