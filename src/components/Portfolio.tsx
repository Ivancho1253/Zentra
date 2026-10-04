import { I18n } from './Localized';
import { brand } from '../../shared/brand';
import { collection, doc, limit, onSnapshot, orderBy, query, setDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  Camera,
  Check,
  FileText,
  Filter,
  KeyRound,
  Landmark,
  Plus,
  Search,
  Shield,
  Sparkles,
  TrendingUp,
  Upload,
  Wallet,
  WalletCards,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AssetQuote, Currency } from '../../shared/domain';
import { amount } from '../../shared/finance';
import { trackEvent } from '../lib/analytics';
import { apiFetch } from '../lib/api';
import { errorMessage } from '../lib/errors';
import { auth, db } from '../lib/firebase';
import { readJson } from '../lib/query';
import { calculatePortfolioMetrics, PortfolioPriceSnapshot } from '../services/portfolioService';
import { registerTransaction } from '../services/transactionService';
import { Asset, PortfolioSnapshot, Transaction } from '../types';
import CompanyLogo from './CompanyLogo';
import ReceiptDetails from './ReceiptDetails';
import TrackedWallets, { trackWallet } from './TrackedWallets';
import { useLanguage } from '../contexts/LanguageContext';
import { isWalletAddress, type WalletScan } from '../../shared/wallet';
import DataProvenance from './DataProvenance';

declare global {
  interface Window {
    ethereum?: {
      providers?: Array<{
        isMetaMask?: boolean;
        isCoinbaseWallet?: boolean;
        isRabby?: boolean;
        request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      }>;
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
      isRabby?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
    solana?: {
      isPhantom?: boolean;
      connect: () => Promise<{ publicKey: { toString: () => string } }>;
      disconnect?: () => Promise<void>;
    };
    phantom?: {
      solana?: {
        isPhantom?: boolean;
        connect: () => Promise<{ publicKey: { toString: () => string } }>;
        disconnect?: () => Promise<void>;
      };
    };
    suiWallet?: {
      requestPermissions?: () => Promise<{ accounts?: string[] }>;
      getAccounts?: () => Promise<string[]>;
    };
  }
}

type WalletEcosystem = 'evm' | 'solana' | 'sui';

interface ImportCandidate {
  symbol: string;
  name: string;
  type: 'stock' | 'crypto';
  quantity: string;
  price: string;
  currency?: Currency | '';
  confidence?: number | null;
  notes?: string;
  receipt?: boolean;
  transactionType?: 'buy' | 'sell' | 'unknown';
  tradeDate?: string;
  fee?: string;
  recognized?: boolean;
  currentQuote?: AssetQuote | null;
}

interface MarketSuggestion {
  symbol: string;
  name: string;
  type: 'stock' | 'crypto';
  price?: string | number | null;
}

const getChartDomain = (data: Array<{ value: number }>) => {
  const values = data.map((item) => item.value).filter((value) => Number.isFinite(value));
  if (values.length === 0) return [0, 1] as [number, number];

  const min = Math.min(...values);
  const max = Math.max(...values);
  const spread = Math.max(max - min, Math.abs(max) * 0.015, 1);
  return [Math.max(0, Math.floor(min - spread)), Math.ceil(max + spread)] as [number, number];
};

export default function Portfolio() {
  const { locale } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState('');
  const [formError, setFormError] = useState('');
  const [txSearch, setTxSearch] = useState('');
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'stock' | 'crypto'>('stock');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [marketSuggestions, setMarketSuggestions] = useState<MarketSuggestion[]>([]);
  const [showSymbolSuggestions, setShowSymbolSuggestions] = useState(false);
  const [addMode, setAddMode] = useState<'manual' | 'wallet' | 'screenshot'>('manual');
  const [walletScan, setWalletScan] = useState<WalletScan>();
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [manualCurrency, setManualCurrency] = useState<Currency>('USD');
  const [walletAddress, setWalletAddress] = useState('');
  const [walletStatus, setWalletStatus] = useState('');
  const [walletLoading, setWalletLoading] = useState(false);
  const [selectedWalletIndex, setSelectedWalletIndex] = useState(0);
  const [walletEcosystem, setWalletEcosystem] = useState<WalletEcosystem>('evm');
  const [screenshotStatus, setScreenshotStatus] = useState('');
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([]);
  const [importing, setImporting] = useState(false);
  const [priceSnapshots, setPriceSnapshots] = useState<Record<string, PortfolioPriceSnapshot>>({});
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);

  useEffect(() => {
    if (searchParams.get('addAsset') !== '1') return;

    const nextSymbol = (searchParams.get('symbol') || '').trim().toUpperCase();
    const nextName = (searchParams.get('name') || '').trim();
    const nextType = searchParams.get('type') === 'crypto' ? 'crypto' : 'stock';
    const nextPrice = searchParams.get('price') || '';

    setIsAdding(true);
    setAddMode('manual');
    if (nextSymbol) setSymbol(nextSymbol);
    if (nextName) setName(nextName);
    setType(nextType);
    if (nextPrice && Number.isFinite(Number(nextPrice))) setPrice(nextPrice);
    setQuantity('');
    setFormError('');

    const cleanParams = new URLSearchParams(searchParams);
    cleanParams.delete('addAsset');
    setSearchParams(cleanParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubAssets = onSnapshot(
      query(collection(db, 'users', auth.currentUser.uid, 'assets')),
      (snapshot) => {
        setAssets(snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Asset));
      },
      () => {
        setDataError(
          'Could not load your positions. Check your connection and account permissions.',
        );
        setLoading(false);
      },
    );

    const unsubTx = onSnapshot(
      query(collection(db, 'users', auth.currentUser.uid, 'transactions')),
      (snapshot) => {
        setTransactions(snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Transaction));
        setLoading(false);
      },
      () => {
        setDataError(
          'Could not load your transaction history. Check your connection and account permissions.',
        );
        setLoading(false);
      },
    );

    const unsubSnapshots = onSnapshot(
      query(
        collection(db, 'users', auth.currentUser.uid, 'snapshots'),
        orderBy('date', 'asc'),
        limit(365),
      ),
      (snapshot) => {
        setSnapshots(snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as PortfolioSnapshot));
      },
      (error) => {
        console.warn('Could not load portfolio snapshots:', error);
      },
    );

    return () => {
      unsubAssets();
      unsubTx();
      unsubSnapshots();
    };
  }, []);

  useEffect(() => {
    if (!isAdding || marketSuggestions.length > 0) return;

    const normalizeAsset = (
      asset: Partial<AssetQuote>,
      fallbackType: 'stock' | 'crypto',
    ): MarketSuggestion => ({
      symbol: String(asset?.symbol || '').toUpperCase(),
      name: asset?.name || asset?.symbol || '',
      type: asset?.type === 'crypto' || fallbackType === 'crypto' ? 'crypto' : 'stock',
      price: asset?.price ?? null,
    });

    const fetchSuggestions = async () => {
      try {
        const results = await Promise.allSettled([
          readJson<{ data: AssetQuote[] }>(`/api/market/stocks?t=${Date.now()}`),
          readJson<{ data: AssetQuote[] }>(`/api/market/cryptos?t=${Date.now()}`),
        ]);
        const combined = results
          .flatMap((result, index) =>
            result.status === 'fulfilled'
              ? (result.value.data || []).map((asset) =>
                  normalizeAsset(asset, index === 0 ? 'stock' : 'crypto'),
                )
              : [],
          )
          .filter((asset) => asset.symbol);
        setMarketSuggestions(combined);
      } catch (error) {
        console.error('Could not load asset suggestions:', error);
      }
    };

    fetchSuggestions();
  }, [isAdding, marketSuggestions.length]);

  useEffect(() => {
    if (assets.length === 0) {
      setPriceSnapshots({});
      return;
    }

    let cancelled = false;
    const fetchPortfolioPrices = async () => {
      const results = await Promise.allSettled(
        assets.map(async (asset) => {
          const data = await readJson<AssetQuote>(
            `/api/market/asset?symbol=${encodeURIComponent(asset.symbol)}&type=${asset.type}&t=${Date.now()}`,
          );
          return [asset.symbol.toUpperCase(), data] as const;
        }),
      );

      if (cancelled) return;

      const nextSnapshots: Record<string, PortfolioPriceSnapshot> = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const [assetSymbol, snapshot] = result.value;
          nextSnapshots[assetSymbol] = snapshot;
        }
      });
      setPriceSnapshots((previous) => ({
        ...Object.fromEntries(
          Object.entries(previous).map(([key, value]) => [key, { ...value, stale: true }]),
        ),
        ...nextSnapshots,
      }));
    };

    fetchPortfolioPrices().catch((error) => {
      console.error('Could not refresh portfolio prices:', error);
    });

    const interval = window.setInterval(fetchPortfolioPrices, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [assets]);

  const portfolioMetrics = calculatePortfolioMetrics(assets, priceSnapshots);
  const totalValue = portfolioMetrics.totalCurrentValue;
  const totalCost = portfolioMetrics.totalCost;
  const totalPnl = portfolioMetrics.totalPnl;
  const totalPnlPercent = portfolioMetrics.totalPnlPercent;
  const dailyChange = portfolioMetrics.estimatedDailyChange;
  const dailyChangePercent = portfolioMetrics.estimatedDailyChangePercent;
  const hasLivePortfolioPrices = portfolioMetrics.livePricedCount > 0;
  const holdingMetricsBySymbol = new Map(
    portfolioMetrics.holdings.map((holding) => [holding.asset.symbol.toUpperCase(), holding]),
  );

  useEffect(() => {
    if (!auth.currentUser || assets.length === 0 || portfolioMetrics.totalCurrentValue <= 0) return;

    const snapshotDate = new Date().toISOString().slice(0, 10);
    const snapshotRef = doc(db, 'users', auth.currentUser.uid, 'snapshots', snapshotDate);

    setDoc(
      snapshotRef,
      {
        date: snapshotDate,
        currency: 'USD',
        estimated:
          portfolioMetrics.holdings.some((h) => h.isEstimated) ||
          assets.some((a) => a.currency && a.currency !== 'USD'),
        providers: [...new Set(portfolioMetrics.holdings.map((h) => h.source))],
        quotedAt: portfolioMetrics.holdings.find((h) => h.updatedAt)?.updatedAt || null,
        totalValue: portfolioMetrics.totalCurrentValue,
        totalCost: portfolioMetrics.totalCost,
        totalPnl: portfolioMetrics.totalPnl,
        totalPnlPercent: portfolioMetrics.totalPnlPercent,
        livePricedCount: portfolioMetrics.livePricedCount,
        holdingsCount: assets.length,
        createdAt: new Date().toISOString(),
      },
      { merge: true },
    ).catch((error) => {
      console.warn('Could not save daily portfolio snapshot:', error);
    });
  }, [
    assets.length,
    portfolioMetrics.totalCurrentValue,
    portfolioMetrics.totalCost,
    portfolioMetrics.totalPnl,
    portfolioMetrics.totalPnlPercent,
    portfolioMetrics.livePricedCount,
  ]);
  const chartData = snapshots
    .filter((s) => s.kind !== 'net-worth')
    .map((snapshot) => ({
      name: new Date(`${snapshot.date}T00:00:00`).toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
      }),
      value: snapshot.totalValue,
    }));
  const hasValueHistory = chartData.length >= 2;
  const chartTrendPositive = hasValueHistory
    ? chartData[chartData.length - 1].value >= chartData[0].value
    : true;
  const chartColor = chartTrendPositive ? 'var(--accent)' : 'var(--loss)';
  const chartDomain = getChartDomain(chartData);

  const formatMoney = (value: number, currency = 'USD') => {
    if (!Number.isFinite(value)) return '$0.00';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null || !Number.isFinite(value)) return 'N/A';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  };

  const symbolQuery = symbol.trim().toUpperCase();
  const filteredSymbolSuggestions = symbolQuery
    ? marketSuggestions
        .filter((asset) => {
          const name = asset.name.toLowerCase();
          const query = symbolQuery.toLowerCase();
          return asset.symbol.toLowerCase().startsWith(query) || name.includes(query);
        })
        .sort((a, b) => {
          const aExact = a.symbol === symbolQuery ? 0 : a.symbol.startsWith(symbolQuery) ? 1 : 2;
          const bExact = b.symbol === symbolQuery ? 0 : b.symbol.startsWith(symbolQuery) ? 1 : 2;
          return aExact - bExact || a.symbol.localeCompare(b.symbol);
        })
        .slice(0, 8)
    : [];

  const selectSuggestedAsset = (asset: MarketSuggestion) => {
    setSymbol(asset.symbol);
    setName(asset.name || asset.symbol);
    setType(asset.type);
    const numericPrice = Number(asset.price);
    if (Number.isFinite(numericPrice) && numericPrice > 0) {
      setPrice(String(numericPrice));
    } else {
      fetchAssetPrice(asset.symbol, asset.type)
        .then((nextPrice) => {
          if (nextPrice) setPrice(String(nextPrice));
        })
        .catch(() => undefined);
    }
    setShowSymbolSuggestions(false);
  };

  const closeAddFlow = () => {
    setIsAdding(false);
    setFormError('');
    setShowSymbolSuggestions(false);
    navigate('/portfolio', { replace: true });
  };

  const resetWalletLink = async () => {
    try {
      if (walletEcosystem === 'solana') {
        await (window.phantom?.solana || window.solana)?.disconnect?.();
      }
    } catch (error) {
      console.warn('Wallet disconnect skipped:', error);
    }
    setWalletAddress('');
    setWalletStatus('');
    setWalletLoading(false);
    setSelectedWalletIndex(0);
    setImportCandidates([]);
    setFormError('');
  };

  const savePosition = async (position: {
    symbol: string;
    name?: string;
    type: 'stock' | 'crypto';
    quantity: number | string;
    price: number | string;
    currency?: Currency;
    transactionType?: 'buy' | 'sell';
    tradeDate?: string;
    fee?: string;
    notes?: string;
  }) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    const cleanSymbol = position.symbol.trim().toUpperCase();

    await registerTransaction(
      {
        assetSymbol: cleanSymbol,
        assetType: position.type,
        type: position.transactionType || 'buy',
        quantity: String(position.quantity),
        price: String(position.price),
        fee: position.fee || '0',
        currency: position.currency || 'USD',
        date: position.tradeDate || new Date().toISOString(),
        broker: '',
        notes: position.notes || '',
      },
      position.name || cleanSymbol,
    );
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || savingRef.current) return;

    const qtyNum = parseFloat(quantity);
    const priceNum = parseFloat(price);
    const cleanSymbol = symbol.trim().toUpperCase();

    if (
      !cleanSymbol ||
      !Number.isFinite(qtyNum) ||
      !Number.isFinite(priceNum) ||
      qtyNum <= 0 ||
      priceNum <= 0
    ) {
      setFormError('Enter a valid symbol, quantity and price greater than zero.');
      return;
    }

    try {
      savingRef.current = true;
      setSaving(true);
      setFormError('');
      await savePosition({
        symbol: cleanSymbol,
        name: name.trim() || cleanSymbol,
        type,
        quantity,
        price,
        currency: manualCurrency,
      });

      setSymbol('');
      setName('');
      setQuantity('');
      setPrice('');
      setIsAdding(false);
      trackEvent('portfolio_position_added', { type, source: 'manual' });
    } catch (error) {
      console.error('Error adding asset:', error);
      setFormError(errorMessage(error));
      trackEvent('portfolio_position_add_failed', { type, source: 'manual' });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const fetchAssetPrice = async (assetSymbol: string, assetType: 'stock' | 'crypto') => {
    const response = await fetch(
      `/api/market/asset?symbol=${encodeURIComponent(assetSymbol)}&type=${assetType}&t=${Date.now()}`,
      { cache: 'no-store' },
    );
    const data = await response.json();
    const numericPrice = Number(data?.price);
    return Number.isFinite(numericPrice) && numericPrice > 0 ? numericPrice : null;
  };

  const getEvmWalletProviders = () => {
    if (!window.ethereum) return [];
    const providers = window.ethereum.providers?.length
      ? window.ethereum.providers
      : [window.ethereum];
    return providers.map((provider, index) => {
      const name = provider.isCoinbaseWallet
        ? 'Coinbase Wallet'
        : provider.isRabby
          ? 'Rabby'
          : provider.isMetaMask
            ? 'MetaMask'
            : `Browser wallet ${index + 1}`;
      return { provider, name, index };
    });
  };

  const getVisibleWalletProviders = () => {
    if (walletEcosystem === 'evm')
      return getEvmWalletProviders().map((wallet) => ({ name: wallet.name, index: wallet.index }));
    if (walletEcosystem === 'solana') {
      const provider = window.phantom?.solana || window.solana;
      return provider ? [{ name: provider.isPhantom ? 'Phantom' : 'Solana wallet', index: 0 }] : [];
    }
    return window.suiWallet ? [{ name: 'Sui Wallet', index: 0 }] : [];
  };

  const scanReadOnlyWallet = async (
    address: string,
    ecosystem: WalletEcosystem = walletEcosystem,
  ) => {
    const response = await apiFetch(
      `/api/wallet/read-only?address=${encodeURIComponent(address)}&ecosystem=${ecosystem}&t=${Date.now()}`,
      { cache: 'no-store' },
    );
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Wallet scan failed');

    await trackWallet(address, ecosystem);
    setWalletScan(data);
    setImportCandidates([]);
    setWalletStatus(
      data.partial
        ? 'Wallet saved. Some balances could not be read; refresh to retry.'
        : 'Wallet saved. Balances will refresh automatically.',
    );
    trackEvent('wallet_scan_completed', {
      ecosystem,
      positions: data.positions.length,
      networks: data.networks.length,
    });
  };

  const connectReadOnlyWallet = async () => {
    if (walletLoading) return;
    setWalletStatus('');
    setFormError('');

    try {
      setWalletLoading(true);
      if (walletEcosystem === 'evm') {
        const providers = getEvmWalletProviders();
        const selectedProvider = providers[selectedWalletIndex]?.provider;

        if (!selectedProvider) {
          setWalletStatus(
            'Install or open MetaMask, Coinbase Wallet, Rabby, or another EVM wallet to link it in read-only mode.',
          );
          return;
        }

        try {
          await selectedProvider.request({
            method: 'wallet_requestPermissions',
            params: [{ eth_accounts: {} }],
          });
        } catch {
          // Some wallets do not support permission prompts; eth_requestAccounts remains the fallback.
        }
        const accounts = await selectedProvider.request({ method: 'eth_requestAccounts' });
        const account = String(Array.isArray(accounts) ? accounts[0] || '' : '');
        if (!account) throw new Error('No wallet account selected');
        setWalletAddress(account);
        await scanReadOnlyWallet(account, 'evm');
        return;
      }

      if (walletEcosystem === 'solana') {
        const provider = window.phantom?.solana || window.solana;
        if (!provider) {
          setWalletStatus('Install or open Phantom to link a Solana wallet in read-only mode.');
          return;
        }
        const connection = await provider.connect();
        const account = connection.publicKey.toString();
        if (!account) throw new Error('No Solana account selected');
        setWalletAddress(account);
        await scanReadOnlyWallet(account, 'solana');
        return;
      }

      if (!window.suiWallet) {
        setWalletStatus(
          'Install or open a Sui wallet to link it in read-only mode, or paste a public Sui address.',
        );
        return;
      }
      const permissions = await window.suiWallet.requestPermissions?.();
      const accounts = permissions?.accounts || (await window.suiWallet.getAccounts?.());
      const account = String(accounts?.[0] || '');
      if (!account) throw new Error('No Sui account selected');
      setWalletAddress(account);
      await scanReadOnlyWallet(account, 'sui');
    } catch (error) {
      console.error('Wallet import failed:', error);
      trackEvent('wallet_scan_failed', { ecosystem: walletEcosystem, mode: 'connect' });
      setWalletStatus(
        'Could not scan the wallet. No transaction, signature or token approval was requested.',
      );
    } finally {
      setWalletLoading(false);
    }
  };

  const linkManualReadOnlyAddress = async () => {
    if (walletLoading) return;
    const cleanAddress = walletAddress.trim();
    const isValidAddress = isWalletAddress(cleanAddress, walletEcosystem);

    if (!isValidAddress) {
      setWalletStatus(`Enter a valid public ${walletEcosystem.toUpperCase()} wallet address.`);
      return;
    }

    try {
      setWalletLoading(true);
      setImportCandidates([]);
      setWalletStatus('Scanning public balances across supported ' + brand.name + ' networks...');
      await scanReadOnlyWallet(cleanAddress, walletEcosystem);
    } catch (error) {
      console.error('Manual wallet scan failed:', error);
      trackEvent('wallet_scan_failed', { ecosystem: walletEcosystem, mode: 'manual_address' });
      setWalletStatus(
        'Could not scan that address right now. No transaction, signature or wallet access was requested.',
      );
    } finally {
      setWalletLoading(false);
    }
  };

  const analyzeScreenshot = async (file: File | null) => {
    if (!file || screenshotLoading || importing) return;
    setScreenshotStatus('');
    setFormError('');
    setImportCandidates([]);

    const maxFileSize = 12 * 1024 * 1024;
    if (file.size > maxFileSize) {
      setScreenshotStatus(
        'That file is too large. Try a file under 12MB or export only the portfolio sheet.',
      );
      return;
    }

    try {
      setScreenshotLoading(true);
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          resolve(result.includes(',') ? result.split(',')[1] : result);
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const response = await apiFetch('/api/ai/import-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileBase64: imageBase64,
          mimeType: file.type || 'application/octet-stream',
          fileName: file.name,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Screenshot import failed');

      const candidates = (data.assets || [])
        .map(
          (asset: {
            symbol: string;
            name?: string;
            type?: string;
            quantity?: string | number;
            averagePrice?: string | number;
            confidence?: number;
            notes?: string;
            currency?: Currency | null;
            transactionType?: 'buy' | 'sell' | 'unknown';
            tradeDate?: string | null;
            fee?: string | null;
            recognized?: boolean;
            currentQuote?: AssetQuote | null;
          }): ImportCandidate => ({
            symbol: String(asset.symbol || '').toUpperCase(),
            name: asset.name || asset.symbol || '',
            type: asset.type === 'crypto' ? 'crypto' : 'stock',
            quantity: asset.quantity ? String(asset.quantity) : '',
            price: asset.averagePrice ? String(asset.averagePrice) : '',
            currency: asset.currency === null ? '' : asset.currency || 'USD',
            confidence: asset.confidence,
            notes: asset.notes || '',
            receipt: file.type.startsWith('image/'),
            transactionType: asset.transactionType || 'unknown',
            tradeDate: asset.tradeDate || '',
            fee: asset.fee || '0',
            recognized: asset.recognized,
            currentQuote: asset.currentQuote,
          }),
        )
        .filter((asset: ImportCandidate) => asset.symbol);

      setImportCandidates(candidates);
      setScreenshotStatus(
        candidates.length > 0
          ? `${data.source === 'structured-parser' ? 'File reader' : data.source === 'fallback-parser' ? 'Fallback parser' : 'AI'} detected ${candidates.length} position${candidates.length === 1 ? '' : 's'}. Review every row before importing.`
          : 'No positions were detected. Make sure the file shows ticker/symbol, quantity and buy or average price.',
      );
      trackEvent('portfolio_import_file_analyzed', {
        source: data.source || 'unknown',
        positions: candidates.length,
        mimeType: file.type || 'unknown',
      });
    } catch (error) {
      console.error('Screenshot analysis failed:', error);
      trackEvent('portfolio_import_file_failed', { mimeType: file.type || 'unknown' });
      setScreenshotStatus(errorMessage(error));
    } finally {
      setScreenshotLoading(false);
    }
  };

  const updateCandidate = (index: number, patch: Partial<ImportCandidate>) => {
    const editedIdentity = patch.symbol !== undefined || patch.type !== undefined;
    setImportCandidates((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              ...patch,
              ...(editedIdentity && item.receipt ? { recognized: false, currentQuote: null } : {}),
            }
          : item,
      ),
    );
  };

  const importDetectedPositions = async () => {
    if (!auth.currentUser || importing) return;

    const validCandidates = importCandidates.filter((candidate) => {
      try {
        return (
          /^[A-Z0-9][A-Z0-9.-]{0,19}$/.test(candidate.symbol) &&
          candidate.currency !== '' &&
          (!candidate.receipt ||
            (candidate.recognized &&
              candidate.transactionType !== 'unknown' &&
              candidate.tradeDate &&
              Number.isFinite(Date.parse(candidate.tradeDate)) &&
              amount(candidate.fee || '0').gte(0))) &&
          amount(candidate.quantity).gt(0) &&
          amount(candidate.price).gt(0)
        );
      } catch {
        return false;
      }
    });

    if (validCandidates.length === 0) {
      setFormError('Review the detected rows. Every import needs symbol, quantity and buy price.');
      return;
    }

    try {
      setImporting(true);
      setFormError('');
      for (const candidate of validCandidates) {
        await savePosition({
          symbol: candidate.symbol,
          name: candidate.name || candidate.symbol,
          type: candidate.type,
          quantity: candidate.quantity,
          price: candidate.price,
          currency: candidate.currency || 'USD',
          transactionType: candidate.transactionType === 'sell' ? 'sell' : 'buy',
          tradeDate: candidate.receipt ? new Date(candidate.tradeDate!).toISOString() : undefined,
          fee: candidate.fee || '0',
          notes: candidate.notes,
        });
        setImportCandidates((remaining) => remaining.filter((item) => item !== candidate));
      }
      if (validCandidates.length === importCandidates.length) {
        setScreenshotStatus('');
        setWalletStatus('');
        setIsAdding(false);
      } else {
        setFormError('Valid rows were saved. Complete the remaining rows before importing them.');
      }
      trackEvent('portfolio_import_positions_saved', { positions: validCandidates.length });
    } catch (error) {
      console.error('Bulk import failed:', error);
      trackEvent('portfolio_import_positions_failed', { positions: validCandidates.length });
      setFormError(errorMessage(error));
    } finally {
      setImporting(false);
    }
  };

  const filteredTransactions = transactions
    .filter((tx) => tx.assetSymbol.toLowerCase().includes(txSearch.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const motionItem = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0 } };
  const walletProviders = getVisibleWalletProviders();
  const getAssetPath = (asset: Asset) => {
    const assetType = asset.type === 'crypto' ? 'cryptos' : 'stocks';
    return `/market/${assetType}/${encodeURIComponent(asset.symbol)}`;
  };

  if (loading) {
    return (
      <I18n.div className="flex h-[60vh] items-center justify-center">
        <I18n.div className="flex flex-col items-center gap-4">
          <I18n.div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <I18n.div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent animate-pulse">
            Syncing portfolio...
          </I18n.div>
        </I18n.div>
      </I18n.div>
    );
  }

  if (dataError) {
    return (
      <I18n.section className="terminal-panel p-6 space-y-4" role="alert">
        <I18n.h1 className="text-2xl font-semibold">Portfolio connection</I18n.h1>
        <I18n.p className="text-sm text-text-dim">{dataError}</I18n.p>
        <I18n.button className="primary-button" onClick={() => window.location.reload()}>
          Retry connection
        </I18n.button>
      </I18n.section>
    );
  }

  if (isAdding) {
    const addOptions = [
      {
        id: 'manual',
        label: 'Manual entry',
        description: 'Search the asset, confirm quantity and set your real entry price.',
        icon: Plus,
      },
      {
        id: 'wallet',
        label: 'Read-only wallet',
        description:
          'Scan public balances across supported networks. ' +
          brand.name +
          ' never requests approvals.',
        icon: Shield,
      },
      {
        id: 'screenshot',
        label: 'AI import',
        description:
          'Upload screenshots, XLSX spreadsheets, CSV, TXT or Word files and review before saving.',
        icon: Sparkles,
      },
    ] as const;

    return (
      <motion.div
        className="app-page"
        initial="hidden"
        animate="show"
        transition={{ staggerChildren: 0.07 }}
      >
        <motion.section variants={motionItem} className="app-hero overflow-visible">
          <I18n.div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <I18n.div className="flex items-start gap-4">
              <I18n.button
                onClick={closeAddFlow}
                className="rounded-2xl border border-border-accent bg-bg/50 p-3 transition-all hover:border-accent hover:text-accent"
              >
                <ArrowLeft className="h-5 w-5" />
              </I18n.button>
              <I18n.div>
                <I18n.div className="accent-chip mb-4">
                  <WalletCards className="h-3.5 w-3.5" /> Portfolio import center
                </I18n.div>
                <I18n.h1 className="max-w-4xl text-4xl font-black uppercase tracking-tighter md:text-6xl">
                  Add positions with confidence
                </I18n.h1>
                <I18n.p className="mt-4 max-w-3xl text-sm leading-7 text-text-dim">
                  Registering your investments is one of the most important parts of {brand.name}.
                  Choose the fastest path, review every number, and only save when symbol, quantity
                  and buy price are right.
                </I18n.p>
              </I18n.div>
            </I18n.div>
            <I18n.button
              type="button"
              onClick={closeAddFlow}
              className="rounded-2xl border border-border-accent px-5 py-3 text-[10px] font-black uppercase tracking-widest text-text-dim transition-all hover:border-accent hover:text-text-main"
            >
              Cancel import
            </I18n.button>
          </I18n.div>
          <I18n.div className="absolute bottom-0 left-0 h-px w-full scanline" />
        </motion.section>

        <motion.div
          variants={motionItem}
          className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]"
        >
          <I18n.aside className="panel-card p-4">
            <I18n.div className="mb-4 px-2 text-[10px] font-black uppercase tracking-[0.24em] text-text-dim">
              Import method
            </I18n.div>
            <I18n.div className="space-y-3">
              {addOptions.map((option) => (
                <I18n.button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setAddMode(option.id);
                    setFormError('');
                    setShowSymbolSuggestions(false);
                  }}
                  className={`group flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all ${
                    addMode === option.id
                      ? 'border-accent/60 bg-accent/10 shadow-[0_0_24px_rgba(124,255,26,0.12)]'
                      : 'border-border-accent bg-bg/35 hover:border-accent/50 hover:bg-surface'
                  }`}
                >
                  <I18n.div
                    className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${addMode === option.id ? 'bg-accent text-bg' : 'border border-border-accent text-accent'}`}
                  >
                    <option.icon className="h-5 w-5" />
                  </I18n.div>
                  <I18n.div className="min-w-0">
                    <I18n.div className="text-sm font-black uppercase tracking-wide">
                      {option.label}
                    </I18n.div>
                    <I18n.p className="mt-1 text-xs leading-5 text-text-dim">
                      {option.description}
                    </I18n.p>
                  </I18n.div>
                </I18n.button>
              ))}
            </I18n.div>

            <I18n.div className="mt-5 rounded-2xl border border-accent/25 bg-accent/5 p-4">
              <I18n.div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-accent">
                <KeyRound className="h-4 w-4" /> Safety promise
              </I18n.div>
              <I18n.p className="text-xs leading-6 text-text-dim">
                {brand.name} never asks for seed phrases, private keys, token approvals or
                transactions. Imports are saved only after your review.
              </I18n.p>
            </I18n.div>
          </I18n.aside>

          <I18n.section className="panel-card min-w-0 p-5 md:p-7">
            {formError && (
              <I18n.div className="mb-5 flex items-center gap-2 rounded-xl border border-loss/40 bg-loss/10 p-3 text-xs font-bold text-loss">
                <AlertCircle className="h-4 w-4" />
                {formError}
              </I18n.div>
            )}

            {addMode === 'manual' && (
              <I18n.form onSubmit={handleAddAsset} className="space-y-6">
                <I18n.div>
                  <I18n.div className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-widest">
                    <Search className="h-4 w-4 text-accent" /> Find the asset
                  </I18n.div>
                  <I18n.p className="mb-4 text-xs leading-6 text-text-dim">
                    Start typing a symbol or company name. Selecting a result fills name, type and
                    live price when available.
                  </I18n.p>
                  <I18n.div className="relative">
                    <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-dim" />
                    <I18n.input
                      type="text"
                      aria-label="Asset symbol"
                      value={symbol}
                      onChange={(event) => {
                        setSymbol(event.target.value.toUpperCase());
                        setShowSymbolSuggestions(true);
                      }}
                      onFocus={() => setShowSymbolSuggestions(true)}
                      onBlur={() => window.setTimeout(() => setShowSymbolSuggestions(false), 160)}
                      placeholder="Search AAPL, Apple, BTC, Ethereum..."
                      className="h-16 w-full rounded-2xl border border-border-accent bg-bg pl-14 pr-4 text-lg font-black outline-none transition-colors placeholder:text-text-dim focus:border-accent"
                      required
                    />
                    {showSymbolSuggestions && filteredSymbolSuggestions.length > 0 && (
                      <I18n.div className="absolute left-0 right-0 top-full z-40 mt-3 max-h-[430px] overflow-y-auto rounded-2xl border border-accent/40 bg-surface shadow-2xl">
                        {filteredSymbolSuggestions.map((asset) => {
                          const numericPrice = Number(asset.price);
                          return (
                            <I18n.button
                              key={`${asset.type}-${asset.symbol}`}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                selectSuggestedAsset(asset);
                              }}
                              className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-border-accent/40 px-4 py-4 text-left transition-all last:border-b-0 hover:bg-accent/10"
                            >
                              <CompanyLogo
                                symbol={asset.symbol}
                                name={asset.name}
                                type={asset.type}
                                className="h-12 w-12 rounded-2xl"
                                imgClassName="h-7 w-7"
                              />
                              <I18n.div className="min-w-0">
                                <I18n.div className="flex flex-wrap items-center gap-2">
                                  <I18n.span className="text-lg font-black">
                                    {asset.symbol}
                                  </I18n.span>
                                  <I18n.span className="rounded-full border border-border-accent px-2 py-1 text-[9px] font-black uppercase tracking-widest text-accent">
                                    {asset.type}
                                  </I18n.span>
                                </I18n.div>
                                <I18n.div className="mt-1 truncate text-xs text-text-dim">
                                  {asset.name || asset.symbol}
                                </I18n.div>
                              </I18n.div>
                              <I18n.div className="shrink-0 text-right">
                                {Number.isFinite(numericPrice) && numericPrice > 0 ? (
                                  <I18n.div className="data-value text-sm">
                                    {formatMoney(numericPrice)}
                                  </I18n.div>
                                ) : (
                                  <I18n.div className="text-[10px] font-black uppercase tracking-widest text-text-dim">
                                    Price lookup
                                  </I18n.div>
                                )}
                              </I18n.div>
                            </I18n.button>
                          );
                        })}
                      </I18n.div>
                    )}
                  </I18n.div>
                </I18n.div>

                <I18n.div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr]">
                  <I18n.div className="flex flex-col">
                    <I18n.label className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">
                      Name
                    </I18n.label>
                    <I18n.input
                      aria-label="Asset name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Apple Inc."
                      className="rounded-xl border border-border-accent bg-bg p-4 text-sm font-bold outline-none transition-colors focus:border-accent"
                    />
                  </I18n.div>
                  <I18n.div className="flex flex-col">
                    <I18n.label className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">
                      Quantity *
                    </I18n.label>
                    <I18n.input
                      type="number"
                      step="any"
                      min="0"
                      aria-label="Asset quantity"
                      value={quantity}
                      onChange={(event) => setQuantity(event.target.value)}
                      placeholder="0.00"
                      className="rounded-xl border border-border-accent bg-bg p-4 text-sm font-bold outline-none transition-colors focus:border-accent"
                      required
                    />
                  </I18n.div>
                  <I18n.div className="flex flex-col">
                    <I18n.label className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">
                      Buy price *
                    </I18n.label>
                    <I18n.input
                      type="number"
                      step="any"
                      min="0"
                      aria-label="Purchase price"
                      value={price}
                      onChange={(event) => setPrice(event.target.value)}
                      placeholder="0.00"
                      className="rounded-xl border border-border-accent bg-bg p-4 text-sm font-bold outline-none transition-colors focus:border-accent"
                      required
                    />
                  </I18n.div>
                  <I18n.div className="flex flex-col">
                    <I18n.label className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">
                      Type *
                    </I18n.label>
                    <I18n.select
                      aria-label="Purchase currency"
                      value={manualCurrency}
                      className="terminal-input mb-3"
                      onChange={(event) => setManualCurrency(event.target.value as Currency)}
                    >
                      {(['USD', 'EUR', 'ARS', 'GBP'] as const).map((currency) => (
                        <I18n.option key={currency} value={currency}>
                          {currency}
                        </I18n.option>
                      ))}
                    </I18n.select>
                    <I18n.select
                      aria-label="Asset type"
                      value={type}
                      onChange={(event) => setType(event.target.value as 'stock' | 'crypto')}
                      className="rounded-xl border border-border-accent bg-bg p-4 text-sm font-bold outline-none transition-colors focus:border-accent"
                    >
                      <I18n.option value="stock">Stock</I18n.option>
                      <I18n.option value="crypto">Crypto</I18n.option>
                    </I18n.select>
                  </I18n.div>
                </I18n.div>

                <I18n.div className="flex flex-col gap-3 border-t border-border-accent pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <I18n.div className="text-xs leading-6 text-text-dim">
                    Use your actual entry price, not necessarily the current market price.
                  </I18n.div>
                  <I18n.button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-7 py-4 text-[10px] font-black uppercase tracking-widest text-bg transition-all hover:brightness-110"
                  >
                    <Check className="h-4 w-4" />
                    Save position
                  </I18n.button>
                </I18n.div>
              </I18n.form>
            )}

            {addMode === 'wallet' && (
              <I18n.div className="space-y-5">
                <I18n.div className="rounded-2xl border border-border-accent bg-bg/45 p-5">
                  <I18n.div className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-widest">
                    <Shield className="h-4 w-4 text-accent" /> Wallet universe import
                  </I18n.div>
                  <I18n.p className="text-sm leading-7 text-text-dim">
                    Choose a wallet ecosystem, connect only to reveal your public address, or paste
                    an address manually. {brand.name} scans public balances only. No seed phrases,
                    private keys, approvals, signatures or transactions.
                  </I18n.p>
                </I18n.div>
                <I18n.div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    {
                      id: 'evm',
                      label: 'MetaMask / EVM',
                      detail: 'Ethereum, Base, Arbitrum, Optimism, Polygon, BNB, Avalanche',
                    },
                    {
                      id: 'solana',
                      label: 'Phantom / Solana',
                      detail: 'SOL, USDC, USDT, JUP, RAY, BONK, WIF',
                    },
                    { id: 'sui', label: 'Sui Wallet', detail: 'SUI and supported Sui coins' },
                  ].map((item) => (
                    <I18n.button
                      key={item.id}
                      disabled={walletLoading}
                      type="button"
                      onClick={() => {
                        setWalletEcosystem(item.id as WalletEcosystem);
                        setWalletAddress('');
                        setImportCandidates([]);
                        setSelectedWalletIndex(0);
                        setWalletStatus('');
                      }}
                      className={`rounded-2xl border p-4 text-left transition-all ${walletEcosystem === item.id ? 'border-accent/60 bg-accent/10' : 'border-border-accent bg-bg/35 hover:border-accent/50'}`}
                    >
                      <I18n.div className="text-xs font-black uppercase tracking-widest">
                        {item.label}
                      </I18n.div>
                      <I18n.div className="mt-2 text-[11px] leading-5 text-text-dim">
                        {item.detail}
                      </I18n.div>
                    </I18n.button>
                  ))}
                </I18n.div>
                <I18n.select
                  aria-label="Wallet ecosystem"
                  className="terminal-input mb-3"
                  value={walletEcosystem}
                  disabled={walletLoading}
                  onChange={(e) => {
                    setWalletEcosystem(e.target.value as WalletEcosystem);
                    setWalletAddress('');
                    setWalletStatus('');
                  }}
                >
                  <I18n.option value="evm">EVM</I18n.option>
                  <I18n.option value="solana">Solana</I18n.option>
                  <I18n.option value="sui">Sui</I18n.option>
                </I18n.select>
                {walletProviders.length > 0 && (
                  <I18n.div className="flex flex-wrap gap-2">
                    {walletProviders.map((wallet) => (
                      <I18n.button
                        key={`${wallet.name}-${wallet.index}`}
                        type="button"
                        onClick={() => setSelectedWalletIndex(wallet.index)}
                        className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedWalletIndex === wallet.index ? 'bg-accent text-bg' : 'border border-border-accent bg-bg/60 text-text-dim hover:border-accent hover:text-text-main'}`}
                      >
                        {wallet.name}
                      </I18n.button>
                    ))}
                  </I18n.div>
                )}
                <I18n.div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto_auto_auto]">
                  <I18n.input
                    disabled={walletLoading}
                    aria-label="Public wallet address"
                    value={walletAddress}
                    onChange={(event) => setWalletAddress(event.target.value)}
                    placeholder={
                      walletEcosystem === 'evm'
                        ? 'Paste public 0x EVM address'
                        : walletEcosystem === 'solana'
                          ? 'Paste public Solana address'
                          : 'Paste public Sui address'
                    }
                    className="rounded-xl border border-border-accent bg-bg p-4 text-sm font-bold outline-none transition-colors focus:border-accent"
                  />
                  <I18n.button
                    type="button"
                    onClick={connectReadOnlyWallet}
                    disabled={walletLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-4 text-[10px] font-black uppercase tracking-widest text-bg transition-all hover:opacity-90 disabled:opacity-60"
                  >
                    <Wallet className="h-4 w-4" />
                    {walletLoading ? 'Reading wallet' : 'Connect wallet'}
                  </I18n.button>
                  <I18n.button
                    type="button"
                    onClick={linkManualReadOnlyAddress}
                    disabled={walletLoading}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-accent px-5 py-4 text-[10px] font-black uppercase tracking-widest text-text-dim transition-all hover:border-accent hover:text-text-main"
                  >
                    Link address
                  </I18n.button>
                  <I18n.button
                    type="button"
                    onClick={() => void resetWalletLink()}
                    disabled={walletLoading && !walletAddress && importCandidates.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-loss/40 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-loss transition-all hover:bg-loss/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Reset wallet
                  </I18n.button>
                </I18n.div>
                <I18n.div className="rounded-2xl border border-border-accent bg-bg/35 p-4 text-xs leading-6 text-text-dim">
                  {brand.name} now supports EVM, Solana and Sui read-only imports. Bitcoin, XRP,
                  Cardano and exchange accounts need dedicated adapters or user-uploaded statements
                  next, because they do not expose the same browser wallet standard.
                </I18n.div>
                <TrackedWallets initial={walletScan} />
                {walletStatus && (
                  <I18n.div className="rounded-xl border border-border-accent bg-bg/45 p-3 text-xs font-bold text-text-dim">
                    {walletStatus}
                  </I18n.div>
                )}
              </I18n.div>
            )}

            {addMode === 'screenshot' && (
              <I18n.div className="space-y-5">
                <I18n.label className="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-accent/50 bg-accent/5 p-10 text-center transition-all hover:bg-accent/10">
                  <I18n.div className="grid h-16 w-16 place-items-center rounded-2xl bg-accent text-bg shadow-[0_0_28px_rgba(124,255,26,0.28)]">
                    <Upload className="h-7 w-7" />
                  </I18n.div>
                  <I18n.div>
                    <I18n.div className="text-lg font-black uppercase tracking-widest">
                      Upload a portfolio file
                    </I18n.div>
                    <I18n.div className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-text-dim">
                      AI reads visible symbols, quantities and average buy prices from screenshots,
                      CSV/TXT, XLSX and Word files. You review every detected row before it enters
                      your portfolio.
                    </I18n.div>
                  </I18n.div>
                  <I18n.div className="flex flex-wrap justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-dim">
                    {['PNG/JPG', 'CSV/TXT', 'XLSX', 'DOCX'].map((item) => (
                      <I18n.span
                        key={item}
                        className="rounded-full border border-border-accent px-3 py-1"
                      >
                        {item}
                      </I18n.span>
                    ))}
                  </I18n.div>
                  <I18n.input
                    type="file"
                    accept="image/*,.csv,.txt,.xlsx,.docx"
                    className="hidden"
                    onChange={(event) => analyzeScreenshot(event.target.files?.[0] || null)}
                  />
                </I18n.label>
                {screenshotLoading && (
                  <I18n.div className="rounded-xl border border-border-accent bg-bg/45 p-3 text-xs font-bold text-accent">
                    Reading file...
                  </I18n.div>
                )}
                {screenshotStatus && (
                  <I18n.div className="rounded-xl border border-border-accent bg-bg/45 p-3 text-xs font-bold text-text-dim">
                    {screenshotStatus}
                  </I18n.div>
                )}
                <I18n.div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    {
                      icon: FileText,
                      title: 'Extract',
                      text: 'Symbols, names, quantities and buy prices.',
                    },
                    {
                      icon: Search,
                      title: 'Review',
                      text: 'You can edit every row before saving.',
                    },
                    {
                      icon: Check,
                      title: 'Import',
                      text: 'Valid rows become portfolio positions.',
                    },
                  ].map((step) => (
                    <I18n.div
                      key={step.title}
                      className="rounded-2xl border border-border-accent bg-bg/35 p-4"
                    >
                      <step.icon className="mb-3 h-5 w-5 text-accent" />
                      <I18n.div className="text-xs font-black uppercase tracking-widest">
                        {step.title}
                      </I18n.div>
                      <I18n.p className="mt-2 text-xs leading-5 text-text-dim">{step.text}</I18n.p>
                    </I18n.div>
                  ))}
                </I18n.div>
              </I18n.div>
            )}

            {importCandidates.length > 0 && (
              <I18n.div className="mt-7 overflow-hidden rounded-2xl border border-border-accent">
                <I18n.div className="flex flex-col gap-3 border-b border-border-accent bg-bg/55 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <I18n.div>
                    <I18n.div className="text-xs font-black uppercase tracking-widest">
                      Review import
                    </I18n.div>
                    <I18n.div className="mt-1 text-[11px] text-text-dim">
                      Only rows with symbol, quantity and buy price will be saved.
                    </I18n.div>
                  </I18n.div>
                  <I18n.button
                    type="button"
                    onClick={importDetectedPositions}
                    disabled={importing}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-[10px] font-black uppercase tracking-widest text-bg"
                  >
                    <Check className="h-4 w-4" />
                    {importing ? 'Saving positions...' : 'Import valid rows'}
                  </I18n.button>
                </I18n.div>
                <I18n.fieldset disabled={importing} className="min-w-0 overflow-x-auto">
                  <I18n.table className="w-full text-left">
                    <I18n.thead>
                      <I18n.tr className="bg-bg/35 text-[10px] uppercase tracking-widest text-text-dim">
                        <I18n.th className="p-3">Symbol</I18n.th>
                        <I18n.th className="p-3">Name</I18n.th>
                        <I18n.th className="p-3">Type</I18n.th>
                        <I18n.th className="p-3">Quantity</I18n.th>
                        <I18n.th className="p-3">Buy price</I18n.th>
                        <I18n.th className="p-3">Currency</I18n.th>
                        <I18n.th className="p-3">Confidence</I18n.th>
                      </I18n.tr>
                    </I18n.thead>
                    <I18n.tbody>
                      {importCandidates.map((candidate, index) => (
                        <I18n.tr
                          key={`${candidate.symbol}-${index}`}
                          className="border-t border-border-accent/40"
                        >
                          <I18n.td className="p-3">
                            <I18n.input
                              value={candidate.symbol}
                              onChange={(event) =>
                                updateCandidate(index, { symbol: event.target.value.toUpperCase() })
                              }
                              className="w-24 rounded-lg border border-border-accent bg-bg p-2 text-xs font-black outline-none focus:border-accent"
                            />
                          </I18n.td>
                          <I18n.td className="p-3">
                            <I18n.input
                              value={candidate.name}
                              onChange={(event) =>
                                updateCandidate(index, { name: event.target.value })
                              }
                              className="min-w-40 rounded-lg border border-border-accent bg-bg p-2 text-xs font-bold outline-none focus:border-accent"
                            />
                          </I18n.td>
                          <I18n.td className="p-3">
                            <I18n.select
                              value={candidate.type}
                              onChange={(event) =>
                                updateCandidate(index, {
                                  type: event.target.value as 'stock' | 'crypto',
                                })
                              }
                              className="rounded-lg border border-border-accent bg-bg p-2 text-xs font-bold outline-none focus:border-accent"
                            >
                              <I18n.option value="stock">Stock</I18n.option>
                              <I18n.option value="crypto">Crypto</I18n.option>
                            </I18n.select>
                          </I18n.td>
                          <I18n.td className="p-3">
                            <I18n.input
                              value={candidate.quantity}
                              onChange={(event) =>
                                updateCandidate(index, { quantity: event.target.value })
                              }
                              className="w-28 rounded-lg border border-border-accent bg-bg p-2 text-xs font-bold outline-none focus:border-accent"
                            />
                          </I18n.td>
                          <I18n.td className="p-3">
                            <I18n.input
                              value={candidate.price}
                              onChange={(event) =>
                                updateCandidate(index, { price: event.target.value })
                              }
                              className="w-28 rounded-lg border border-border-accent bg-bg p-2 text-xs font-bold outline-none focus:border-accent"
                            />
                          </I18n.td>
                          <I18n.td className="p-3 text-xs text-text-dim">
                            <I18n.select
                              aria-label={`Import currency ${index + 1}`}
                              value={candidate.currency ?? 'USD'}
                              onChange={(event) =>
                                updateCandidate(index, { currency: event.target.value as Currency })
                              }
                              className="rounded-lg border border-border-accent bg-bg p-2 text-xs"
                            >
                              <I18n.option value="" disabled>
                                Select currency
                              </I18n.option>
                              {(['USD', 'EUR', 'ARS', 'GBP'] as const).map((currency) => (
                                <I18n.option key={currency}>{currency}</I18n.option>
                              ))}
                            </I18n.select>
                          </I18n.td>
                          <I18n.td className="p-3 text-xs text-text-dim">
                            <ReceiptDetails
                              candidate={candidate}
                              index={index}
                              update={(patch) => updateCandidate(index, patch)}
                            />
                            {candidate.confidence != null
                              ? `${Math.round(candidate.confidence * 100)}%`
                              : 'Review'}
                            {candidate.notes ? ` - ${candidate.notes}` : ''}
                          </I18n.td>
                        </I18n.tr>
                      ))}
                    </I18n.tbody>
                  </I18n.table>
                </I18n.fieldset>
              </I18n.div>
            )}
          </I18n.section>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="app-page"
      initial="hidden"
      animate="show"
      transition={{ staggerChildren: 0.07 }}
    >
      <motion.section variants={motionItem} className="app-hero">
        <I18n.div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
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
                <WalletCards className="h-3.5 w-3.5" /> Portfolio
              </I18n.div>
              <I18n.h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">
                Capital overview
              </I18n.h1>
              <I18n.p className="mt-3 max-w-2xl text-sm text-text-dim">
                Your positions, cash flow and recent activity in one clear view.
              </I18n.p>
            </I18n.div>
          </I18n.div>
          <I18n.div className="flex gap-3">
            <I18n.button
              onClick={() => setIsAdding(!isAdding)}
              className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3 text-[10px] font-black uppercase tracking-widest text-bg shadow-[0_0_28px_rgba(124,255,26,0.25)] transition-all hover:scale-[1.03]"
            >
              <Plus className="h-4 w-4" />
              Add asset
            </I18n.button>
          </I18n.div>
        </I18n.div>
        <I18n.div className="absolute bottom-0 left-0 h-px w-full scanline" />
      </motion.section>

      {isAdding && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="panel-card border-accent/40 p-6"
        >
          <I18n.div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <I18n.h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest">
              <Plus className="h-4 w-4 text-accent" /> Add new position
            </I18n.h2>
            <I18n.div className="flex flex-wrap gap-2">
              {[
                { id: 'manual', label: 'Manual', icon: Plus },
                { id: 'wallet', label: 'Read-only wallet', icon: Shield },
                { id: 'screenshot', label: 'AI screenshot', icon: Camera },
              ].map((mode) => (
                <I18n.button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    setAddMode(mode.id as typeof addMode);
                    setFormError('');
                  }}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${addMode === mode.id ? 'bg-accent text-bg' : 'border border-border-accent bg-bg/60 text-text-dim hover:border-accent hover:text-text-main'}`}
                >
                  <mode.icon className="h-3.5 w-3.5" />
                  {mode.label}
                </I18n.button>
              ))}
            </I18n.div>
          </I18n.div>
          {formError && (
            <I18n.div className="mb-4 flex items-center gap-2 rounded-xl border border-loss/40 bg-loss/10 p-3 text-xs font-bold text-loss">
              <AlertCircle className="h-4 w-4" />
              {formError}
            </I18n.div>
          )}

          {addMode === 'manual' && (
            <I18n.form
              onSubmit={handleAddAsset}
              className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5"
            >
              <I18n.div className="relative flex flex-col">
                <I18n.label className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">
                  Symbol *
                </I18n.label>
                <I18n.input
                  type="text"
                  aria-label="Asset symbol"
                  value={symbol}
                  onChange={(event) => {
                    setSymbol(event.target.value.toUpperCase());
                    setShowSymbolSuggestions(true);
                  }}
                  onFocus={() => setShowSymbolSuggestions(true)}
                  onBlur={() => window.setTimeout(() => setShowSymbolSuggestions(false), 160)}
                  placeholder="AAPL / BTC"
                  className="rounded-xl border border-border-accent bg-bg p-3 text-sm font-bold outline-none transition-colors focus:border-accent"
                  required
                />
                {showSymbolSuggestions && filteredSymbolSuggestions.length > 0 && (
                  <I18n.div className="absolute left-0 top-full z-40 mt-2 max-h-96 w-[min(92vw,560px)] overflow-y-auto rounded-2xl border border-border-accent bg-surface shadow-2xl">
                    {filteredSymbolSuggestions.map((asset) => {
                      const numericPrice = Number(asset.price);
                      return (
                        <I18n.button
                          key={`${asset.type}-${asset.symbol}`}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            selectSuggestedAsset(asset);
                          }}
                          className="flex w-full items-center justify-between gap-4 border-b border-border-accent/40 px-4 py-3 text-left transition-all last:border-b-0 hover:bg-accent/10"
                        >
                          <I18n.div className="flex min-w-0 items-center gap-3">
                            <CompanyLogo
                              symbol={asset.symbol}
                              name={asset.name}
                              type={asset.type}
                              className="h-9 w-9 rounded-xl"
                              imgClassName="h-5 w-5"
                            />
                            <I18n.div className="min-w-0">
                              <I18n.div className="text-sm font-black">{asset.symbol}</I18n.div>
                              <I18n.div className="max-w-[330px] truncate text-[11px] text-text-dim">
                                {asset.name || asset.symbol}
                              </I18n.div>
                            </I18n.div>
                          </I18n.div>
                          <I18n.div className="shrink-0 text-right">
                            <I18n.div className="text-[10px] font-black uppercase text-accent">
                              {asset.type}
                            </I18n.div>
                            {Number.isFinite(numericPrice) && numericPrice > 0 && (
                              <I18n.div className="text-[10px] text-text-dim">
                                {formatMoney(numericPrice)}
                              </I18n.div>
                            )}
                          </I18n.div>
                        </I18n.button>
                      );
                    })}
                  </I18n.div>
                )}
              </I18n.div>
              {[
                { label: 'Name', value: name, set: setName, placeholder: 'Apple Inc.' },
                {
                  label: 'Quantity *',
                  value: quantity,
                  set: setQuantity,
                  placeholder: '0.00',
                  type: 'number',
                },
                {
                  label: 'Price *',
                  value: price,
                  set: setPrice,
                  placeholder: '0.00',
                  type: 'number',
                },
              ].map((field) => (
                <I18n.div key={field.label} className="flex flex-col">
                  <I18n.label className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">
                    {field.label}
                  </I18n.label>
                  <I18n.input
                    type={field.type || 'text'}
                    step="any"
                    min="0"
                    value={field.value}
                    onChange={(e) => field.set(e.target.value)}
                    placeholder={field.placeholder}
                    className="rounded-xl border border-border-accent bg-bg p-3 text-sm font-bold outline-none transition-colors focus:border-accent"
                    required={field.label.includes('*')}
                  />
                </I18n.div>
              ))}
              <I18n.div className="flex flex-col">
                <I18n.label className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">
                  Type *
                </I18n.label>
                <I18n.select
                  aria-label="Purchase currency"
                  value={manualCurrency}
                  className="terminal-input mb-3"
                  onChange={(event) => setManualCurrency(event.target.value as Currency)}
                >
                  {(['USD', 'EUR', 'ARS', 'GBP'] as const).map((currency) => (
                    <I18n.option key={currency} value={currency}>
                      {currency}
                    </I18n.option>
                  ))}
                </I18n.select>
                <I18n.select
                  aria-label="Asset type"
                  value={type}
                  onChange={(e) => setType(e.target.value as 'stock' | 'crypto')}
                  className="rounded-xl border border-border-accent bg-bg p-3 text-sm font-bold outline-none transition-colors focus:border-accent"
                >
                  <I18n.option value="stock">Stock</I18n.option>
                  <I18n.option value="crypto">Crypto</I18n.option>
                </I18n.select>
              </I18n.div>
              <I18n.div className="flex justify-end gap-3 lg:col-span-5">
                <I18n.button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="rounded-xl border border-border-accent px-6 py-2 text-[10px] font-black uppercase transition-all hover:bg-surface"
                >
                  Cancel
                </I18n.button>
                <I18n.button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-accent px-8 py-2 text-[10px] font-black uppercase text-bg transition-all hover:opacity-90"
                >
                  Save position
                </I18n.button>
              </I18n.div>
            </I18n.form>
          )}

          {addMode === 'wallet' && (
            <I18n.div className="space-y-4">
              <I18n.div className="rounded-2xl border border-border-accent bg-bg/45 p-4">
                <I18n.div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                  <Shield className="h-4 w-4 text-accent" /> Read-only wallet link
                </I18n.div>
                <I18n.p className="text-xs leading-6 text-text-dim">
                  {brand.name} only reads your public wallet address and public on-chain balances.
                  It never asks for seed phrases, private keys, spending approvals, token
                  permissions, signatures, or transactions.
                </I18n.p>
              </I18n.div>
              {walletProviders.length > 0 && (
                <I18n.div className="flex flex-wrap gap-2">
                  {walletProviders.map((wallet) => (
                    <I18n.button
                      key={`${wallet.name}-${wallet.index}`}
                      type="button"
                      onClick={() => setSelectedWalletIndex(wallet.index)}
                      className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedWalletIndex === wallet.index ? 'bg-accent text-bg' : 'border border-border-accent bg-bg/60 text-text-dim hover:border-accent hover:text-text-main'}`}
                    >
                      {wallet.name}
                    </I18n.button>
                  ))}
                </I18n.div>
              )}
              <I18n.div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_auto_auto]">
                <I18n.input
                  disabled={walletLoading}
                  aria-label="Public wallet address"
                  value={walletAddress}
                  onChange={(event) => setWalletAddress(event.target.value)}
                  placeholder={
                    walletEcosystem === 'solana' ? 'Solana public address' : '0x wallet address'
                  }
                  className="rounded-xl border border-border-accent bg-bg p-3 text-sm font-bold outline-none transition-colors focus:border-accent"
                />
                <I18n.button
                  type="button"
                  onClick={connectReadOnlyWallet}
                  disabled={walletLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-[10px] font-black uppercase tracking-widest text-bg transition-all hover:opacity-90 disabled:opacity-60"
                >
                  <Wallet className="h-4 w-4" />
                  {walletLoading ? 'Reading wallet' : 'Connect wallet'}
                </I18n.button>
                <I18n.button
                  type="button"
                  onClick={linkManualReadOnlyAddress}
                  disabled={walletLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-accent px-5 py-3 text-[10px] font-black uppercase tracking-widest text-text-dim transition-all hover:border-accent hover:text-text-main"
                >
                  Link address
                </I18n.button>
                <I18n.button
                  type="button"
                  onClick={() => void resetWalletLink()}
                  disabled={walletLoading && !walletAddress && importCandidates.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-loss/40 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-loss transition-all hover:bg-loss/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Reset wallet
                </I18n.button>
              </I18n.div>
              <I18n.div className="rounded-2xl border border-border-accent bg-bg/35 p-4 text-xs leading-6 text-text-dim">
                Tracked wallets refresh automatically. EVM includes native coins and supported token
                contracts; Solana includes SPL and Token-2022.
              </I18n.div>
              <TrackedWallets initial={walletScan} />
              {walletStatus && (
                <I18n.div className="rounded-xl border border-border-accent bg-bg/45 p-3 text-xs font-bold text-text-dim">
                  {walletStatus}
                </I18n.div>
              )}
            </I18n.div>
          )}

          {addMode === 'screenshot' && (
            <I18n.div className="space-y-4">
              <I18n.label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-accent/50 bg-accent/5 p-8 text-center transition-all hover:bg-accent/10">
                <Upload className="h-7 w-7 text-accent" />
                <I18n.div>
                  <I18n.div className="text-sm font-black uppercase tracking-widest">
                    Upload screenshot, spreadsheet or document
                  </I18n.div>
                  <I18n.div className="mt-2 text-xs text-text-dim">
                    The AI reads visible symbols, quantities and average buy prices from images,
                    CSV/TXT, Excel and Word files. You review everything before import.
                  </I18n.div>
                </I18n.div>
                <I18n.input
                  type="file"
                  accept="image/*,.csv,.txt,.xls,.xlsx,.docx"
                  className="hidden"
                  onChange={(event) => analyzeScreenshot(event.target.files?.[0] || null)}
                />
              </I18n.label>
              {screenshotLoading && (
                <I18n.div className="rounded-xl border border-border-accent bg-bg/45 p-3 text-xs font-bold text-accent">
                  Reading file...
                </I18n.div>
              )}
              {screenshotStatus && (
                <I18n.div className="rounded-xl border border-border-accent bg-bg/45 p-3 text-xs font-bold text-text-dim">
                  {screenshotStatus}
                </I18n.div>
              )}
            </I18n.div>
          )}

          {importCandidates.length > 0 && (
            <I18n.div className="mt-6 overflow-hidden rounded-2xl border border-border-accent">
              <I18n.div className="flex items-center justify-between border-b border-border-accent bg-bg/55 px-4 py-3">
                <I18n.div className="text-xs font-black uppercase tracking-widest">
                  Review import
                </I18n.div>
                <I18n.button
                  type="button"
                  onClick={importDetectedPositions}
                  disabled={importing}
                  className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[10px] font-black uppercase tracking-widest text-bg"
                >
                  <Check className="h-4 w-4" />
                  {importing ? 'Saving positions...' : 'Import valid rows'}
                </I18n.button>
              </I18n.div>
              <I18n.fieldset disabled={importing} className="min-w-0 overflow-x-auto">
                <I18n.table className="w-full text-left">
                  <I18n.thead>
                    <I18n.tr className="bg-bg/35 text-[10px] uppercase tracking-widest text-text-dim">
                      <I18n.th className="p-3">Symbol</I18n.th>
                      <I18n.th className="p-3">Name</I18n.th>
                      <I18n.th className="p-3">Type</I18n.th>
                      <I18n.th className="p-3">Quantity</I18n.th>
                      <I18n.th className="p-3">Buy price</I18n.th>
                      <I18n.th className="p-3">Currency</I18n.th>
                      <I18n.th className="p-3">Confidence</I18n.th>
                    </I18n.tr>
                  </I18n.thead>
                  <I18n.tbody>
                    {importCandidates.map((candidate, index) => (
                      <I18n.tr
                        key={`${candidate.symbol}-${index}`}
                        className="border-t border-border-accent/40"
                      >
                        <I18n.td className="p-3">
                          <I18n.input
                            value={candidate.symbol}
                            onChange={(event) =>
                              updateCandidate(index, { symbol: event.target.value.toUpperCase() })
                            }
                            className="w-24 rounded-lg border border-border-accent bg-bg p-2 text-xs font-black outline-none focus:border-accent"
                          />
                        </I18n.td>
                        <I18n.td className="p-3">
                          <I18n.input
                            value={candidate.name}
                            onChange={(event) =>
                              updateCandidate(index, { name: event.target.value })
                            }
                            className="min-w-40 rounded-lg border border-border-accent bg-bg p-2 text-xs font-bold outline-none focus:border-accent"
                          />
                        </I18n.td>
                        <I18n.td className="p-3">
                          <I18n.select
                            value={candidate.type}
                            onChange={(event) =>
                              updateCandidate(index, {
                                type: event.target.value as 'stock' | 'crypto',
                              })
                            }
                            className="rounded-lg border border-border-accent bg-bg p-2 text-xs font-bold outline-none focus:border-accent"
                          >
                            <I18n.option value="stock">Stock</I18n.option>
                            <I18n.option value="crypto">Crypto</I18n.option>
                          </I18n.select>
                        </I18n.td>
                        <I18n.td className="p-3">
                          <I18n.input
                            value={candidate.quantity}
                            onChange={(event) =>
                              updateCandidate(index, { quantity: event.target.value })
                            }
                            className="w-28 rounded-lg border border-border-accent bg-bg p-2 text-xs font-bold outline-none focus:border-accent"
                          />
                        </I18n.td>
                        <I18n.td className="p-3">
                          <I18n.input
                            value={candidate.price}
                            onChange={(event) =>
                              updateCandidate(index, { price: event.target.value })
                            }
                            className="w-28 rounded-lg border border-border-accent bg-bg p-2 text-xs font-bold outline-none focus:border-accent"
                          />
                        </I18n.td>
                        <I18n.td className="p-3 text-xs text-text-dim">
                          <I18n.select
                            aria-label={`Import currency ${index + 1}`}
                            value={candidate.currency ?? 'USD'}
                            onChange={(event) =>
                              updateCandidate(index, { currency: event.target.value as Currency })
                            }
                            className="rounded-lg border border-border-accent bg-bg p-2 text-xs"
                          >
                            <I18n.option value="" disabled>
                              Select currency
                            </I18n.option>
                            {(['USD', 'EUR', 'ARS', 'GBP'] as const).map((currency) => (
                              <I18n.option key={currency}>{currency}</I18n.option>
                            ))}
                          </I18n.select>
                        </I18n.td>
                        <I18n.td className="p-3 text-xs text-text-dim">
                          <ReceiptDetails
                            candidate={candidate}
                            index={index}
                            update={(patch) => updateCandidate(index, patch)}
                          />
                          {candidate.confidence != null
                            ? `${Math.round(candidate.confidence * 100)}%`
                            : 'Review'}
                          {candidate.notes ? ` - ${candidate.notes}` : ''}
                        </I18n.td>
                      </I18n.tr>
                    ))}
                  </I18n.tbody>
                </I18n.table>
              </I18n.fieldset>
            </I18n.div>
          )}
        </motion.div>
      )}

      <TrackedWallets initial={walletScan} />
      <I18n.div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          {
            label: 'Market value',
            value: formatMoney(totalValue),
            icon: TrendingUp,
            accent: true,
            badge: hasLivePortfolioPrices
              ? `${portfolioMetrics.livePricedCount}/${assets.length} Priced`
              : 'Estimated',
            positive: true,
          },
          {
            label: 'Cost basis',
            value: formatMoney(totalCost),
            icon: Landmark,
            badge: 'User entries',
            positive: true,
          },
          {
            label: 'Unrealized P&L',
            value: formatMoney(totalPnl),
            icon: WalletCards,
            badge: formatPercent(totalPnlPercent),
            positive: totalPnl >= 0,
          },
        ].map((card) => (
          <motion.div
            key={card.label}
            variants={motionItem}
            whileHover={{ y: -5 }}
            className={`panel-card p-6 ${card.accent ? 'border-accent/35 bg-accent/10' : ''}`}
          >
            <I18n.div className="mb-5 flex items-center justify-between">
              <I18n.div className={card.accent ? 'accent-chip' : 'quiet-chip'}>
                {card.label}
              </I18n.div>
              <card.icon className="h-5 w-5 text-accent" />
            </I18n.div>
            <I18n.div className="data-value text-3xl font-black">{card.value}</I18n.div>
            <I18n.div
              className={`mt-4 inline-flex items-center gap-1 rounded-full bg-bg/60 px-3 py-1 text-[11px] font-black ${card.positive ? 'text-accent' : 'text-loss'}`}
            >
              <ArrowUpRight className={`h-3.5 w-3.5 ${card.positive ? '' : 'rotate-90'}`} />
              {card.badge}
            </I18n.div>
          </motion.div>
        ))}
      </I18n.div>

      <motion.div variants={motionItem} className="panel-card border-accent/20 bg-accent/5 p-4">
        <I18n.div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <I18n.div>
            <I18n.div className="text-xs font-black uppercase tracking-widest">
              Portfolio data quality
            </I18n.div>
            <I18n.p className="mt-1 text-xs leading-5 text-text-dim">
              Provider marks retain native currency and reported latency. Missing prices use
              remaining average cost as an estimate. USD summaries exclude non-USD positions;
              Analytics converts them using attributed FX.
            </I18n.p>{' '}
          </I18n.div>
          <I18n.div className="flex flex-wrap gap-2">
            <I18n.span className="accent-chip">{portfolioMetrics.livePricedCount} Priced</I18n.span>
            <I18n.span className="quiet-chip">
              {assets.length - portfolioMetrics.livePricedCount} Estimated
            </I18n.span>
            <I18n.span className={`quiet-chip ${dailyChange >= 0 ? 'text-accent' : 'text-loss'}`}>
              Daily: {formatMoney(dailyChange)} ({formatPercent(dailyChangePercent)})
            </I18n.span>
          </I18n.div>
        </I18n.div>
      </motion.div>

      <I18n.div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div variants={motionItem} className="panel-card p-6 lg:col-span-1">
          <I18n.div className="mb-5 flex items-center justify-between">
            <I18n.h3 className="text-sm font-black uppercase tracking-widest">Holdings</I18n.h3>
            <I18n.span className="quiet-chip">{assets.length}</I18n.span>
          </I18n.div>
          <I18n.div className="space-y-3">
            {assets.slice(0, 6).map((asset) => {
              const holding = holdingMetricsBySymbol.get(asset.symbol.toUpperCase());
              return (
                <Link
                  key={asset.id}
                  to={getAssetPath(asset)}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-border-accent/40 bg-bg/35 p-3 transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:bg-accent/10"
                >
                  <I18n.div className="flex min-w-0 items-center gap-3">
                    <CompanyLogo
                      symbol={asset.symbol}
                      name={asset.name}
                      type={asset.type}
                      className="h-10 w-10 rounded-xl"
                      imgClassName="h-6 w-6"
                    />
                    <I18n.div className="min-w-0">
                      <I18n.div className="truncate text-sm font-black">{asset.symbol}</I18n.div>
                      <I18n.div className="truncate text-[10px] text-text-dim">
                        {asset.quantityExact || asset.totalQuantity} units ·{' '}
                        {holding?.isEstimated ? 'Estimated' : 'Provider mark'}
                      </I18n.div>
                      <DataProvenance
                        quote={{
                          provider:
                            priceSnapshots[asset.symbol]?.provider ||
                            priceSnapshots[asset.symbol]?.source,
                          currency:
                            priceSnapshots[asset.symbol]?.currency || asset.currency || 'USD',
                          status: priceSnapshots[asset.symbol]?.status || 'unavailable',
                          stale: priceSnapshots[asset.symbol]?.stale,
                          exchange: priceSnapshots[asset.symbol]?.exchange,
                          updatedAt: priceSnapshots[asset.symbol]?.updatedAt,
                        }}
                      />
                    </I18n.div>
                  </I18n.div>
                  <I18n.div className="shrink-0 text-right">
                    <I18n.div className="data-value text-sm font-black">
                      {formatMoney(
                        holding?.currentValue ?? asset.averagePrice * asset.totalQuantity,
                        asset.currency || 'USD',
                      )}
                    </I18n.div>
                    <I18n.div
                      className={`mt-1 text-[10px] font-black ${Number(holding?.pnl || 0) >= 0 ? 'text-accent' : 'text-loss'}`}
                    >
                      {formatPercent(holding?.pnlPercent ?? null)}
                    </I18n.div>
                  </I18n.div>
                </Link>
              );
            })}
            {assets.length === 0 && (
              <I18n.div className="rounded-2xl border border-dashed border-border-accent p-8 text-center text-xs text-text-dim">
                Add your first position to unlock portfolio analytics.
              </I18n.div>
            )}
          </I18n.div>
        </motion.div>

        <motion.div variants={motionItem} className="panel-card p-6 lg:col-span-2">
          <I18n.div className="mb-5 flex items-start justify-between">
            <I18n.div>
              <I18n.h3 className="text-sm font-black uppercase tracking-widest">Value path</I18n.h3>
              <I18n.div className="mt-1 text-xs text-text-dim">
                {formatMoney(totalValue)} current market value ·{' '}
                {hasValueHistory
                  ? `${chartData.length} saved daily snapshots`
                  : 'history starts after two daily snapshots'}
              </I18n.div>
            </I18n.div>
            <I18n.span className={hasValueHistory ? 'accent-chip' : 'quiet-chip'}>
              {hasValueHistory ? 'Recorded marks' : 'History unavailable'}
            </I18n.span>
          </I18n.div>
          {hasValueHistory ? (
            <I18n.div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="portfolioFlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartColor} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border-accent)"
                    opacity={0.4}
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-dim)', fontSize: 10 }}
                  />
                  <YAxis
                    domain={chartDomain}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-dim)', fontSize: 10 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--surface)',
                      border: '1px solid var(--border-accent)',
                      borderRadius: '16px',
                      color: 'var(--text-main)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={chartColor}
                    fillOpacity={1}
                    fill="url(#portfolioFlow)"
                    strokeWidth={3}
                    dot={{ r: 4, fill: chartColor, strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </I18n.div>
          ) : (
            <I18n.div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border-accent bg-bg/35 p-8 text-center">
              <TrendingUp className="h-8 w-8 text-accent opacity-70" />
              <I18n.h4 className="mt-4 text-sm font-black uppercase tracking-widest">
                Waiting for real history
              </I18n.h4>
              <I18n.p className="mt-2 max-w-md text-xs leading-6 text-text-dim">
                {brand.name} saves one holdings mark per day. Marks can include estimates and change
                when you deposit, buy or sell; this chart does not represent investment return.
              </I18n.p>
            </I18n.div>
          )}
        </motion.div>
      </I18n.div>

      <motion.div variants={motionItem} className="panel-card p-6">
        <I18n.div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <I18n.h3 className="text-sm font-black uppercase tracking-widest">
            Recent activity
          </I18n.h3>
          <I18n.div className="flex items-center gap-2">
            <I18n.div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
              <I18n.input
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="Search symbol"
                className="rounded-full border border-border-accent bg-bg py-2 pl-9 pr-3 text-sm outline-none focus:border-accent"
              />
            </I18n.div>
            <I18n.button className="rounded-xl border border-border-accent bg-bg p-2 text-text-dim transition-all hover:border-accent hover:text-accent">
              <Filter className="h-4 w-4" />
            </I18n.button>
          </I18n.div>
        </I18n.div>
        <I18n.div className="overflow-x-auto">
          <I18n.table className="w-full text-left">
            <I18n.thead>
              <I18n.tr className="text-[11px] uppercase tracking-widest text-text-dim">
                <I18n.th className="pb-3">Asset</I18n.th>
                <I18n.th className="pb-3">Order</I18n.th>
                <I18n.th className="pb-3">Date</I18n.th>
                <I18n.th className="pb-3">Quantity</I18n.th>
                <I18n.th className="pb-3">Price</I18n.th>
                <I18n.th className="pb-3">Status</I18n.th>
              </I18n.tr>
            </I18n.thead>
            <I18n.tbody>
              {filteredTransactions.map((tx) => (
                <I18n.tr key={tx.id} className="border-t border-border-accent/30">
                  <I18n.td className="py-4 text-sm font-bold">
                    {tx.type.toUpperCase()} {tx.assetSymbol}
                  </I18n.td>
                  <I18n.td className="py-4 text-sm text-text-dim">INV_{tx.id?.slice(0, 6)}</I18n.td>
                  <I18n.td className="py-4 text-sm">
                    {new Date(tx.date).toLocaleDateString(locale)}
                  </I18n.td>
                  <I18n.td className="py-4 text-sm">{tx.quantity}</I18n.td>
                  <I18n.td className="py-4 text-sm">
                    {formatMoney(tx.price, tx.currency || 'USD')}
                  </I18n.td>
                  <I18n.td className="py-4">
                    <I18n.span className="stat-badge stat-up">Completed</I18n.span>
                  </I18n.td>
                </I18n.tr>
              ))}
              {filteredTransactions.length === 0 && (
                <I18n.tr className="border-t border-border-accent/30">
                  <I18n.td className="py-8 text-center text-sm text-text-dim" colSpan={6}>
                    No transactions found
                  </I18n.td>
                </I18n.tr>
              )}
            </I18n.tbody>
          </I18n.table>
        </I18n.div>
      </motion.div>
    </motion.div>
  );
}
