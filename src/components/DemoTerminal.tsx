import { useLanguage } from '../contexts/LanguageContext';
import { I18n, UiText } from './Localized';
import {
  Activity,
  ArrowUpRight,
  Bell,
  ChartNoAxesCombined,
  ChevronRight,
  List,
  Plus,
  Radio,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { brand } from '../../shared/brand';
import { demoHistory, demoQuotes } from '../../shared/demo';
import type { AssetQuote } from '../../shared/domain';
import {
  amount,
  applyTrade,
  cashMovement,
  type PositionBalance,
  type TransactionType,
} from '../../shared/finance';
import CompanyLogo from './CompanyLogo';
import DataProvenance from './DataProvenance';
import FinancialChart from './FinancialChart';
import TickerTape from './TickerTape';
const moneyBase = (value: string | number, locale = 'en-US') =>
  new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD' }).format(Number(value));
const initial: Record<string, PositionBalance> = {
  AAPL: { quantity: '20', cost: '4020', realizedPnl: '0' },
  NVDA: { quantity: '40', cost: '4800', realizedPnl: '0' },
  BTC: { quantity: '0.12', cost: '7440', realizedPnl: '0' },
  ETH: { quantity: '1.5', cost: '4950', realizedPnl: '0' },
};
const tabs = [
  { name: 'Overview', icon: Activity },
  { name: 'Portfolio', icon: Wallet },
  { name: 'Watchlists', icon: List },
  { name: 'Transactions', icon: ChartNoAxesCombined },
  { name: 'Intelligence', icon: Radio },
  { name: 'Alerts', icon: Bell },
];
export default function DemoTerminal() {
  const money = (value: string | number) => moneyBase(value, locale);
  const { locale } = useLanguage();
  const [tab, setTab] = useState('Overview'),
    [positions, setPositions] = useState(initial),
    [cash, setCash] = useState('3200');
  const [lists, setLists] = useState([
      { name: 'Core watchlist', symbols: ['AAPL', 'NVDA', 'BTC', 'ETH'] },
      { name: 'Digital assets', symbols: ['BTC', 'ETH', 'SOL'] },
    ]),
    [selectedList, setSelectedList] = useState(0),
    [listName, setListName] = useState('');
  const [search, setSearch] = useState(''),
    [selectedAsset, setSelectedAsset] = useState('AAPL'),
    [status, setStatus] = useState(''),
    [kind, setKind] = useState<TransactionType>('buy');
  const [transactions, setTransactions] = useState<
    { id: number; type: string; symbol: string; quantity: string; price: string; fee: string }[]
  >([]);
  const [alerts, setAlerts] = useState<{ symbol: string; condition: string; target: string }[]>([]);
  const quote = demoQuotes.find((q) => q.symbol === selectedAsset)!;
  const holdings = demoQuotes.flatMap((q) =>
    positions[q.symbol] && amount(positions[q.symbol].quantity).gt(0)
      ? [
          {
            quote: q,
            balance: positions[q.symbol],
            value: amount(q.price!).mul(positions[q.symbol].quantity),
          },
        ]
      : [],
  );
  const value = holdings.reduce((sum, h) => sum.plus(h.value), amount(0)),
    cost = holdings.reduce((sum, h) => sum.plus(h.balance.cost), amount(0)),
    pnl = value.minus(cost);
  const realized = Object.values(positions).reduce((sum, p) => sum.plus(p.realizedPnl), amount(0));
  const watched = demoQuotes.filter((q) => lists[selectedList]?.symbols.includes(q.symbol));
  const filtered = demoQuotes.filter((q) =>
    `${q.symbol} ${q.name}`.toLowerCase().includes(search.toLowerCase()),
  );
  const fixture = {
    ...demoHistory,
    symbol: quote.symbol,
    type: quote.type,
    candles: demoHistory.candles.map((c) => {
      const factor = Number(quote.price) / 225.5;
      return {
        ...c,
        open: c.open * factor,
        high: c.high * factor,
        low: c.low * factor,
        close: c.close * factor,
      };
    }),
  };
  function selectAsset(q: AssetQuote) {
    setSelectedAsset(q.symbol);
    setSearch('');
    setTab('Overview');
  }
  const trade = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget,
      data = new FormData(form);
    const symbol = String(data.get('symbol')),
      quantity = kind === 'buy' || kind === 'sell' ? String(data.get('quantity')) : '1',
      price = String(data.get('price')),
      fee = String(data.get('fee') || '0');
    try {
      if (
        amount(quantity).lte(0) ||
        amount(fee).lt(0) ||
        (kind !== 'transfer' && amount(price).lt(0))
      )
        throw new Error('Enter valid positive amounts.');
      if (kind === 'buy' || kind === 'sell') {
        const next = applyTrade(
          positions[symbol] || { quantity: '0', cost: '0', realizedPnl: '0' },
          { type: kind, quantity, price, fee },
        );
        setPositions((p) => ({ ...p, [symbol]: next }));
      }
      setCash((c) =>
        amount(c)
          .plus(cashMovement({ type: kind, quantity, price, fee }))
          .toString(),
      );
      setTransactions((t) => [
        {
          id: t.length + 1,
          type: kind,
          symbol: kind === 'buy' || kind === 'sell' ? symbol : 'CASH',
          quantity,
          price,
          fee,
        },
        ...t,
      ]);
      setStatus('Demo transaction registered. Position and cash updated with decimal arithmetic.');
      form.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Check the transaction.');
    }
  };
  const marketRows = (items: AssetQuote[]) => (
    <I18n.div className="overflow-x-auto">
      <I18n.table className="terminal-table">
        <I18n.thead>
          <I18n.tr>
            <I18n.th>Asset</I18n.th>
            <I18n.th>Price</I18n.th>
            <I18n.th>Change</I18n.th>
            <I18n.th>Source</I18n.th>
          </I18n.tr>
        </I18n.thead>
        <I18n.tbody>
          {items.map((q) => (
            <I18n.tr key={q.symbol}>
              <I18n.td>
                <I18n.button
                  className="flex items-center gap-3 text-left"
                  onClick={() => selectAsset(q)}
                >
                  <CompanyLogo
                    symbol={q.symbol}
                    name={q.name}
                    type={q.type === 'crypto' ? 'crypto' : 'stock'}
                    className="h-9 w-9 rounded-lg"
                  />
                  <I18n.span className="font-semibold">
                    {q.symbol}
                    <I18n.span className="block text-xs font-normal text-text-dim">
                      {q.name}
                    </I18n.span>
                  </I18n.span>
                </I18n.button>
              </I18n.td>
              <I18n.td className="font-mono">{money(q.price!)}</I18n.td>
              <I18n.td
                className={`font-mono ${Number(q.change) < 0 ? 'text-loss' : 'text-accent'}`}
              >
                {Number(q.change).toFixed(2)}%
              </I18n.td>
              <I18n.td>
                <I18n.span className="text-[10px] text-amber-300">DEMO DATA</I18n.span>
              </I18n.td>
            </I18n.tr>
          ))}
        </I18n.tbody>
      </I18n.table>
    </I18n.div>
  );
  return (
    <I18n.div className="demo-shell">
      <I18n.aside className="demo-sidebar">
        <Link to="/landing" className="mb-10 flex items-center gap-3">
          <I18n.img src="/icon.svg" alt="" className="h-9 w-9" />
          <I18n.span>
            <I18n.strong className="text-xl tracking-tight">{brand.name}</I18n.strong>
            <I18n.span className="block text-[10px] text-text-dim">{brand.tagline}</I18n.span>
          </I18n.span>
        </Link>
        <I18n.p className="eyebrow mb-3">Workspace</I18n.p>
        <I18n.nav className="space-y-1">
          {tabs.map((t) => (
            <I18n.button
              key={t.name}
              className={`demo-nav ${tab === t.name ? 'active' : ''}`}
              onClick={() => {
                setTab(t.name);
                setStatus('');
              }}
            >
              <t.icon size={17} />
              {t.name}
              {tab === t.name && <ChevronRight size={14} className="ml-auto" />}
            </I18n.button>
          ))}
        </I18n.nav>
        <I18n.div className="mt-auto border-t border-border-accent pt-5">
          <I18n.p className="text-sm font-semibold">Explore {brand.name}</I18n.p>
          <I18n.p className="mb-4 mt-2 text-xs leading-5 text-text-dim">
            An interactive workspace with fictional data. Your real portfolio starts with an
            account.
          </I18n.p>
          <Link to="/auth" className="primary-button w-full">
            <UiText>Create your account</UiText>
            <ArrowUpRight size={15} />
          </Link>
        </I18n.div>
      </I18n.aside>
      <I18n.main className="demo-main">
        <I18n.div className="demo-notice">
          <I18n.span>DEMO DATA · Limited preview · Fictional prices and portfolio</I18n.span>
          <I18n.div className="flex flex-wrap gap-4">
            <Link to="/landing">
              <UiText>View landing page</UiText>
            </Link>
            <Link to="/auth">
              <UiText>Connect your real portfolio →</UiText>
            </Link>
          </I18n.div>
        </I18n.div>
        <TickerTape fixture={demoQuotes} onSelect={selectAsset} sticky={false} />
        <I18n.header className="demo-header">
          <I18n.div className="relative min-w-0 flex-1 max-w-lg">
            <I18n.label className="command-trigger">
              <Search size={16} />
              <I18n.input
                className="w-full bg-transparent outline-none"
                aria-label="Search demo assets"
                placeholder="Search assets…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </I18n.label>
            {search && (
              <I18n.div className="absolute top-full z-30 mt-2 w-full rounded-lg border border-border-accent bg-surface p-2 shadow-xl">
                {filtered.map((q) => (
                  <I18n.button
                    className="search-result w-full"
                    key={q.symbol}
                    onClick={() => selectAsset(q)}
                  >
                    {q.symbol} · {q.name}
                    <ArrowUpRight size={14} />
                  </I18n.button>
                ))}
                {!filtered.length && (
                  <I18n.p className="p-3 text-sm text-text-dim">No sample asset matches.</I18n.p>
                )}
              </I18n.div>
            )}
          </I18n.div>
          <I18n.span className="hidden sm:block text-xs text-text-dim">
            Personal workspace
          </I18n.span>
          <Link to="/auth" className="icon-button" aria-label="Sign in">
            ↗
          </Link>
        </I18n.header>
        <I18n.div className="demo-content">
          <I18n.div className="section-heading mb-6">
            <I18n.div>
              <I18n.p className="eyebrow">
                {tab === 'Overview' ? 'Your financial world, in focus' : brand.name + ' workspace'}
              </I18n.p>
              <I18n.h1>{tab === 'Overview' ? 'The bigger picture.' : tab}</I18n.h1>
              <I18n.p className="text-sm text-text-dim">
                {tab === 'Overview'
                  ? 'Follow your capital. Understand the context. See what matters.'
                  : 'Interactive demo · changes stay in this browser session.'}
              </I18n.p>
            </I18n.div>
            <I18n.button className="primary-button" onClick={() => setTab('Transactions')}>
              <Plus size={16} /> Register transaction
            </I18n.button>
          </I18n.div>
          {status && (
            <I18n.p className="status-message mb-5" role="status">
              {status}
            </I18n.p>
          )}
          {(tab === 'Overview' || tab === 'Portfolio') && (
            <>
              <I18n.div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-6">
                {[
                  { label: 'Net worth', value: value.plus(cash), sub: 'Holdings + cash · demo' },
                  {
                    label: 'Unrealized return',
                    value: pnl,
                    sub: `${cost.gt(0) ? pnl.div(cost).mul(100).toFixed(2) : '0'}% vs remaining cost`,
                  },
                  { label: 'Available cash', value: amount(cash), sub: 'Demo USD cash ledger' },
                  { label: 'Realized P&L', value: realized, sub: 'After recorded trading fees' },
                ].map((s) => (
                  <I18n.div className="terminal-panel p-5" key={s.label}>
                    <I18n.p className="eyebrow">{s.label}</I18n.p>
                    <I18n.p
                      className={`mt-3 mb-2 text-[28px] font-mono tracking-tight ${s.label.includes('return') ? 'text-accent' : ''}`}
                    >
                      {money(s.value.toString())}
                    </I18n.p>
                    <I18n.p className="text-[11px] text-text-dim">{s.sub}</I18n.p>
                  </I18n.div>
                ))}
              </I18n.div>
            </>
          )}
          {tab === 'Overview' && (
            <>
              <I18n.div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
                <I18n.div className="min-w-0">
                  <I18n.div className="mb-4 flex items-center justify-between">
                    <I18n.div className="flex gap-3 items-center">
                      <CompanyLogo
                        symbol={quote.symbol}
                        name={quote.name}
                        type={quote.type === 'crypto' ? 'crypto' : 'stock'}
                        className="h-10 w-10 rounded-lg"
                      />
                      <I18n.div>
                        <I18n.h2 className="font-semibold">
                          {quote.symbol}{' '}
                          <I18n.span className="font-normal text-text-dim">/ USD</I18n.span>
                        </I18n.h2>
                        <I18n.p className="text-xs text-text-dim">{quote.name}</I18n.p>
                      </I18n.div>
                    </I18n.div>
                    <I18n.p className="font-mono text-xl">{money(quote.price!)}</I18n.p>
                  </I18n.div>
                  <FinancialChart symbol={quote.symbol} type={quote.type} fixture={fixture} />
                  <I18n.div className="mt-2">
                    <DataProvenance quote={quote} />
                  </I18n.div>
                </I18n.div>
                <I18n.section className="terminal-panel min-w-0">
                  <I18n.div className="flex justify-between border-b border-border-accent p-4">
                    <I18n.h2 className="font-semibold">Your watchlist</I18n.h2>
                    <I18n.button
                      className="text-xs text-accent"
                      onClick={() => setTab('Watchlists')}
                    >
                      Manage →
                    </I18n.button>
                  </I18n.div>
                  {marketRows(watched)}
                  <I18n.div className="border-t border-border-accent p-5">
                    <I18n.p className="eyebrow mb-3">{brand.name} daily brief</I18n.p>
                    <I18n.p className="text-sm leading-6">
                      Your demo portfolio holds {holdings.length} assets.{' '}
                      {holdings.sort((a, b) => b.value.comparedTo(a.value))[0]?.quote.symbol ||
                        'No asset'}{' '}
                      has the largest allocation. News and social sources require a provider
                      connection.
                    </I18n.p>
                    <I18n.button
                      className="mt-4 text-xs text-accent"
                      onClick={() => setTab('Intelligence')}
                    >
                      Open intelligence desk →
                    </I18n.button>
                  </I18n.div>
                </I18n.section>
              </I18n.div>
              <I18n.section className="terminal-panel">
                <I18n.div className="border-b border-border-accent p-4">
                  <I18n.h2 className="font-semibold">
                    Market overview{' '}
                    <I18n.span className="ml-3 text-xs font-normal text-text-dim">
                      Demo fixtures
                    </I18n.span>
                  </I18n.h2>
                </I18n.div>
                {marketRows(demoQuotes)}
              </I18n.section>
            </>
          )}
          {tab === 'Portfolio' && (
            <I18n.section className="terminal-panel overflow-x-auto">
              <I18n.table className="terminal-table">
                <I18n.thead>
                  <I18n.tr>
                    <I18n.th>Position</I18n.th>
                    <I18n.th>Quantity</I18n.th>
                    <I18n.th>Cost basis</I18n.th>
                    <I18n.th>Current value</I18n.th>
                    <I18n.th>Allocation</I18n.th>
                    <I18n.th>P&L</I18n.th>
                  </I18n.tr>
                </I18n.thead>
                <I18n.tbody>
                  {holdings.map((h) => (
                    <I18n.tr key={h.quote.symbol}>
                      <I18n.td>
                        <I18n.strong>{h.quote.symbol}</I18n.strong>
                        <I18n.p className="text-xs text-text-dim">{h.quote.name}</I18n.p>
                      </I18n.td>
                      <I18n.td className="font-mono">{h.balance.quantity}</I18n.td>
                      <I18n.td>{money(h.balance.cost)}</I18n.td>
                      <I18n.td className="font-mono">{money(h.value.toString())}</I18n.td>
                      <I18n.td>
                        {value.gt(0) ? h.value.div(value).mul(100).toFixed(1) : '0'}%
                      </I18n.td>
                      <I18n.td
                        className={h.value.gte(h.balance.cost) ? 'text-accent' : 'text-loss'}
                      >
                        {money(h.value.minus(h.balance.cost).toString())}
                      </I18n.td>
                    </I18n.tr>
                  ))}
                </I18n.tbody>
              </I18n.table>
            </I18n.section>
          )}
          {tab === 'Watchlists' && (
            <I18n.div className="space-y-4">
              <I18n.form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!listName.trim()) return;
                  setLists((l) => [...l, { name: listName.trim(), symbols: [] }]);
                  setSelectedList(lists.length);
                  setListName('');
                }}
              >
                <I18n.input
                  className="terminal-input"
                  aria-label="New demo watchlist name"
                  placeholder="Name a new watchlist"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  required
                />
                <I18n.button className="primary-button">Create watchlist</I18n.button>
              </I18n.form>
              <I18n.div className="flex flex-wrap gap-2">
                {lists.map((l, i) => (
                  <I18n.button
                    className={`chart-control ${i === selectedList ? 'active' : ''}`}
                    onClick={() => setSelectedList(i)}
                    key={i}
                  >
                    {l.name}
                  </I18n.button>
                ))}
              </I18n.div>
              <I18n.section className="terminal-panel">
                <I18n.div className="flex flex-wrap justify-between gap-3 border-b border-border-accent p-4">
                  <I18n.input
                    className="terminal-input"
                    aria-label="Rename demo watchlist"
                    value={lists[selectedList]?.name || ''}
                    onChange={(e) =>
                      setLists((l) =>
                        l.map((v, i) => (i === selectedList ? { ...v, name: e.target.value } : v)),
                      )
                    }
                  />
                  <I18n.select
                    className="terminal-input"
                    aria-label="Add demo watchlist asset"
                    value=""
                    onChange={(e) => {
                      const symbol = e.target.value;
                      setLists((l) =>
                        l.map((v, i) =>
                          i === selectedList
                            ? { ...v, symbols: [...new Set([...v.symbols, symbol])] }
                            : v,
                        ),
                      );
                    }}
                  >
                    <I18n.option value="">＋ Add asset</I18n.option>
                    {demoQuotes.map((q) => (
                      <I18n.option key={q.symbol}>{q.symbol}</I18n.option>
                    ))}
                  </I18n.select>
                </I18n.div>
                {marketRows(watched)}
                <I18n.div className="flex flex-wrap gap-2 p-4">
                  {watched.map((q) => (
                    <I18n.button
                      key={q.symbol}
                      className="quiet-chip"
                      onClick={() =>
                        setLists((l) =>
                          l.map((v, i) =>
                            i === selectedList
                              ? { ...v, symbols: v.symbols.filter((s) => s !== q.symbol) }
                              : v,
                          ),
                        )
                      }
                    >
                      Remove {q.symbol} <X size={12} />
                    </I18n.button>
                  ))}
                </I18n.div>
              </I18n.section>
            </I18n.div>
          )}
          {tab === 'Transactions' && (
            <>
              <I18n.form className="terminal-panel p-5 mb-5" onSubmit={trade}>
                <I18n.h2 className="mb-5 font-semibold">Register a demo movement</I18n.h2>
                <I18n.div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <I18n.label className="field-label">
                    Type
                    <I18n.select
                      className="terminal-input"
                      value={kind}
                      onChange={(e) => setKind(e.target.value as TransactionType)}
                    >
                      {['buy', 'sell', 'dividend', 'deposit', 'withdrawal', 'transfer', 'fee'].map(
                        (k) => (
                          <I18n.option key={k} value={k}>
                            {k.toUpperCase()}
                          </I18n.option>
                        ),
                      )}
                    </I18n.select>
                  </I18n.label>
                  <I18n.label className="field-label">
                    Asset
                    <I18n.select className="terminal-input" name="symbol">
                      {demoQuotes.map((q) => (
                        <I18n.option key={q.symbol}>{q.symbol}</I18n.option>
                      ))}
                    </I18n.select>
                  </I18n.label>
                  <I18n.label className="field-label">
                    Quantity
                    <I18n.input
                      className="terminal-input"
                      name="quantity"
                      defaultValue="1"
                      inputMode="decimal"
                      required
                    />
                  </I18n.label>
                  <I18n.label className="field-label">
                    {kind === 'buy' || kind === 'sell' ? 'Price in USD' : 'Cash amount in USD'}
                    <I18n.input
                      className="terminal-input"
                      name="price"
                      inputMode="decimal"
                      required
                    />
                  </I18n.label>
                  <I18n.label className="field-label">
                    Fee in USD
                    <I18n.input
                      className="terminal-input"
                      name="fee"
                      defaultValue="0"
                      inputMode="decimal"
                    />
                  </I18n.label>
                </I18n.div>
                <I18n.button className="primary-button mt-5">Save demo transaction</I18n.button>
              </I18n.form>
              <I18n.section className="terminal-panel overflow-x-auto">
                <I18n.table className="terminal-table">
                  <I18n.thead>
                    <I18n.tr>
                      <I18n.th>Type</I18n.th>
                      <I18n.th>Asset</I18n.th>
                      <I18n.th>Quantity</I18n.th>
                      <I18n.th>Price</I18n.th>
                      <I18n.th>Fee</I18n.th>
                    </I18n.tr>
                  </I18n.thead>
                  <I18n.tbody>
                    {transactions.map((t) => (
                      <I18n.tr key={t.id}>
                        <I18n.td className="uppercase">{t.type}</I18n.td>
                        <I18n.td>{t.symbol}</I18n.td>
                        <I18n.td>{t.quantity}</I18n.td>
                        <I18n.td>{money(t.price)}</I18n.td>
                        <I18n.td>{money(t.fee)}</I18n.td>
                      </I18n.tr>
                    ))}
                  </I18n.tbody>
                </I18n.table>
                {!transactions.length && (
                  <I18n.div className="empty-state">
                    Register a movement to see the position and cash balances update.
                  </I18n.div>
                )}
              </I18n.section>
            </>
          )}
          {tab === 'Intelligence' && (
            <I18n.div className="grid gap-5 lg:grid-cols-2">
              <I18n.section className="terminal-panel p-6">
                <I18n.p className="eyebrow mb-3">News terminal</I18n.p>
                <I18n.h2 className="text-xl font-semibold mb-3">Context with a source.</I18n.h2>
                <I18n.p className="text-sm leading-6 text-text-dim">
                  Your real workspace follows portfolio-related headlines, topics and keywords.
                  Verified reports display the original source, publication time and a link to the
                  full article.
                </I18n.p>
                <I18n.div className="empty-state !px-0">
                  No live news is loaded in the demo.
                </I18n.div>
              </I18n.section>
              <I18n.section className="terminal-panel p-6">
                <I18n.p className="eyebrow mb-3">Social intelligence</I18n.p>
                <I18n.h2 className="text-xl font-semibold mb-3">Follow people, not noise.</I18n.h2>
                <I18n.p className="text-sm leading-6 text-text-dim">
                  Monitor company accounts, journalists and institutions through the official X API.
                  Group, mute and filter your monitored sources.
                </I18n.p>
                <I18n.div className="empty-state !px-0">
                  An official X API connection is required for posts.
                </I18n.div>
              </I18n.section>
            </I18n.div>
          )}
          {tab === 'Alerts' && (
            <I18n.div className="space-y-5">
              <I18n.form
                className="terminal-panel flex flex-wrap gap-3 p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const data = new FormData(e.currentTarget);
                  if (amount(String(data.get('target'))).lte(0)) {
                    setStatus('Enter a positive price.');
                    return;
                  }
                  setAlerts((a) => [
                    ...a,
                    {
                      symbol: String(data.get('symbol')),
                      condition: String(data.get('condition')),
                      target: String(data.get('target')),
                    },
                  ]);
                }}
              >
                <I18n.select className="terminal-input" name="symbol" aria-label="Alert asset">
                  {demoQuotes.map((q) => (
                    <I18n.option key={q.symbol}>{q.symbol}</I18n.option>
                  ))}
                </I18n.select>
                <I18n.select
                  className="terminal-input"
                  name="condition"
                  aria-label="Alert condition"
                >
                  <I18n.option value="above">Price above</I18n.option>
                  <I18n.option value="below">Price below</I18n.option>
                </I18n.select>
                <I18n.input
                  name="target"
                  className="terminal-input"
                  aria-label="Target price"
                  placeholder="Target price"
                  inputMode="decimal"
                  required
                />
                <I18n.button className="primary-button">Create demo alert</I18n.button>
              </I18n.form>
              <I18n.section className="terminal-panel divide-y divide-border-accent">
                {alerts.map((a, i) => {
                  const price = Number(demoQuotes.find((q) => q.symbol === a.symbol)!.price);
                  const triggered =
                    a.condition === 'above' ? price >= Number(a.target) : price <= Number(a.target);
                  return (
                    <I18n.div className="flex justify-between p-4" key={i}>
                      <I18n.span>
                        {a.symbol} · price {a.condition} {money(a.target)}
                      </I18n.span>
                      <I18n.span className={triggered ? 'text-accent' : 'text-text-dim'}>
                        {triggered ? 'Triggered on demo quote' : 'Watching demo quote'}
                      </I18n.span>
                    </I18n.div>
                  );
                })}
                {!alerts.length && (
                  <I18n.div className="empty-state">
                    Set a threshold to evaluate it against the fixed demo quotes.
                  </I18n.div>
                )}
              </I18n.section>
            </I18n.div>
          )}
          <I18n.footer className="mt-8 border-t border-border-accent pt-4 text-[11px] text-text-dim">
            {brand.name} · {brand.tagline} · All figures on this page are fictional DEMO DATA. No
            external trades or messages are sent.
          </I18n.footer>
        </I18n.div>
      </I18n.main>
      <I18n.nav className="demo-mobile-nav">
        {tabs.map((t) => (
          <I18n.button
            key={t.name}
            aria-label={t.name}
            className={tab === t.name ? 'text-accent' : 'text-text-dim'}
            onClick={() => setTab(t.name)}
          >
            <t.icon size={17} />
            <I18n.span>{t.name}</I18n.span>
          </I18n.button>
        ))}
      </I18n.nav>
    </I18n.div>
  );
}
