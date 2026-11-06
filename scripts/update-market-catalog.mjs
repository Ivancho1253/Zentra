import { mkdir, writeFile } from 'node:fs/promises';
import readXlsxFile from 'read-excel-file/node';

const holdingsUrl =
  'https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-spy.xlsx';
const sectorsUrl =
  'https://www.ishares.com/us/products/239726/ishares-core-s-p-500-etf/latest-holdings.csv';

function csvRows(source) {
  const rows = [];
  let row = [],
    value = '',
    quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if (char === '\n' && !quoted) {
      row.push(value.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      value = '';
    } else value += char;
  }
  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Holdings source returned HTTP ${response.status}.`);
  return response;
}

const [holdingsResponse, sectorsResponse] = await Promise.all([
  download(holdingsUrl),
  download(sectorsUrl),
]);
const workbook = await readXlsxFile(Buffer.from(await holdingsResponse.arrayBuffer()));
const rows = Array.isArray(workbook[0]) ? workbook : workbook[0].data;
const sectors = new Map(
  csvRows(await sectorsResponse.text())
    .filter((row) => row[3] === 'Equity')
    .map((row) => [
      row[0].replaceAll(' ', '.'),
      row[2] === 'Communication' ? 'Communication Services' : row[2],
    ]),
);
const header = rows.findIndex((row) => row[0] === 'Name' && row[1] === 'Ticker');
if (header < 0) throw new Error('Unexpected holdings format; existing catalog was preserved.');
const assets = rows
  .slice(header + 1)
  .filter(
    (row) =>
      typeof row[1] === 'string' && /^[A-Z][A-Z0-9.\-]{0,9}$/.test(row[1]) && Number(row[4]) > 0,
  )
  .map((row) => ({
    symbol: row[1],
    name: row[0],
    sector: sectors.get(row[1]),
    indexWeight: Number(row[4]),
  }));
if (
  assets.length < 500 ||
  assets.length > 520 ||
  new Set(assets.map((asset) => asset.symbol)).size !== assets.length ||
  assets.some((asset) => !asset.sector)
)
  throw new Error('Incomplete or ambiguous constituent data; existing catalog was preserved.');
const asOfText = String(rows.find((row) => row[0] === 'Holdings:')?.[1] || '');
const date = Date.parse(asOfText.replace(/^As of /, '') + ' UTC');
if (!Number.isFinite(date))
  throw new Error('Holdings date missing; existing catalog was preserved.');
const snapshot = {
  asOf: new Date(date).toISOString().slice(0, 10),
  retrievedAt: new Date().toISOString(),
  source: holdingsUrl,
  sectorSource: sectorsUrl,
  assets,
};
await mkdir('shared/data', { recursive: true });
await writeFile('shared/data/sp500.json', JSON.stringify(snapshot, null, 2) + '\n');
console.log(
  `Updated ${assets.length} S&P 500 equity listings from issuer holdings dated ${snapshot.asOf}.`,
);
