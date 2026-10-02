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
const money = (value: string | number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
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
    <div className="overflow-x-auto">
      <table className="terminal-table">
        <thead>
          <tr>
            <th>Asset</th>
            <th>Price</th>
            <th>Change</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {items.map((q) => (
            <tr key={q.symbol}>
              <td>
                <button
                  className="flex items-center gap-3 text-left"
                  onClick={() => selectAsset(q)}
                >
                  <CompanyLogo
                    symbol={q.symbol}
                    name={q.name}
                    type={q.type === 'crypto' ? 'crypto' : 'stock'}
                    className="h-9 w-9 rounded-lg"
                  />
                  <span className="font-semibold">
                    {q.symbol}
                    <span className="block text-xs font-normal text-text-dim">{q.name}</span>
                  </span>
                </button>
              </td>
              <td className="font-mono">{money(q.price!)}</td>
              <td className={`font-mono ${Number(q.change) < 0 ? 'text-loss' : 'text-accent'}`}>
                {Number(q.change).toFixed(2)}%
              </td>
              <td>
                <span className="text-[10px] text-amber-300">DEMO DATA</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="demo-shell">
      <aside className="demo-sidebar">
        <Link to="/landing" className="mb-10 flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-9 w-9" />
          <span>
            <strong className="text-xl tracking-tight">{brand.name}</strong>
            <span className="block text-[10px] text-text-dim">{brand.tagline}</span>
          </span>
        </Link>
        <p className="eyebrow mb-3">Workspace</p>
        <nav className="space-y-1">
          {tabs.map((t) => (
            <button
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
            </button>
          ))}
        </nav>
        <div className="mt-auto border-t border-border-accent pt-5">
          <p className="text-sm font-semibold">Explore {brand.name}</p>
          <p className="mb-4 mt-2 text-xs leading-5 text-text-dim">
            An interactive workspace with fictional data. Your real portfolio starts with an
            account.
          </p>
          <Link to="/auth" className="primary-button w-full">
            Create your account <ArrowUpRight size={15} />
          </Link>
        </div>
      </aside>
      <main className="demo-main">
        <div className="demo-notice">
          <span>DEMO DATA · Limited preview · Fictional prices and portfolio</span>
          <div className="flex flex-wrap gap-4">
            <Link to="/landing">View landing page</Link>
            <Link to="/auth">Connect your real portfolio →</Link>
          </div>
        </div>
        <header className="demo-header">
          <div className="relative min-w-0 flex-1 max-w-lg">
            <label className="command-trigger">
              <Search size={16} />
              <input
                className="w-full bg-transparent outline-none"
                aria-label="Search demo assets"
                placeholder="Search assets…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            {search && (
              <div className="absolute top-full z-30 mt-2 w-full rounded-lg border border-border-accent bg-surface p-2 shadow-xl">
                {filtered.map((q) => (
                  <button
                    className="search-result w-full"
                    key={q.symbol}
                    onClick={() => selectAsset(q)}
                  >
                    {q.symbol} · {q.name}
                    <ArrowUpRight size={14} />
                  </button>
                ))}
                {!filtered.length && (
                  <p className="p-3 text-sm text-text-dim">No sample asset matches.</p>
                )}
              </div>
            )}
          </div>
          <span className="hidden sm:block text-xs text-text-dim">Personal workspace</span>
          <Link to="/auth" className="icon-button" aria-label="Sign in">
            ↗
          </Link>
        </header>
        <div className="demo-content">
          <div className="section-heading mb-6">
            <div>
              <p className="eyebrow">
                {tab === 'Overview' ? 'Your financial world, in focus' : brand.name + ' workspace'}
              </p>
              <h1>{tab === 'Overview' ? 'The bigger picture.' : tab}</h1>
              <p className="text-sm text-text-dim">
                {tab === 'Overview'
                  ? 'Follow your capital. Understand the context. See what matters.'
                  : 'Interactive demo · changes stay in this browser session.'}
              </p>
            </div>
            <button className="primary-button" onClick={() => setTab('Transactions')}>
              <Plus size={16} /> Register transaction
            </button>
          </div>
          {status && (
            <p className="status-message mb-5" role="status">
              {status}
            </p>
          )}
          {(tab === 'Overview' || tab === 'Portfolio') && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 mb-6">
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
                  <div className="terminal-panel p-5" key={s.label}>
                    <p className="eyebrow">{s.label}</p>
                    <p
                      className={`mt-3 mb-2 text-[28px] font-mono tracking-tight ${s.label.includes('return') ? 'text-accent' : ''}`}
                    >
                      {money(s.value.toString())}
                    </p>
                    <p className="text-[11px] text-text-dim">{s.sub}</p>
                  </div>
                ))}
              </div>
            </>
          )}
          {tab === 'Overview' && (
            <>
              <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,1fr)]">
                <div className="min-w-0">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex gap-3 items-center">
                      <CompanyLogo
                        symbol={quote.symbol}
                        name={quote.name}
                        type={quote.type === 'crypto' ? 'crypto' : 'stock'}
                        className="h-10 w-10 rounded-lg"
                      />
                      <div>
                        <h2 className="font-semibold">
                          {quote.symbol} <span className="font-normal text-text-dim">/ USD</span>
                        </h2>
                        <p className="text-xs text-text-dim">{quote.name}</p>
                      </div>
                    </div>
                    <p className="font-mono text-xl">{money(quote.price!)}</p>
                  </div>
                  <FinancialChart symbol={quote.symbol} type={quote.type} fixture={fixture} />
                  <div className="mt-2">
                    <DataProvenance quote={quote} />
                  </div>
                </div>
                <section className="terminal-panel min-w-0">
                  <div className="flex justify-between border-b border-border-accent p-4">
                    <h2 className="font-semibold">Your watchlist</h2>
                    <button className="text-xs text-accent" onClick={() => setTab('Watchlists')}>
                      Manage →
                    </button>
                  </div>
                  {marketRows(watched)}
                  <div className="border-t border-border-accent p-5">
                    <p className="eyebrow mb-3">{brand.name} daily brief</p>
                    <p className="text-sm leading-6">
                      Your demo portfolio holds {holdings.length} assets.{' '}
                      {holdings.sort((a, b) => b.value.comparedTo(a.value))[0]?.quote.symbol ||
                        'No asset'}{' '}
                      has the largest allocation. News and social sources require a provider
                      connection.
                    </p>
                    <button
                      className="mt-4 text-xs text-accent"
                      onClick={() => setTab('Intelligence')}
                    >
                      Open intelligence desk →
                    </button>
                  </div>
                </section>
              </div>
              <section className="terminal-panel">
                <div className="border-b border-border-accent p-4">
                  <h2 className="font-semibold">
                    Market overview{' '}
                    <span className="ml-3 text-xs font-normal text-text-dim">Demo fixtures</span>
                  </h2>
                </div>
                {marketRows(demoQuotes)}
              </section>
            </>
          )}
          {tab === 'Portfolio' && (
            <section className="terminal-panel overflow-x-auto">
              <table className="terminal-table">
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Quantity</th>
                    <th>Cost basis</th>
                    <th>Current value</th>
                    <th>Allocation</th>
                    <th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((h) => (
                    <tr key={h.quote.symbol}>
                      <td>
                        <strong>{h.quote.symbol}</strong>
                        <p className="text-xs text-text-dim">{h.quote.name}</p>
                      </td>
                      <td className="font-mono">{h.balance.quantity}</td>
                      <td>{money(h.balance.cost)}</td>
                      <td className="font-mono">{money(h.value.toString())}</td>
                      <td>{value.gt(0) ? h.value.div(value).mul(100).toFixed(1) : '0'}%</td>
                      <td className={h.value.gte(h.balance.cost) ? 'text-accent' : 'text-loss'}>
                        {money(h.value.minus(h.balance.cost).toString())}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
          {tab === 'Watchlists' && (
            <div className="space-y-4">
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!listName.trim()) return;
                  setLists((l) => [...l, { name: listName.trim(), symbols: [] }]);
                  setSelectedList(lists.length);
                  setListName('');
                }}
              >
                <input
                  className="terminal-input"
                  aria-label="New demo watchlist name"
                  placeholder="Name a new watchlist"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                  required
                />
                <button className="primary-button">Create watchlist</button>
              </form>
              <div className="flex flex-wrap gap-2">
                {lists.map((l, i) => (
                  <button
                    className={`chart-control ${i === selectedList ? 'active' : ''}`}
                    onClick={() => setSelectedList(i)}
                    key={i}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
              <section className="terminal-panel">
                <div className="flex flex-wrap justify-between gap-3 border-b border-border-accent p-4">
                  <input
                    className="terminal-input"
                    aria-label="Rename demo watchlist"
                    value={lists[selectedList]?.name || ''}
                    onChange={(e) =>
                      setLists((l) =>
                        l.map((v, i) => (i === selectedList ? { ...v, name: e.target.value } : v)),
                      )
                    }
                  />
                  <select
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
                    <option value="">＋ Add asset</option>
                    {demoQuotes.map((q) => (
                      <option key={q.symbol}>{q.symbol}</option>
                    ))}
                  </select>
                </div>
                {marketRows(watched)}
                <div className="flex flex-wrap gap-2 p-4">
                  {watched.map((q) => (
                    <button
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
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}
          {tab === 'Transactions' && (
            <>
              <form className="terminal-panel p-5 mb-5" onSubmit={trade}>
                <h2 className="mb-5 font-semibold">Register a demo movement</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <label className="field-label">
                    Type
                    <select
                      className="terminal-input"
                      value={kind}
                      onChange={(e) => setKind(e.target.value as TransactionType)}
                    >
                      {['buy', 'sell', 'dividend', 'deposit', 'withdrawal', 'transfer', 'fee'].map(
                        (k) => (
                          <option key={k} value={k}>
                            {k.toUpperCase()}
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                  <label className="field-label">
                    Asset
                    <select className="terminal-input" name="symbol">
                      {demoQuotes.map((q) => (
                        <option key={q.symbol}>{q.symbol}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field-label">
                    Quantity
                    <input
                      className="terminal-input"
                      name="quantity"
                      defaultValue="1"
                      inputMode="decimal"
                      required
                    />
                  </label>
                  <label className="field-label">
                    {kind === 'buy' || kind === 'sell' ? 'Price in USD' : 'Cash amount in USD'}
                    <input className="terminal-input" name="price" inputMode="decimal" required />
                  </label>
                  <label className="field-label">
                    Fee in USD
                    <input
                      className="terminal-input"
                      name="fee"
                      defaultValue="0"
                      inputMode="decimal"
                    />
                  </label>
                </div>
                <button className="primary-button mt-5">Save demo transaction</button>
              </form>
              <section className="terminal-panel overflow-x-auto">
                <table className="terminal-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Asset</th>
                      <th>Quantity</th>
                      <th>Price</th>
                      <th>Fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id}>
                        <td className="uppercase">{t.type}</td>
                        <td>{t.symbol}</td>
                        <td>{t.quantity}</td>
                        <td>{money(t.price)}</td>
                        <td>{money(t.fee)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!transactions.length && (
                  <div className="empty-state">
                    Register a movement to see the position and cash balances update.
                  </div>
                )}
              </section>
            </>
          )}
          {tab === 'Intelligence' && (
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="terminal-panel p-6">
                <p className="eyebrow mb-3">News terminal</p>
                <h2 className="text-xl font-semibold mb-3">Context with a source.</h2>
                <p className="text-sm leading-6 text-text-dim">
                  Your real workspace follows portfolio-related headlines, topics and keywords.
                  Verified reports display the original source, publication time and a link to the
                  full article.
                </p>
                <div className="empty-state !px-0">No live news is loaded in the demo.</div>
              </section>
              <section className="terminal-panel p-6">
                <p className="eyebrow mb-3">Social intelligence</p>
                <h2 className="text-xl font-semibold mb-3">Follow people, not noise.</h2>
                <p className="text-sm leading-6 text-text-dim">
                  Monitor company accounts, journalists and institutions through the official X API.
                  Group, mute and filter your monitored sources.
                </p>
                <div className="empty-state !px-0">
                  An official X API connection is required for posts.
                </div>
              </section>
            </div>
          )}
          {tab === 'Alerts' && (
            <div className="space-y-5">
              <form
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
                <select className="terminal-input" name="symbol" aria-label="Alert asset">
                  {demoQuotes.map((q) => (
                    <option key={q.symbol}>{q.symbol}</option>
                  ))}
                </select>
                <select className="terminal-input" name="condition" aria-label="Alert condition">
                  <option value="above">Price above</option>
                  <option value="below">Price below</option>
                </select>
                <input
                  name="target"
                  className="terminal-input"
                  aria-label="Target price"
                  placeholder="Target price"
                  inputMode="decimal"
                  required
                />
                <button className="primary-button">Create demo alert</button>
              </form>
              <section className="terminal-panel divide-y divide-border-accent">
                {alerts.map((a, i) => {
                  const price = Number(demoQuotes.find((q) => q.symbol === a.symbol)!.price);
                  const triggered =
                    a.condition === 'above' ? price >= Number(a.target) : price <= Number(a.target);
                  return (
                    <div className="flex justify-between p-4" key={i}>
                      <span>
                        {a.symbol} · price {a.condition} {money(a.target)}
                      </span>
                      <span className={triggered ? 'text-accent' : 'text-text-dim'}>
                        {triggered ? 'Triggered on demo quote' : 'Watching demo quote'}
                      </span>
                    </div>
                  );
                })}
                {!alerts.length && (
                  <div className="empty-state">
                    Set a threshold to evaluate it against the fixed demo quotes.
                  </div>
                )}
              </section>
            </div>
          )}
          <footer className="mt-8 border-t border-border-accent pt-4 text-[11px] text-text-dim">
            {brand.name} · {brand.tagline} · All figures on this page are fictional DEMO DATA. No
            external trades or messages are sent.
          </footer>
        </div>
      </main>
      <nav className="demo-mobile-nav">
        {tabs.map((t) => (
          <button
            key={t.name}
            aria-label={t.name}
            className={tab === t.name ? 'text-accent' : 'text-text-dim'}
            onClick={() => setTab(t.name)}
          >
            <t.icon size={17} />
            <span>{t.name}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
