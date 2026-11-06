import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  ChartCandlestick,
  Download,
  Expand,
  Eye,
  EyeOff,
  Magnet,
  Minus,
  MousePointer2,
  MoveUpRight,
  Plus,
  RotateCcw,
  Ruler,
  Settings2,
  SlidersHorizontal,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import type { AssetType, HistoryRange, HistoryInterval, MarketHistory } from '../../shared/domain';
import {
  clampChartView,
  cleanCandles,
  priceDomain,
  priceY,
  yPrice,
  zoomChartView,
  type ChartView,
} from '../../shared/chartGeometry';
import { calculateIndicator, chartIndicators } from '../../shared/chartIndicators';
import type { IndicatorId } from '../../shared/chartIndicators';
import {
  fibonacciColors,
  fibonacciLevels,
  fibonacciPrice,
  moveDrawing,
  nearestCandleIndex,
  readDrawings,
  segmentDistance,
  type ChartDrawing as Drawing,
  type ChartPoint as Point,
} from '../../shared/chartDrawings';
import { historyCutoff } from '../../shared/history';
import ChartIndicatorLibrary, { type ActiveIndicators } from './ChartIndicatorLibrary';
import { useLanguage } from '../contexts/LanguageContext';
import { readJson } from '../lib/query';
import { I18n, UiText } from './Localized';

const ranges: HistoryRange[] = ['1D', '5D', '1W', '1M', '3M', '6M', 'YTD', '1Y', '5Y', 'MAX'];
type Tool = 'cursor' | Drawing['kind'];
function FibonacciIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      aria-hidden="true"
    >
      <path d="M3 3h14M3 7h14M3 11h14M3 15h14M3 17 17 3" />
    </svg>
  );
}

export default function FinancialChart({
  symbol,
  type,
  fixture,
  large = false,
}: {
  symbol: string;
  type: AssetType;
  fixture?: MarketHistory;
  large?: boolean;
}) {
  const { locale, text } = useLanguage();
  const [range, setRange] = useState<HistoryRange>(fixture ? '1M' : 'MAX');
  const [interval, setInterval] = useState<HistoryInterval>('1d');
  const [mode, setMode] = useState<'candle' | 'line' | 'area'>('candle');
  const [activeIndicators, setActiveIndicators] = useState<ActiveIndicators>({});
  const [log, setLog] = useState(false),
    [volume, setVolume] = useState(true);
  const [tool, setTool] = useState<Tool>('cursor');
  const [selectedDrawing, setSelectedDrawing] = useState<string | null>(null);
  const [drawingSettings, setDrawingSettings] = useState(false);
  const [magnet, setMagnet] = useState(false),
    [showDrawings, setShowDrawings] = useState(true);
  const [indicatorOpen, setIndicatorOpen] = useState(false);
  const [indicatorFocus, setIndicatorFocus] = useState<IndicatorId | undefined>();
  const [drawings, setDrawings] = useState<Drawing[]>([]),
    [draft, setDraft] = useState<Drawing | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number; index: number } | null>(null);
  const [view, setView] = useState<ChartView>({ from: 0, count: 0 });
  const [size, setSize] = useState({ width: 900, height: 380 });
  const [light, setLight] = useState(document.documentElement.classList.contains('light'));
  const [expanded, setExpanded] = useState(false);
  const [imageError, setImageError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null),
    host = useRef<HTMLDivElement>(null);
  const panStart = useRef<{ x: number; view: ChartView; moved: boolean } | null>(null);
  const drawingGesture = useRef<{
    id: string;
    part: 'a' | 'b' | 'body';
    start: { x: number; y: number };
    original: Drawing;
    moved: boolean;
  } | null>(null);
  const drawingsRef = useRef(drawings);
  drawingsRef.current = drawings;
  const previousHistory = useRef({ key: '', first: 0, count: 0 });
  const storageKey = `zentra:chart-drawings:${type}:${symbol}`;
  const query = useInfiniteQuery({
    queryKey: ['chart-history', type, symbol, interval],
    initialPageParam: undefined as number | undefined,
    queryFn: ({ signal, pageParam }) =>
      readJson<MarketHistory>(
        `/api/market/history?symbol=${encodeURIComponent(symbol)}&type=${type}&range=MAX&interval=${interval}${pageParam ? `&before=${pageParam}` : ''}`,
        signal,
      ),
    enabled: !fixture,
    getNextPageParam: (page) => page.nextBefore || undefined,
    staleTime: 300_000,
    refetchInterval: interval === '1h' || interval === '4h' ? 300_000 : false,
  });
  const history =
    fixture ||
    (query.isRefetchError && query.data?.pages[0]
      ? { ...query.data.pages[0], stale: true, status: 'stale' as const }
      : query.data?.pages[0]);
  const ordered = useMemo(
    () => cleanCandles(fixture?.candles || query.data?.pages.flatMap((page) => page.candles) || []),
    [fixture?.candles, query.data?.pages],
  );
  const hasVolume = ordered.some((bar) => bar.volume !== null && bar.volume > 0);
  const intraday = interval === '1h' || interval === '4h';
  const indicators = useMemo(
    () =>
      chartIndicators
        .filter(
          (spec) =>
            activeIndicators[spec.id] &&
            (!spec.volume || hasVolume) &&
            (spec.id !== 'vwap' || intraday),
        )
        .map((spec) => ({
          ...spec,
          settings: activeIndicators[spec.id]!,
          result: calculateIndicator(spec.id, ordered, activeIndicators[spec.id]),
        })),
    [activeIndicators, ordered, hasVolume, intraday],
  );
  const panes = indicators.filter((item) => item.pane);
  useEffect(() => {
    const key = `${type}:${symbol}:${range}:${interval}`,
      previous = previousHistory.current;
    const first = ordered[0]?.timestamp || 0;
    if (key !== previous.key || !previous.count) {
      const cutoff = historyCutoff(range);
      let start = ordered.findIndex((bar) => bar.timestamp >= cutoff);
      // Holidays/weekends still show the latest trading session.
      if (start < 0) start = Math.max(0, ordered.length - (intraday ? 7 : 1));
      const count = range === 'MAX' ? Math.min(180, ordered.length) : ordered.length - start;
      setView({ from: ordered.length - count, count });
    } else if (first < previous.first) {
      const added = ordered.findIndex((bar) => bar.timestamp === previous.first);
      if (added > 0) setView((current) => ({ ...current, from: current.from + added }));
    }
    previousHistory.current = { key, first, count: ordered.length };
    setHover(null);
    setDraft(null);
  }, [symbol, type, range, interval, ordered]);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]');
      setDrawings(readDrawings(saved));
    } catch {
      setDrawings([]);
    }
    setTool('cursor');
    setDraft(null);
    setSelectedDrawing(null);
    setDrawingSettings(false);
  }, [storageKey]);
  const saveDrawings = (next: Drawing[]) => {
    const limited = next.slice(-50);
    drawingsRef.current = limited;
    setDrawings(limited);
    try {
      localStorage.setItem(storageKey, JSON.stringify(limited));
    } catch {
      /* Drawings remain usable for this session. */
    }
  };
  useEffect(() => {
    const observer = new MutationObserver(() =>
      setLight(document.documentElement.classList.contains('light')),
    );
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!host.current) return;
    const element = host.current,
      update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [expanded, large, ordered.length]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDraft(null);
        setTool('cursor');
        setSelectedDrawing(null);
        setDrawingSettings(false);
        setExpanded(false);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const visibleView = clampChartView(
    ordered.length,
    view.count ? view : { from: 0, count: ordered.length },
  );
  const visible = ordered.slice(visibleView.from, visibleView.from + visibleView.count);
  const overlayValues = indicators
    .filter((item) => !item.pane)
    .flatMap((item) =>
      item.result.lines.flatMap((line) =>
        line.values
          .slice(visibleView.from, visibleView.from + visibleView.count)
          .filter((value): value is number => value !== null),
      ),
    );
  const domain = priceDomain(visible, log, overlayValues);
  const paneHeight = 100;
  const geometry = {
    left: 12,
    top: indicators.some((item) => !item.pane) ? 66 : 35,
    width: Math.max(40, size.width - 98),
    height: Math.max(
      120,
      size.height -
        (indicators.some((item) => !item.pane) ? 66 : 35) -
        (volume ? 84 : 20) -
        panes.length * paneHeight,
    ),
  };
  const step = geometry.width / Math.max(1, visibleView.count);
  const selected = hover ? ordered[hover.index] : visible.at(-1);
  const format = (value: number) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: type === 'forex' ? 6 : Math.abs(value) < 1 ? 8 : 2,
    }).format(value);
  const formatIndicator = (value: number) =>
    new Intl.NumberFormat(locale, {
      maximumFractionDigits: Math.abs(value) < 1 ? 4 : 2,
      ...(Math.abs(value) >= 1000000 ? { notation: 'compact' as const } : {}),
    }).format(value);
  const pointAt = (x: number, y: number): Point | null => {
    const index = Math.max(
      0,
      Math.min(ordered.length - 1, visibleView.from + Math.floor((x - geometry.left) / step)),
    );
    const bar = ordered[index];
    const point = bar
      ? {
          timestamp: bar.timestamp,
          price: Math.max(
            1e-10,
            yPrice(
              Math.max(geometry.top, Math.min(geometry.top + geometry.height, y)),
              domain,
              geometry.top,
              geometry.height,
            ),
          ),
        }
      : null;
    if (point && magnet) {
      const closest = [bar.open, bar.high, bar.low, bar.close].sort(
        (a, b) =>
          Math.abs(priceY(a, domain, geometry.top, geometry.height) - y) -
          Math.abs(priceY(b, domain, geometry.top, geometry.height) - y),
      )[0];
      if (Math.abs(priceY(closest, domain, geometry.top, geometry.height) - y) <= 14)
        point.price = closest;
    }
    return point;
  };
  const drawingHit = (
    x: number,
    y: number,
  ): { drawing: Drawing; part: 'a' | 'b' | 'body' } | null => {
    if (!showDrawings || y < geometry.top || y > geometry.top + geometry.height) return null;
    const px = (point: Point) =>
      geometry.left +
      (nearestCandleIndex(ordered, point.timestamp) - visibleView.from + 0.5) * step;
    const py = (point: Point) => priceY(point.price, domain, geometry.top, geometry.height);
    const tolerance = 9;
    for (const drawing of [...drawings].reverse()) {
      if (
        drawing.kind !== 'horizontal' &&
        (drawing.a.timestamp < ordered[0].timestamp ||
          drawing.a.timestamp > ordered.at(-1)!.timestamp ||
          (drawing.b &&
            (drawing.b.timestamp < ordered[0].timestamp ||
              drawing.b.timestamp > ordered.at(-1)!.timestamp)))
      )
        continue;
      const ax = px(drawing.a),
        ay = py(drawing.a);
      if (Math.hypot(x - ax, y - ay) < tolerance) return { drawing, part: 'a' };
      if (drawing.kind === 'horizontal' && Math.abs(y - ay) < tolerance)
        return { drawing, part: 'body' };
      if (!drawing.b) continue;
      const bx = px(drawing.b),
        by = py(drawing.b);
      if (Math.hypot(x - bx, y - by) < tolerance) return { drawing, part: 'b' };
      if (segmentDistance(x, y, ax, ay, bx, by) < tolerance) return { drawing, part: 'body' };
      if (drawing.kind === 'fibonacci') {
        const left = Math.min(ax, bx),
          right = drawing.extendRight !== false ? geometry.left + geometry.width : Math.max(ax, bx);
        if (
          x >= left - tolerance &&
          x <= right + tolerance &&
          (drawing.levels || fibonacciLevels).some((ratio) => {
            const value = fibonacciPrice(
              drawing.reverse ? drawing.b!.price : drawing.a.price,
              drawing.reverse ? drawing.a.price : drawing.b!.price,
              ratio,
              drawing.logarithmic,
            );
            return (
              value > 0 &&
              Math.abs(y - priceY(value, domain, geometry.top, geometry.height)) < tolerance
            );
          })
        )
          return { drawing, part: 'body' };
      }
    }
    return null;
  };
  useEffect(() => {
    const element = canvas.current;
    if (!element || !ordered.length) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const box = element.getBoundingClientRect();
      const anchor = Math.max(
        0,
        Math.min(1, (event.clientX - box.left - geometry.left) / geometry.width),
      );
      setView((current) =>
        zoomChartView(
          ordered.length,
          current.count ? current : { from: 0, count: ordered.length },
          event.deltaY < 0 ? 1.15 : 1 / 1.15,
          anchor,
        ),
      );
    };
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [ordered.length, geometry.width, geometry.left]);
  useEffect(() => {
    const element = canvas.current,
      context = element?.getContext('2d');
    if (!element || !context || !visible.length || size.width < 1) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    element.width = Math.round(size.width * ratio);
    element.height = Math.round(size.height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const bg = light ? '#fafcfb' : '#10161f',
      grid = light ? '#e6ece8' : '#1e2934',
      muted = light ? '#5d7069' : '#768c89',
      up = '#69d6a2',
      down = '#ed7889';
    context.fillStyle = bg;
    context.fillRect(0, 0, size.width, size.height);
    context.font = '11px Inter, system-ui, sans-serif';
    context.textAlign = 'left';
    const yOf = (value: number) => priceY(value, domain, geometry.top, geometry.height);
    const xOf = (index: number) => geometry.left + (index - visibleView.from + 0.5) * step;
    context.strokeStyle = grid;
    context.lineWidth = 1;
    for (let tick = 0; tick <= 5; tick++) {
      const y = geometry.top + (tick / 5) * geometry.height;
      context.beginPath();
      context.moveTo(geometry.left, y);
      context.lineTo(geometry.left + geometry.width, y);
      context.stroke();
      context.fillStyle = muted;
      context.fillText(
        format(yPrice(y, domain, geometry.top, geometry.height)),
        geometry.left + geometry.width + 10,
        y + 3,
      );
    }
    const dateFormat = new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      ...(intraday && visibleView.count <= 80
        ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
        : {
            day: '2-digit',
            month: 'short',
            ...(range === '5Y' || range === 'MAX' ? { year: '2-digit' } : {}),
          }),
    });
    const dateTicks = Math.max(1, Math.min(5, Math.floor(geometry.width / 130)));
    for (let tick = 0; tick <= dateTicks; tick++) {
      const index = Math.min(
        visible.length - 1,
        Math.floor((tick / dateTicks) * Math.max(0, visible.length - 1)),
      );
      const x = xOf(visibleView.from + index);
      context.strokeStyle = grid;
      context.setLineDash([2, 5]);
      context.beginPath();
      context.moveTo(x, geometry.top);
      context.lineTo(x, size.height - 29);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = muted;
      context.textAlign = tick === 0 ? 'left' : tick === dateTicks ? 'right' : 'center';
      context.fillText(dateFormat.format(visible[index].timestamp), x, size.height - 10);
    }
    context.save();
    context.beginPath();
    context.rect(geometry.left, geometry.top - 4, geometry.width, geometry.height + 8);
    context.clip();
    if (mode === 'candle') {
      for (let index = 0; index < visible.length; index++) {
        const bar = visible[index],
          x = xOf(visibleView.from + index),
          color = bar.close >= bar.open ? up : down;
        context.strokeStyle = color;
        context.fillStyle = color;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(x, yOf(bar.high));
        context.lineTo(x, yOf(bar.low));
        context.stroke();
        context.fillRect(
          x - Math.max(1, step * 0.65) / 2,
          Math.min(yOf(bar.open), yOf(bar.close)),
          Math.max(1, step * 0.65),
          Math.max(1.2, Math.abs(yOf(bar.open) - yOf(bar.close))),
        );
      }
    } else {
      context.beginPath();
      visible.forEach((bar, index) => {
        const x = xOf(visibleView.from + index);
        if (!index) context.moveTo(x, yOf(bar.close));
        else context.lineTo(x, yOf(bar.close));
      });
      if (mode === 'area') {
        context.lineTo(xOf(visibleView.from + visible.length - 1), geometry.top + geometry.height);
        context.lineTo(xOf(visibleView.from), geometry.top + geometry.height);
        context.closePath();
        const gradient = context.createLinearGradient(
          0,
          geometry.top,
          0,
          geometry.top + geometry.height,
        );
        gradient.addColorStop(0, '#69d6a238');
        gradient.addColorStop(1, '#69d6a202');
        context.fillStyle = gradient;
        context.fill();
        context.beginPath();
        visible.forEach((bar, index) => {
          if (!index) context.moveTo(xOf(visibleView.from + index), yOf(bar.close));
          else context.lineTo(xOf(visibleView.from + index), yOf(bar.close));
        });
      }
      context.strokeStyle = up;
      context.lineWidth = 1.8;
      context.stroke();
    }
    const drawSeries = (values: (number | null)[], color: string, y: (value: number) => number) => {
      context.beginPath();
      let started = false;
      for (let index = visibleView.from; index < visibleView.from + visibleView.count; index++) {
        const value = values[index];
        if (value === null || value === undefined) {
          started = false;
          continue;
        }
        if (!started) {
          context.moveTo(xOf(index), y(value));
          started = true;
        } else context.lineTo(xOf(index), y(value));
      }
      context.strokeStyle = color;
      context.lineWidth = 1.5;
      context.stroke();
    };
    for (const indicator of indicators.filter((item) => !item.pane)) {
      if (indicator.result.cloud) {
        const [a, b] = indicator.result.cloud;
        for (
          let index = visibleView.from;
          index < visibleView.from + visibleView.count - 1;
          index++
        ) {
          if ([a[index], a[index + 1], b[index], b[index + 1]].some((value) => value === null))
            continue;
          context.fillStyle = a[index]! >= b[index]! ? '#69d6a226' : '#ed788926';
          context.beginPath();
          context.moveTo(xOf(index), yOf(a[index]!));
          context.lineTo(xOf(index + 1), yOf(a[index + 1]!));
          context.lineTo(xOf(index + 1), yOf(b[index + 1]!));
          context.lineTo(xOf(index), yOf(b[index]!));
          context.closePath();
          context.fill();
        }
      }
      for (const line of indicator.result.lines) drawSeries(line.values, line.color, yOf);
    }
    const indexForTime = (timestamp: number) => nearestCandleIndex(ordered, timestamp);
    const activeDraft =
      draft && hover ? { ...draft, b: pointAt(hover.x, hover.y) || undefined } : draft;
    for (const drawing of [
      ...(showDrawings ? drawings : []),
      ...(activeDraft ? [activeDraft] : []),
    ]) {
      if (
        drawing.kind !== 'horizontal' &&
        (drawing.a.timestamp < ordered[0].timestamp ||
          drawing.a.timestamp > ordered.at(-1)!.timestamp ||
          (drawing.b &&
            (drawing.b.timestamp < ordered[0].timestamp ||
              drawing.b.timestamp > ordered.at(-1)!.timestamp)))
      )
        continue;
      const ax = xOf(indexForTime(drawing.a.timestamp)),
        ay = yOf(drawing.a.price);
      const selected = drawing.id === selectedDrawing || drawing.id === draft?.id;
      context.strokeStyle = drawing.color || (drawing.kind === 'measure' ? '#a7b7c7' : '#dce989');
      context.lineWidth = selected ? 1.8 : 1.3;
      context.setLineDash(drawing.kind === 'measure' ? [4, 4] : []);
      context.beginPath();
      if (drawing.kind === 'horizontal') {
        context.moveTo(geometry.left, ay);
        context.lineTo(geometry.left + geometry.width, ay);
      } else if (drawing.b) {
        const bx = xOf(indexForTime(drawing.b.timestamp)),
          by = yOf(drawing.b.price);
        context.moveTo(ax, ay);
        context.lineTo(bx, by);
        if (drawing.kind === 'measure') {
          context.fillStyle = '#87a9f714';
          context.fillRect(
            Math.min(ax, bx),
            Math.min(ay, by),
            Math.abs(bx - ax),
            Math.abs(by - ay),
          );
          context.fillStyle = light ? '#36515a' : '#d5e3e0';
          context.textAlign = 'left';
          context.fillText(
            `${format((drawing.b.price / drawing.a.price - 1) * 100)}% · ${Math.abs(indexForTime(drawing.b.timestamp) - indexForTime(drawing.a.timestamp))} ${text('bars')}`,
            Math.min(ax, bx) + 5,
            Math.min(ay, by) - 8,
          );
        }
        if (drawing.kind === 'fibonacci') {
          context.setLineDash([4, 4]);
          context.stroke();
          context.setLineDash([]);
          const left = Math.min(ax, bx),
            right =
              drawing.extendRight !== false ? geometry.left + geometry.width : Math.max(ax, bx);
          const levels = (drawing.levels || fibonacciLevels)
            .map((ratio) => ({
              ratio,
              price: fibonacciPrice(
                drawing.reverse ? drawing.b!.price : drawing.a.price,
                drawing.reverse ? drawing.a.price : drawing.b!.price,
                ratio,
                drawing.logarithmic,
              ),
            }))
            .filter((level) => level.price > 0);
          levels.forEach((level, index) => {
            const y = yOf(level.price),
              color = drawing.color || fibonacciColors[index % fibonacciColors.length];
            if (index && levels[index - 1].price > 0) {
              context.fillStyle = color + '0b';
              context.fillRect(
                left,
                Math.min(y, yOf(levels[index - 1].price)),
                right - left,
                Math.abs(y - yOf(levels[index - 1].price)),
              );
            }
            context.strokeStyle = color;
            context.lineWidth = selected ? 1.3 : 1;
            context.beginPath();
            context.moveTo(left, y);
            context.lineTo(right, y);
            context.stroke();
            context.textAlign = 'left';
            context.fillStyle = color;
            context.fillText(
              `${level.ratio} (${format(level.price)})`,
              Math.max(geometry.left + 3, left + 4),
              y - 4,
            );
          });
          context.beginPath();
        }
      }
      context.stroke();
      context.setLineDash([]);
      if (selected) {
        for (const point of [drawing.a, ...(drawing.b ? [drawing.b] : [])]) {
          context.beginPath();
          context.arc(xOf(indexForTime(point.timestamp)), yOf(point.price), 5, 0, Math.PI * 2);
          context.fillStyle = bg;
          context.fill();
          context.strokeStyle = drawing.color || '#a6b5ca';
          context.lineWidth = 1.8;
          context.stroke();
        }
      }
    }
    const last = visible.at(-1)!;
    context.strokeStyle = last.close >= last.open ? '#69d6a280' : '#ed788980';
    context.setLineDash([3, 4]);
    context.beginPath();
    context.moveTo(geometry.left, yOf(last.close));
    context.lineTo(geometry.left + geometry.width, yOf(last.close));
    context.stroke();
    context.setLineDash([]);
    context.restore();
    context.fillStyle = last.close >= last.open ? '#22523f' : '#683944';
    context.fillRect(geometry.left + geometry.width + 3, yOf(last.close) - 9, 80, 18);
    context.fillStyle = '#effaf5';
    context.textAlign = 'left';
    context.fillText(format(last.close), geometry.left + geometry.width + 8, yOf(last.close) + 3);
    if (volume) {
      const maxVolume = Math.max(1, ...visible.map((bar) => bar.volume || 0));
      const bottom = geometry.top + geometry.height + 70,
        volumeHeight = 55;
      visible.forEach((bar, index) => {
        if (bar.volume === null) return;
        context.fillStyle = bar.close >= bar.open ? '#69d6a24a' : '#ed78894a';
        const height = (bar.volume / maxVolume) * volumeHeight;
        context.fillRect(
          xOf(visibleView.from + index) - step * 0.33,
          bottom - height,
          Math.max(1, step * 0.66),
          height,
        );
      });
    }
    panes.forEach((pane, paneIndex) => {
      const top = geometry.top + geometry.height + (volume ? 76 : 10) + paneIndex * paneHeight;
      const height = paneHeight - 25;
      const result = pane.result;
      const numbers = [
        ...result.lines.flatMap((line) =>
          line.values.slice(visibleView.from, visibleView.from + visibleView.count),
        ),
        ...(result.histogram?.slice(visibleView.from, visibleView.from + visibleView.count) || []),
      ].filter((value): value is number => value !== null);
      let min = result.bounds?.[0] ?? Math.min(0, ...numbers),
        max = result.bounds?.[1] ?? Math.max(0, ...numbers);
      if (!result.bounds) {
        const padding = Math.max((max - min) * 0.12, 0.000001);
        min -= padding;
        max += padding;
      }
      const y = (value: number) => top + 14 + ((max - value) / (max - min)) * (height - 14);
      context.strokeStyle = grid;
      context.beginPath();
      context.moveTo(geometry.left, top - 3);
      context.lineTo(size.width, top - 3);
      context.stroke();
      context.fillStyle = muted;
      context.textAlign = 'left';
      context.fillText(text(pane.label), geometry.left + 4, top + 9);
      context.fillText(formatIndicator(max), geometry.left + geometry.width + 10, top + 18);
      context.fillText(formatIndicator(min), geometry.left + geometry.width + 10, top + height);
      for (const level of result.levels || []) {
        context.setLineDash([3, 4]);
        context.strokeStyle = grid;
        context.beginPath();
        context.moveTo(geometry.left, y(level));
        context.lineTo(geometry.left + geometry.width, y(level));
        context.stroke();
        context.setLineDash([]);
      }
      context.save();
      context.beginPath();
      context.rect(geometry.left, top + 13, geometry.width, height - 12);
      context.clip();
      if (result.histogram) {
        for (let index = visibleView.from; index < visibleView.from + visibleView.count; index++) {
          const value = result.histogram[index];
          if (value === null) continue;
          context.fillStyle = value >= 0 ? '#69d6a280' : '#ed788980';
          context.fillRect(
            xOf(index) - step * 0.3,
            Math.min(y(value), y(0)),
            Math.max(1, step * 0.6),
            Math.max(1, Math.abs(y(value) - y(0))),
          );
        }
      }
      for (const line of result.lines) drawSeries(line.values, line.color, y);
      context.restore();
      const index = hover?.index ?? visibleView.from + visibleView.count - 1;
      let labelX = geometry.left + 130;
      for (const line of result.lines) {
        const value = line.values[index];
        context.fillStyle = line.color;
        const label = `${text(line.label)}: ${value == null ? '—' : formatIndicator(value)}`;
        if (labelX + context.measureText(label).width < geometry.left + geometry.width)
          context.fillText(label, labelX, top + 9);
        labelX += context.measureText(label).width + 14;
      }
      if (!numbers.length) {
        context.fillStyle = muted;
        context.fillText(
          text('Not enough candles for this indicator.'),
          geometry.left + 10,
          top + 48,
        );
      }
    });
    if (
      hover &&
      hover.x >= geometry.left &&
      hover.x <= geometry.left + geometry.width &&
      hover.y >= geometry.top &&
      hover.y <= size.height - 28
    ) {
      const x = xOf(hover.index);
      context.strokeStyle = light ? '#7f9995' : '#728982';
      context.setLineDash([3, 4]);
      context.beginPath();
      context.moveTo(x, geometry.top);
      context.lineTo(x, size.height - 28);
      if (hover.y <= geometry.top + geometry.height) {
        context.moveTo(geometry.left, hover.y);
        context.lineTo(geometry.left + geometry.width, hover.y);
      }
      context.stroke();
      context.setLineDash([]);
      if (hover.y <= geometry.top + geometry.height) {
        context.textAlign = 'left';
        context.fillStyle = light ? '#dae9e2' : '#40564e';
        context.fillRect(geometry.left + geometry.width + 3, hover.y - 9, 80, 18);
        context.fillStyle = light ? '#153b2e' : '#f1faf6';
        context.fillText(
          format(yPrice(hover.y, domain, geometry.top, geometry.height)),
          geometry.left + geometry.width + 8,
          hover.y + 3,
        );
      }
      const hoveredBar = ordered[hover.index];
      if (hoveredBar) {
        const label = new Intl.DateTimeFormat(locale, {
          timeZone: 'UTC',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          ...(intraday ? { hour: '2-digit', minute: '2-digit' } : {}),
        }).format(hoveredBar.timestamp);
        const width = context.measureText(label).width + 16,
          left = Math.max(
            geometry.left,
            Math.min(geometry.left + geometry.width - width, x - width / 2),
          );
        context.fillStyle = light ? '#dae9e2' : '#344452';
        context.fillRect(left, size.height - 25, width, 23);
        context.fillStyle = light ? '#173129' : '#edf2f7';
        context.textAlign = 'left';
        context.fillText(label, left + 8, size.height - 9);
      }
    }
    context.font = '700 13px ui-monospace, monospace';
    context.fillStyle = light ? '#35594b' : '#93b5a7';
    context.fillText('ZENTRA', geometry.left + 7, geometry.top + geometry.height - 12);
    context.font = '11px Inter, system-ui, sans-serif';
    context.fillStyle = muted;
    context.fillText(
      `${symbol} · ${history?.currency || ''}`,
      geometry.left + 70,
      geometry.top + geometry.height - 12,
    );
  }, [
    ordered,
    visibleView.from,
    visibleView.count,
    size,
    mode,
    indicators,
    volume,
    log,
    hover,
    drawings,
    draft,
    selectedDrawing,
    showDrawings,
    magnet,
    locale,
    light,
    range,
    interval,
    symbol,
    history?.currency,
  ]);
  const exportImage = () => {
    setImageError('');
    try {
      const anchor = document.createElement('a');
      anchor.download = `zentra-${symbol.replace(/[^a-z0-9]/gi, '-')}-${interval}-${range}.png`;
      anchor.href = canvas.current!.toDataURL('image/png');
      anchor.click();
    } catch {
      setImageError('Could not export the chart image.');
    }
  };
  const reset = () => setView({ from: 0, count: ordered.length });
  const chosenDrawing = drawings.find((drawing) => drawing.id === selectedDrawing);
  const editDrawing = (changes: Partial<Drawing>) => {
    if (selectedDrawing)
      saveDrawings(
        drawings.map((drawing) =>
          drawing.id === selectedDrawing ? { ...drawing, ...changes } : drawing,
        ),
      );
  };
  const deleteDrawing = () => {
    if (selectedDrawing) saveDrawings(drawings.filter((drawing) => drawing.id !== selectedDrawing));
    setSelectedDrawing(null);
    setDrawingSettings(false);
  };
  const showIndicator = (id?: IndicatorId) => {
    setIndicatorFocus(id);
    setIndicatorOpen(true);
  };
  const localPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };
  return (
    <I18n.section
      className={`zentra-chart terminal-panel overflow-hidden ${large ? 'zentra-chart-large' : ''} ${expanded ? 'zentra-chart-expanded' : ''}`}
      aria-label={`${symbol} financial chart`}
    >
      <I18n.div className="zentra-chart-topbar flex min-h-12 items-center justify-between gap-2 border-b border-border-accent px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-1">
          <I18n.select
            aria-label="Candle interval"
            value={interval}
            disabled={!!fixture}
            onChange={(event) => setInterval(event.target.value as HistoryInterval)}
            className="chart-control max-w-20 bg-transparent font-semibold"
          >
            <I18n.option value="1h">1H</I18n.option>
            <I18n.option value="4h">4H</I18n.option>
            <I18n.option value="1d">1D</I18n.option>
            <I18n.option value="1w">1W</I18n.option>
            <I18n.option value="1mo">1M</I18n.option>
          </I18n.select>
          <span className="mx-1 h-5 w-px bg-border-accent" />
          <I18n.select
            aria-label="Chart style"
            value={mode}
            onChange={(event) => setMode(event.target.value as typeof mode)}
            className="chart-control max-w-24 bg-transparent"
          >
            <I18n.option value="candle">Candles</I18n.option>
            <I18n.option value="line">Line</I18n.option>
            <I18n.option value="area">Area</I18n.option>
          </I18n.select>
          <I18n.button
            className="chart-control flex items-center gap-1.5"
            aria-label="Indicators"
            onClick={() => showIndicator()}
          >
            <SlidersHorizontal size={15} />
            <span className="hidden sm:inline">
              <UiText>Indicators</UiText>
            </span>
            {!!Object.keys(activeIndicators).length && (
              <span className="text-accent">{Object.keys(activeIndicators).length}</span>
            )}
          </I18n.button>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <I18n.button
            className="chart-control !p-2"
            aria-label="Download chart image"
            disabled={!ordered.length}
            onClick={exportImage}
          >
            <Download size={15} />
          </I18n.button>
          <I18n.button
            className="chart-control !p-2"
            aria-label={expanded ? 'Close expanded chart' : 'Expand chart'}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <X size={15} /> : <Expand size={15} />}
          </I18n.button>
        </div>
      </I18n.div>
      <ChartIndicatorLibrary
        active={activeIndicators}
        onChange={setActiveIndicators}
        intraday={intraday}
        hasVolume={hasVolume}
        open={indicatorOpen}
        onClose={() => setIndicatorOpen(false)}
        initialIndicator={indicatorFocus}
      />
      <div className="zentra-chart-body flex min-h-0 flex-1">
        <div className="chart-drawing-tools flex shrink-0 flex-col gap-1 border-r border-border-accent px-1 py-3">
          {[
            { id: 'cursor', label: 'Crosshair and pan', icon: MousePointer2 },
            { id: 'trend', label: 'Trend line', icon: MoveUpRight },
            { id: 'horizontal', label: 'Horizontal line', icon: Minus },
            { id: 'fibonacci', label: 'Fibonacci retracement', icon: FibonacciIcon },
            { id: 'measure', label: 'Measure change', icon: Ruler },
          ].map((item) => (
            <I18n.button
              key={item.id}
              className={`chart-control !p-2 ${tool === item.id ? 'active' : ''}`}
              aria-label={item.label}
              title={item.label}
              aria-pressed={tool === item.id}
              onClick={() => {
                setTool(item.id as Tool);
                setDraft(null);
              }}
            >
              <item.icon size={15} />
            </I18n.button>
          ))}
          <I18n.button
            className="chart-control !mt-3 !p-2"
            aria-label="Undo drawing"
            title="Undo drawing"
            disabled={!drawings.length && !draft}
            onClick={() => {
              if (draft) setDraft(null);
              else saveDrawings(drawings.slice(0, -1));
            }}
          >
            <Undo2 size={15} />
          </I18n.button>
          <span className="my-2 h-px bg-border-accent" />
          <I18n.button
            className={`chart-control !p-2 ${magnet ? 'active' : ''}`}
            aria-label="Snap to candle prices"
            title="Snap to candle prices"
            aria-pressed={magnet}
            onClick={() => setMagnet(!magnet)}
          >
            <Magnet size={15} />
          </I18n.button>
          <I18n.button
            className="chart-control !p-2"
            aria-label={showDrawings ? 'Hide drawings' : 'Show drawings'}
            title={showDrawings ? 'Hide drawings' : 'Show drawings'}
            aria-pressed={showDrawings}
            onClick={() => setShowDrawings(!showDrawings)}
          >
            {showDrawings ? <Eye size={15} /> : <EyeOff size={15} />}
          </I18n.button>
          <I18n.button
            className="chart-control !p-2"
            aria-label="Delete selected drawing"
            title="Delete selected drawing"
            disabled={!chosenDrawing}
            onClick={deleteDrawing}
          >
            <Trash2 size={15} />
          </I18n.button>
        </div>
        <div
          ref={host}
          className="zentra-chart-surface relative min-w-0 flex-1"
          style={{ minHeight: 280 + panes.length * paneHeight + (volume ? 70 : 0) }}
          data-chart-view={`${visibleView.from}:${visibleView.count}`}
          data-chart-interval={interval}
          data-candle-count={ordered.length}
          data-first-candle={ordered[0]?.timestamp}
          data-drawing-count={drawings.length}
          data-selected-drawing={selectedDrawing || ''}
        >
          <div
            className="chart-ohlc pointer-events-none absolute left-3 right-20 top-2 z-10 flex items-center gap-2 overflow-hidden whitespace-nowrap text-[10px] tabular-nums text-text-dim"
            aria-live="off"
          >
            <span className="font-medium text-text-main">{symbol}</span>
            {selected && (
              <>
                <span>O {format(selected.open)}</span>
                <span>H {format(selected.high)}</span>
                <span>L {format(selected.low)}</span>
                <span className={selected.close >= selected.open ? 'text-accent' : 'text-loss'}>
                  C {format(selected.close)}
                </span>
                <span className="hidden sm:inline">
                  V{' '}
                  {selected.volume === null
                    ? '—'
                    : new Intl.NumberFormat(locale, {
                        notation: 'compact',
                        maximumFractionDigits: 1,
                      }).format(selected.volume)}
                </span>
              </>
            )}
          </div>
          <div
            className="chart-active-indicators pointer-events-none absolute inset-0 z-10"
            aria-label={text('Active indicators')}
          >
            <div className="pointer-events-auto absolute left-3 right-24 top-7 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
              {indicators
                .filter((indicator) => !indicator.pane)
                .map((indicator) => (
                  <span key={indicator.id} className="flex items-center gap-1 text-text-dim">
                    <span>
                      <UiText>{indicator.label}</UiText>{' '}
                      {!['vwap', 'ichimoku'].includes(indicator.id)
                        ? indicator.settings.period
                        : ''}
                    </span>
                    <span style={{ color: indicator.result.lines[0]?.color }}>
                      {indicator.result.lines[0]?.values[
                        hover?.index ?? visibleView.from + visibleView.count - 1
                      ] == null
                        ? '—'
                        : formatIndicator(
                            indicator.result.lines[0].values[
                              hover?.index ?? visibleView.from + visibleView.count - 1
                            ]!,
                          )}
                    </span>
                    <I18n.button
                      aria-label={`Settings ${indicator.label}`}
                      className="opacity-60 hover:opacity-100"
                      onClick={() => showIndicator(indicator.id)}
                    >
                      <Settings2 size={11} />
                    </I18n.button>
                    <I18n.button
                      aria-label={`Remove ${indicator.label}`}
                      className="opacity-60 hover:opacity-100"
                      onClick={() => {
                        const next = { ...activeIndicators };
                        delete next[indicator.id];
                        setActiveIndicators(next);
                      }}
                    >
                      <X size={11} />
                    </I18n.button>
                  </span>
                ))}
            </div>
            {panes.map((pane, index) => (
              <div
                key={pane.id}
                className="pointer-events-auto absolute right-24 flex items-center gap-2 text-[10px] text-text-dim"
                style={{
                  top: geometry.top + geometry.height + (volume ? 76 : 10) + index * paneHeight - 2,
                }}
              >
                <span>
                  <UiText>{pane.label}</UiText> {pane.settings.period}
                </span>
                <I18n.button
                  aria-label={`Settings ${pane.label}`}
                  onClick={() => showIndicator(pane.id)}
                >
                  <Settings2 size={12} />
                </I18n.button>
                <I18n.button
                  aria-label={`Remove ${pane.label}`}
                  onClick={() => {
                    const next = { ...activeIndicators };
                    delete next[pane.id];
                    setActiveIndicators(next);
                  }}
                >
                  <X size={12} />
                </I18n.button>
              </div>
            ))}
          </div>
          {chosenDrawing && showDrawings && (
            <div
              className="absolute right-24 top-20 z-20 flex items-center gap-1 rounded border border-border-accent bg-bg/95 p-1 shadow-lg"
              aria-label={text('Selected drawing')}
            >
              <span className="px-2 text-xs text-text-dim">
                <UiText>
                  {chosenDrawing.kind === 'fibonacci'
                    ? 'Fibonacci'
                    : chosenDrawing.kind === 'trend'
                      ? 'Trend line'
                      : chosenDrawing.kind === 'horizontal'
                        ? 'Horizontal line'
                        : 'Measure change'}
                </UiText>
              </span>
              {chosenDrawing.kind === 'fibonacci' && (
                <I18n.button
                  className="chart-control !p-1.5"
                  aria-label="Fibonacci settings"
                  onClick={() => setDrawingSettings(!drawingSettings)}
                >
                  <Settings2 size={14} />
                </I18n.button>
              )}
              <I18n.button
                className="chart-control !p-1.5"
                aria-label="Delete selected drawing"
                onClick={deleteDrawing}
              >
                <Trash2 size={14} />
              </I18n.button>
              <I18n.button
                className="chart-control !p-1.5"
                aria-label="Deselect drawing"
                onClick={() => {
                  setSelectedDrawing(null);
                  setDrawingSettings(false);
                }}
              >
                <X size={14} />
              </I18n.button>
            </div>
          )}
          {chosenDrawing?.kind === 'fibonacci' && drawingSettings && (
            <div
              className="absolute right-3 top-32 z-30 w-[min(300px,90%)] rounded border border-border-accent bg-bg p-4 shadow-xl"
              role="dialog"
              aria-label={text('Fibonacci settings')}
            >
              <header className="mb-3 flex items-center justify-between">
                <I18n.h3 className="text-sm font-semibold text-text-main">
                  Fibonacci retracement
                </I18n.h3>
                <I18n.button
                  aria-label="Close drawing settings"
                  onClick={() => setDrawingSettings(false)}
                >
                  <X size={15} />
                </I18n.button>
              </header>
              <I18n.p className="mb-2 text-xs text-text-dim">Levels</I18n.p>
              <div className="grid grid-cols-3 gap-2">
                {fibonacciLevels.map((ratio) => (
                  <label key={ratio} className="flex items-center gap-2 text-xs text-text-main">
                    <input
                      type="checkbox"
                      aria-label={`Fibonacci level ${ratio}`}
                      checked={(chosenDrawing.levels || fibonacciLevels).includes(ratio)}
                      onChange={(event) => {
                        const current = chosenDrawing.levels || fibonacciLevels;
                        editDrawing({
                          levels: event.target.checked
                            ? [...current, ratio].sort((a, b) => a - b)
                            : current.length > 1
                              ? current.filter((level) => level !== ratio)
                              : current,
                        });
                      }}
                    />
                    {ratio}
                  </label>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-text-dim">
                <UiText>Custom level</UiText>
                <input
                  type="number"
                  min="-5"
                  max="5"
                  step="0.001"
                  aria-label={text('Custom Fibonacci level')}
                  className="min-w-0 flex-1 rounded border border-border-accent bg-surface p-1.5 text-text-main"
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    const value = Number(event.currentTarget.value);
                    if (
                      event.currentTarget.value &&
                      Number.isFinite(value) &&
                      value >= -5 &&
                      value <= 5
                    )
                      editDrawing({
                        levels: [...new Set([...(chosenDrawing.levels || fibonacciLevels), value])]
                          .sort((a, b) => a - b)
                          .slice(0, 20),
                      });
                    event.currentTarget.value = '';
                  }}
                  placeholder={text('Enter to add')}
                />
              </label>
              {(chosenDrawing.levels || [])
                .filter((level) => !fibonacciLevels.includes(level))
                .map((level) => (
                  <I18n.button
                    key={level}
                    className="chart-control mt-2 mr-1"
                    aria-label={`Remove Fibonacci level ${level}`}
                    onClick={() =>
                      editDrawing({
                        levels: chosenDrawing.levels!.filter((ratio) => ratio !== level),
                      })
                    }
                  >
                    {level} ×
                  </I18n.button>
                ))}
              <div className="mt-3 space-y-2 border-t border-border-accent pt-3 text-xs text-text-main">
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={chosenDrawing.extendRight !== false}
                    onChange={(event) => editDrawing({ extendRight: event.target.checked })}
                  />
                  <UiText>Extend right</UiText>
                </label>
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={!!chosenDrawing.reverse}
                    onChange={(event) => editDrawing({ reverse: event.target.checked })}
                  />
                  <UiText>Reverse levels</UiText>
                </label>
                <label className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={!!chosenDrawing.logarithmic}
                    onChange={(event) => editDrawing({ logarithmic: event.target.checked })}
                  />
                  <UiText>Calculate levels logarithmically</UiText>
                </label>
                <label className="flex items-center justify-between">
                  <UiText>Line color</UiText>
                  <input
                    type="color"
                    aria-label={text('Drawing color')}
                    value={chosenDrawing.color || '#9598cc'}
                    onChange={(event) => editDrawing({ color: event.target.value })}
                    className="h-6 w-9 bg-transparent"
                  />
                </label>
              </div>
              <I18n.button
                className="chart-control mt-3"
                onClick={() =>
                  editDrawing({
                    levels: [...fibonacciLevels],
                    color: undefined,
                    extendRight: true,
                    reverse: false,
                    logarithmic: false,
                  })
                }
              >
                Reset Fibonacci
              </I18n.button>
            </div>
          )}
          {ordered.length ? (
            <canvas
              ref={canvas}
              className={`h-full w-full touch-none ${tool === 'cursor' ? 'cursor-crosshair' : 'cursor-cell'}`}
              role="img"
              tabIndex={0}
              aria-label={`${symbol} ${text('Zentra price chart')}`}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                const position = localPoint(event);
                const hit = tool === 'cursor' ? drawingHit(position.x, position.y) : null;
                if (hit) {
                  setSelectedDrawing(hit.drawing.id);
                  drawingGesture.current = {
                    id: hit.drawing.id,
                    part: hit.part,
                    start: position,
                    original: hit.drawing,
                    moved: false,
                  };
                  panStart.current = null;
                } else {
                  if (tool === 'cursor') {
                    setSelectedDrawing(null);
                    setDrawingSettings(false);
                  }
                  panStart.current = { x: position.x, view: visibleView, moved: false };
                }
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                const position = localPoint(event);
                const index = Math.max(
                  0,
                  Math.min(
                    ordered.length - 1,
                    visibleView.from + Math.floor((position.x - geometry.left) / step),
                  ),
                );
                setHover({ ...position, index });
                const gesture = drawingGesture.current;
                if (gesture) {
                  if (
                    Math.hypot(position.x - gesture.start.x, position.y - gesture.start.y) < 3 &&
                    !gesture.moved
                  )
                    return;
                  gesture.moved = true;
                  let moved: Drawing;
                  if (gesture.part === 'body') {
                    const startPrice = yPrice(
                        gesture.start.y,
                        domain,
                        geometry.top,
                        geometry.height,
                      ),
                      endPrice = yPrice(position.y, domain, geometry.top, geometry.height);
                    moved = moveDrawing(
                      gesture.original,
                      ordered,
                      (position.x - gesture.start.x) / step,
                      log ? Math.log(endPrice / startPrice) : endPrice - startPrice,
                      log,
                    );
                  } else {
                    const point = pointAt(position.x, position.y);
                    if (!point) return;
                    moved = { ...gesture.original, [gesture.part]: point };
                  }
                  const next = drawingsRef.current.map((drawing) =>
                    drawing.id === gesture.id ? moved : drawing,
                  );
                  drawingsRef.current = next;
                  setDrawings(next);
                } else if (tool === 'cursor' && panStart.current) {
                  const delta = position.x - panStart.current.x;
                  if (Math.abs(delta) > 3) {
                    panStart.current.moved = true;
                    setView(
                      clampChartView(ordered.length, {
                        ...panStart.current.view,
                        from: panStart.current.view.from - delta / step,
                      }),
                    );
                  }
                }
                if (tool === 'cursor')
                  event.currentTarget.style.cursor = drawingGesture.current
                    ? 'grabbing'
                    : drawingHit(position.x, position.y)
                      ? 'grab'
                      : 'crosshair';
              }}
              onPointerUp={(event) => {
                const wasMoved = panStart.current?.moved;
                panStart.current = null;
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
                if (drawingGesture.current) {
                  if (drawingGesture.current.moved) saveDrawings(drawingsRef.current);
                  drawingGesture.current = null;
                  return;
                }
                if (tool === 'cursor' || wasMoved) return;
                const position = localPoint(event),
                  point = pointAt(position.x, position.y);
                if (
                  position.y < geometry.top ||
                  position.x < geometry.left ||
                  position.y > geometry.top + geometry.height ||
                  position.x > geometry.left + geometry.width
                )
                  return;
                if (!point) return;
                if (tool === 'horizontal') {
                  const drawing: Drawing = {
                    id: crypto.randomUUID(),
                    kind: 'horizontal',
                    a: point,
                  };
                  saveDrawings([...drawings, drawing]);
                  setSelectedDrawing(drawing.id);
                  setTool('cursor');
                } else if (!draft)
                  setDraft({
                    id: crypto.randomUUID(),
                    kind: tool,
                    a: point,
                    ...(tool === 'fibonacci'
                      ? { levels: [...fibonacciLevels], extendRight: true }
                      : {}),
                  });
                else {
                  saveDrawings([...drawings, { ...draft, b: point }]);
                  setSelectedDrawing(draft.id);
                  setDraft(null);
                  setTool('cursor');
                }
              }}
              onPointerCancel={() => {
                panStart.current = null;
                if (drawingGesture.current) {
                  const gesture = drawingGesture.current;
                  setDrawings(
                    drawingsRef.current.map((drawing) =>
                      drawing.id === gesture.id ? gesture.original : drawing,
                    ),
                  );
                  drawingGesture.current = null;
                }
              }}
              onPointerLeave={() => {
                if (!panStart.current && !drawingGesture.current) setHover(null);
              }}
              onDoubleClick={reset}
              onKeyDown={(event) => {
                if ((event.key === 'Delete' || event.key === 'Backspace') && selectedDrawing) {
                  event.preventDefault();
                  deleteDrawing();
                }
                if (event.key === '+' || event.key === '=')
                  setView(zoomChartView(ordered.length, visibleView, 1.35));
                if (event.key === '-')
                  setView(zoomChartView(ordered.length, visibleView, 1 / 1.35));
                if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                  event.preventDefault();
                  setView(
                    clampChartView(ordered.length, {
                      ...visibleView,
                      from:
                        visibleView.from +
                        (event.key === 'ArrowLeft' ? -1 : 1) *
                          Math.max(1, Math.round(visibleView.count / 10)),
                    }),
                  );
                }
              }}
            />
          ) : (
            <I18n.div
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center text-sm text-text-dim"
              role="status"
            >
              <ChartCandlestick size={30} className="opacity-40" />
              <I18n.p>
                {query.isPending
                  ? 'Loading provider candles…'
                  : 'Historical data is unavailable for this asset. No synthetic chart is shown.'}
              </I18n.p>
              {!query.isPending && (
                <I18n.button className="chart-control" onClick={() => void query.refetch()}>
                  Retry chart data
                </I18n.button>
              )}
            </I18n.div>
          )}
        </div>
      </div>
      <div className="zentra-chart-bottom-bar flex items-center justify-between gap-1 border-t border-border-accent px-2 py-1">
        <div className="flex min-w-0 items-center gap-0.5 overflow-x-auto">
          {ranges.map((item) => (
            <I18n.button
              key={item}
              onClick={() => setRange(item)}
              disabled={Boolean(fixture) && item !== '1M'}
              aria-pressed={range === item}
              className={'chart-control shrink-0 !px-2 !py-1 ' + (range === item ? 'active' : '')}
            >
              {item === 'MAX' ? 'All history' : item}
            </I18n.button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <I18n.button
            className="chart-control !p-1.5"
            aria-label="Zoom out chart"
            disabled={!ordered.length}
            onClick={() => setView(zoomChartView(ordered.length, visibleView, 1 / 1.35))}
          >
            <Minus size={13} />
          </I18n.button>
          <I18n.button
            className="chart-control !p-1.5"
            aria-label="Zoom in chart"
            disabled={!ordered.length}
            onClick={() => setView(zoomChartView(ordered.length, visibleView, 1.35))}
          >
            <Plus size={13} />
          </I18n.button>
          <I18n.button
            className="chart-control !p-1.5"
            aria-label="Reset chart view"
            onClick={reset}
          >
            <RotateCcw size={13} />
          </I18n.button>
          <I18n.button
            className={'chart-control !px-2 !py-1 ' + (log ? 'active' : '')}
            aria-label="Logarithmic price scale"
            aria-pressed={log}
            onClick={() => setLog(!log)}
          >
            Log
          </I18n.button>
          <I18n.button
            className={
              'chart-control hidden !px-2 !py-1 sm:inline-flex ' + (volume ? 'active' : '')
            }
            aria-label="Show volume"
            aria-pressed={volume}
            onClick={() => setVolume(!volume)}
          >
            Volume
          </I18n.button>
        </div>
      </div>
      <I18n.footer className="zentra-chart-footer flex items-center justify-between gap-2 border-t border-border-accent px-3 py-1.5 text-[10px] text-text-dim">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap">
          <span className="font-medium text-text-main">ZENTRA</span>
          <UiText>
            {fixture ? 'DEMO DATA' : history?.stale ? 'Stale' : history?.status || 'Unavailable'}
          </UiText>
          <span>· {history?.provider || '—'} · UTC</span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {!large && !fixture && (
            <Link
              to={'/charts?symbol=' + encodeURIComponent(symbol) + '&type=' + type}
              className="text-accent"
            >
              <UiText>Open full chart</UiText>
            </Link>
          )}
          <details className="chart-history-tools relative">
            <I18n.summary
              className="cursor-pointer list-none text-text-main"
              aria-label="History tools"
            >
              History tools
            </I18n.summary>
            <div className="absolute bottom-full right-0 z-30 mb-2 w-[min(360px,90vw)] rounded border border-border-accent bg-bg p-3 text-xs shadow-xl">
              <div className="mb-3 grid grid-cols-2 gap-1">
                <I18n.button
                  className="chart-control"
                  disabled={!ordered.length}
                  onClick={() => setView({ from: 0, count: Math.min(180, ordered.length) })}
                >
                  Go to first candle
                </I18n.button>
                <I18n.button
                  className="chart-control"
                  disabled={!ordered.length}
                  onClick={() =>
                    setView({
                      from: Math.max(0, ordered.length - 180),
                      count: Math.min(180, ordered.length),
                    })
                  }
                >
                  Latest candles
                </I18n.button>
                <I18n.button className="chart-control" disabled={!ordered.length} onClick={reset}>
                  Fit entire history
                </I18n.button>
                <I18n.button
                  className="chart-control"
                  aria-pressed={volume}
                  onClick={() => setVolume(!volume)}
                >
                  Volume
                </I18n.button>
                {query.hasNextPage && (
                  <I18n.button
                    className="chart-control col-span-2"
                    disabled={query.isFetchingNextPage}
                    onClick={() => void query.fetchNextPage()}
                  >
                    {query.isFetchingNextPage ? 'Loading older candles…' : 'Load older candles'}
                  </I18n.button>
                )}
              </div>
              <div
                className="space-y-2 text-[11px] leading-relaxed text-text-dim"
                aria-label={text('History coverage')}
              >
                <p>
                  <UiText>Available candles</UiText>: {ordered.length.toLocaleString(locale)} ·{' '}
                  {ordered[0]
                    ? new Date(ordered[0].timestamp).toLocaleDateString(locale, { timeZone: 'UTC' })
                    : '—'}{' '}
                  →{' '}
                  {ordered.at(-1)
                    ? new Date(ordered.at(-1)!.timestamp).toLocaleDateString(locale, {
                        timeZone: 'UTC',
                      })
                    : '—'}
                </p>
                <I18n.p>
                  {query.hasNextPage
                    ? 'More history can be loaded.'
                    : intraday
                      ? 'Hourly history is limited by the provider; it may not reach the first trading date.'
                      : 'History starts at the first observation available from this provider.'}
                </I18n.p>
                {history?.aggregation === 'session-4h' && (
                  <I18n.p>
                    4-hour candles combine hourly bars within each exchange session; the last bar
                    may be shorter.
                  </I18n.p>
                )}
                {history?.aggregation === 'utc-4h' && (
                  <I18n.p>4-hour candles combine hourly bars into UTC blocks.</I18n.p>
                )}
                {query.isFetchNextPageError && (
                  <I18n.p role="alert" className="text-loss">
                    Older candles are temporarily unavailable. Retry after the provider resets its
                    quota.
                  </I18n.p>
                )}
                <p>
                  {history?.updatedAt ? new Date(history.updatedAt).toLocaleString(locale) : '—'}
                </p>
              </div>
            </div>
          </details>
        </div>
      </I18n.footer>
      {(draft || tool !== 'cursor') && (
        <I18n.p className="px-3 py-2 text-[11px] text-text-dim">
          {tool === 'horizontal'
            ? 'Click the chart to place a price level.'
            : draft
              ? 'Click the second point. Escape cancels.'
              : 'Click two points on the chart.'}
        </I18n.p>
      )}
      {imageError && (
        <I18n.p role="alert" className="px-3 py-2 text-xs text-loss">
          {imageError}
        </I18n.p>
      )}
    </I18n.section>
  );
}
