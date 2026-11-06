export interface WeightedItem<T> {
  item: T;
  value: number;
}
export interface MapRectangle<T> extends WeightedItem<T> {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Squarified strips follow the remaining rectangle's shortest side. */
export function treemap<T>(
  items: WeightedItem<T>[],
  width: number,
  height: number,
): MapRectangle<T>[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [];
  const valid = items
    .filter((item) => Number.isFinite(item.value) && item.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = valid.reduce((sum, item) => sum + item.value, 0);
  if (!valid.length || !Number.isFinite(total)) return [];
  const scaled = valid.map((item) => ({ ...item, area: (item.value / total) * width * height }));
  const output: MapRectangle<T>[] = [];
  const remaining = { x: 0, y: 0, width, height };
  const worst = (row: typeof scaled, side: number) => {
    if (!row.length || side <= 0) return Infinity;
    const sum = row.reduce((value, item) => value + item.area, 0);
    return Math.max(
      (side * side * Math.max(...row.map((item) => item.area))) / (sum * sum),
      (sum * sum) / (side * side * Math.min(...row.map((item) => item.area))),
    );
  };
  const place = (row: typeof scaled) => {
    const area = row.reduce((sum, item) => sum + item.area, 0);
    const vertical = remaining.width >= remaining.height;
    const thickness = area / (vertical ? remaining.height : remaining.width);
    let cursor = vertical ? remaining.y : remaining.x;
    for (const entry of row) {
      const length = entry.area / thickness;
      output.push({
        item: entry.item,
        value: entry.value,
        x: vertical ? remaining.x : cursor,
        y: vertical ? cursor : remaining.y,
        width: vertical ? thickness : length,
        height: vertical ? length : thickness,
      });
      cursor += length;
    }
    if (vertical) {
      remaining.x += thickness;
      remaining.width = Math.max(0, remaining.width - thickness);
    } else {
      remaining.y += thickness;
      remaining.height = Math.max(0, remaining.height - thickness);
    }
  };
  let row: typeof scaled = [];
  for (const entry of scaled) {
    const side = Math.min(remaining.width, remaining.height);
    if (row.length && worst([...row, entry], side) > worst(row, side)) {
      place(row);
      row = [];
    }
    row.push(entry);
  }
  if (row.length) place(row);
  return output;
}
export function observedChange(quote: {
  price: string | number | null;
  change: string | number | null;
  stale: boolean;
}): number | null {
  if (
    quote.stale ||
    quote.price === null ||
    !Number.isFinite(Number(quote.price)) ||
    Number(quote.price) <= 0 ||
    quote.change === null
  )
    return null;
  const change = Number(quote.change);
  return Number.isFinite(change) ? change : null;
}
export function heatmapColor(change: number | null): string {
  if (change === null) return '#252e35';
  const strength = Math.min(Math.abs(change) / 3, 1);
  if (Math.abs(change) < 0.05) return '#354347';
  return change >= 0
    ? `rgb(${Math.round(22 - 6 * strength)}, ${Math.round(68 + 63 * strength)}, ${Math.round(54 + 22 * strength)})`
    : `rgb(${Math.round(88 + 75 * strength)}, ${Math.round(42 - 7 * strength)}, ${Math.round(52 - 3 * strength)})`;
}
