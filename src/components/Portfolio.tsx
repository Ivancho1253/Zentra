import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { addDoc, collection, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowLeft, ArrowUpRight, Camera, Check, FileText, Filter, KeyRound, Landmark, Plus, Search, Shield, Sparkles, TrendingUp, Upload, Wallet, WalletCards } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { Asset, PortfolioSnapshot, Transaction } from '../types';
import CompanyLogo from './CompanyLogo';
import { calculatePortfolioMetrics, PortfolioPriceSnapshot } from '../services/portfolioService';
import { apiFetch } from '../lib/api';
import { trackEvent } from '../lib/analytics';

declare global {
  interface Window {
    ethereum?: {
      providers?: Array<{
        isMetaMask?: boolean;
        isCoinbaseWallet?: boolean;
        isRabby?: boolean;
        request: (args: { method: string; params?: any[] }) => Promise<any>;
      }>;
      isMetaMask?: boolean;
      isCoinbaseWallet?: boolean;
      isRabby?: boolean;
      request: (args: { method: string; params?: any[] }) => Promise<any>;
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
  confidence?: number | null;
  notes?: string;
}

interface MarketSuggestion {
  symbol: string;
  name: string;
  type: 'stock' | 'crypto';
  price?: string | number | null;
}

export default function Portfolio() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
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
  const [walletAddress, setWalletAddress] = useState('');
  const [walletStatus, setWalletStatus] = useState('');
  const [walletLoading, setWalletLoading] = useState(false);
  const [selectedWalletIndex, setSelectedWalletIndex] = useState(0);
  const [walletEcosystem, setWalletEcosystem] = useState<WalletEcosystem>('evm');
  const [screenshotStatus, setScreenshotStatus] = useState('');
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const [importCandidates, setImportCandidates] = useState<ImportCandidate[]>([]);
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

    const unsubAssets = onSnapshot(query(collection(db, 'users', auth.currentUser.uid, 'assets')), (snapshot) => {
      setAssets(snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Asset)));
    });

    const unsubTx = onSnapshot(query(collection(db, 'users', auth.currentUser.uid, 'transactions')), (snapshot) => {
      setTransactions(snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Transaction)));
      setLoading(false);
    });

    const unsubSnapshots = onSnapshot(
      query(collection(db, 'users', auth.currentUser.uid, 'snapshots'), orderBy('date', 'asc'), limit(365)),
      (snapshot) => {
        setSnapshots(snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as PortfolioSnapshot)));
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

    const normalizeAsset = (asset: any, fallbackType: 'stock' | 'crypto'): MarketSuggestion => ({
      symbol: String(asset?.symbol || '').toUpperCase(),
      name: asset?.name || asset?.symbol || '',
      type: asset?.type === 'crypto' || fallbackType === 'crypto' ? 'crypto' : 'stock',
      price: asset?.price ?? null,
    });

    const fetchSuggestions = async () => {
      try {
        const [stocksRes, cryptosRes] = await Promise.all([
          fetch(`/api/market/stocks?t=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/api/market/cryptos?t=${Date.now()}`, { cache: 'no-store' }),
        ]);
        const [stocksData, cryptosData] = await Promise.all([stocksRes.json(), cryptosRes.json()]);
        const combined = [
          ...(stocksData.data || []).map((asset: any) => normalizeAsset(asset, 'stock')),
          ...(cryptosData.data || []).map((asset: any) => normalizeAsset(asset, 'crypto')),
        ].filter((asset) => asset.symbol);
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
      const results = await Promise.allSettled(assets.map(async (asset) => {
        const response = await fetch(`/api/market/asset?symbol=${encodeURIComponent(asset.symbol)}&type=${asset.type}&t=${Date.now()}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Market snapshot failed');
        return [asset.symbol.toUpperCase(), data] as const;
      }));

      if (cancelled) return;

      const nextSnapshots: Record<string, PortfolioPriceSnapshot> = {};
      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          const [assetSymbol, snapshot] = result.value;
          nextSnapshots[assetSymbol] = snapshot;
        }
      });
      setPriceSnapshots(nextSnapshots);
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
  const holdingMetricsBySymbol = new Map(portfolioMetrics.holdings.map((holding) => [holding.asset.symbol.toUpperCase(), holding]));

  useEffect(() => {
    if (!auth.currentUser || assets.length === 0 || portfolioMetrics.totalCurrentValue <= 0) return;

    const snapshotDate = new Date().toISOString().slice(0, 10);
    const snapshotRef = doc(db, 'users', auth.currentUser.uid, 'snapshots', snapshotDate);

    setDoc(snapshotRef, {
      date: snapshotDate,
      totalValue: portfolioMetrics.totalCurrentValue,
      totalCost: portfolioMetrics.totalCost,
      totalPnl: portfolioMetrics.totalPnl,
      totalPnlPercent: portfolioMetrics.totalPnlPercent,
      livePricedCount: portfolioMetrics.livePricedCount,
      holdingsCount: assets.length,
      createdAt: new Date().toISOString(),
    }, { merge: true }).catch((error) => {
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
  const chartData = snapshots.map((snapshot) => ({
    name: new Date(`${snapshot.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    value: Math.round(snapshot.totalValue),
  }));
  const hasValueHistory = chartData.length >= 2;

  const formatMoney = (value: number) => {
    if (!Number.isFinite(value)) return '$0.00';
    return `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
      fetchAssetPrice(asset.symbol, asset.type).then((nextPrice) => {
        if (nextPrice) setPrice(String(nextPrice));
      }).catch(() => undefined);
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

  const savePosition = async (position: { symbol: string; name?: string; type: 'stock' | 'crypto'; quantity: number; price: number }) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    const userId = auth.currentUser.uid;
    const cleanSymbol = position.symbol.trim().toUpperCase();

    await addDoc(collection(db, 'users', userId, 'transactions'), {
      assetSymbol: cleanSymbol,
      type: 'buy',
      quantity: position.quantity,
      price: position.price,
      date: new Date().toISOString(),
      userId,
    });

    const assetRef = doc(db, 'users', userId, 'assets', cleanSymbol);
    const assetSnap = await getDoc(assetRef);

    if (assetSnap.exists()) {
      const currentData = assetSnap.data() as Asset;
      const newQty = Number(currentData.totalQuantity || 0) + position.quantity;
      const newAvgPrice = ((Number(currentData.averagePrice || 0) * Number(currentData.totalQuantity || 0)) + (position.price * position.quantity)) / newQty;
      await updateDoc(assetRef, { totalQuantity: newQty, averagePrice: newAvgPrice, lastUpdated: new Date().toISOString() });
    } else {
      await setDoc(assetRef, {
        symbol: cleanSymbol,
        name: position.name?.trim() || cleanSymbol,
        type: position.type,
        averagePrice: position.price,
        totalQuantity: position.quantity,
        lastUpdated: new Date().toISOString(),
      });
    }
  };

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const qtyNum = parseFloat(quantity);
    const priceNum = parseFloat(price);
    const cleanSymbol = symbol.trim().toUpperCase();

    if (!cleanSymbol || !Number.isFinite(qtyNum) || !Number.isFinite(priceNum) || qtyNum <= 0 || priceNum <= 0) {
      setFormError('Enter a valid symbol, quantity and price greater than zero.');
      return;
    }

    try {
      setFormError('');
      await savePosition({ symbol: cleanSymbol, name: name.trim() || cleanSymbol, type, quantity: qtyNum, price: priceNum });

      setSymbol('');
      setName('');
      setQuantity('');
      setPrice('');
      setIsAdding(false);
      trackEvent('portfolio_position_added', { type, source: 'manual' });
    } catch (error) {
      console.error('Error adding asset:', error);
      trackEvent('portfolio_position_add_failed', { type, source: 'manual' });
      setFormError('Could not save the position. Please try again.');
    }
  };

  const fetchAssetPrice = async (assetSymbol: string, assetType: 'stock' | 'crypto') => {
    const response = await fetch(`/api/market/asset?symbol=${encodeURIComponent(assetSymbol)}&type=${assetType}&t=${Date.now()}`, { cache: 'no-store' });
    const data = await response.json();
    const numericPrice = Number(data?.price);
    return Number.isFinite(numericPrice) && numericPrice > 0 ? numericPrice : null;
  };

  const getEvmWalletProviders = () => {
    if (!window.ethereum) return [];
    const providers = window.ethereum.providers?.length ? window.ethereum.providers : [window.ethereum];
    return providers.map((provider, index) => {
      const name = provider.isCoinbaseWallet ? 'Coinbase Wallet' : provider.isRabby ? 'Rabby' : provider.isMetaMask ? 'MetaMask' : `Browser wallet ${index + 1}`;
      return { provider, name, index };
    });
  };

  const getVisibleWalletProviders = () => {
    if (walletEcosystem === 'evm') return getEvmWalletProviders().map((wallet) => ({ name: wallet.name, index: wallet.index }));
    if (walletEcosystem === 'solana') {
      const provider = window.phantom?.solana || window.solana;
      return provider ? [{ name: provider.isPhantom ? 'Phantom' : 'Solana wallet', index: 0 }] : [];
    }
    return window.suiWallet ? [{ name: 'Sui Wallet', index: 0 }] : [];
  };

  const scanReadOnlyWallet = async (address: string, ecosystem: WalletEcosystem = walletEcosystem) => {
    const response = await apiFetch(`/api/wallet/read-only?address=${encodeURIComponent(address)}&ecosystem=${ecosystem}&t=${Date.now()}`, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Wallet scan failed');

    const candidates = (data.positions || []).map((position: any): ImportCandidate => ({
      symbol: String(position.symbol || '').toUpperCase(),
      name: position.name || position.symbol || '',
      type: 'crypto',
      quantity: position.quantity ? String(position.quantity) : '',
      price: position.price ? String(position.price) : '',
      confidence: 1,
      notes: `${position.chain} ${position.source === 'native' ? 'native balance' : 'token balance'} read-only.`,
    })).filter((asset: ImportCandidate) => asset.symbol && Number(asset.quantity) > 0);

    setImportCandidates(candidates);
    const networkCount = Array.isArray(data.networks) ? data.networks.length : 0;
    const symbolList = Array.isArray(data.supportedSymbols) ? data.supportedSymbols.slice(0, 12).join(', ') : '';
    const ecosystemLabel = ecosystem === 'evm' ? 'EVM' : ecosystem === 'solana' ? 'Solana' : 'Sui';
    setWalletStatus(
      candidates.length > 0
        ? `Read-only ${ecosystemLabel} scan found ${candidates.length} crypto position${candidates.length === 1 ? '' : 's'} across ${networkCount} network${networkCount === 1 ? '' : 's'}. Review quantities and prices before importing.`
        : `Wallet linked in read-only mode, but no supported ZENTRA crypto balances were detected yet. Scanned ${networkCount} ${ecosystemLabel} network${networkCount === 1 ? '' : 's'} for ${symbolList}.`
    );
    trackEvent('wallet_scan_completed', { ecosystem, positions: candidates.length, networks: networkCount });
  };

  const connectReadOnlyWallet = async () => {
    setWalletStatus('');
    setFormError('');

    try {
      setWalletLoading(true);
      if (walletEcosystem === 'evm') {
        const providers = getEvmWalletProviders();
        const selectedProvider = providers[selectedWalletIndex]?.provider;

        if (!selectedProvider) {
          setWalletStatus('Install or open MetaMask, Coinbase Wallet, Rabby, or another EVM wallet to link it in read-only mode.');
          return;
        }

        try {
          await selectedProvider.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] });
        } catch {
          // Some wallets do not support permission prompts; eth_requestAccounts remains the fallback.
        }
        const accounts = await selectedProvider.request({ method: 'eth_requestAccounts' });
        const account = String(accounts?.[0] || '');
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
        setWalletStatus('Install or open a Sui wallet to link it in read-only mode, or paste a public Sui address.');
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
      setWalletStatus('Could not scan the wallet. No transaction, signature or token approval was requested.');
    } finally {
      setWalletLoading(false);
    }
  };

  const linkManualReadOnlyAddress = async () => {
    const cleanAddress = walletAddress.trim();
    const isValidAddress = walletEcosystem === 'evm'
      ? /^0x[a-fA-F0-9]{40}$/.test(cleanAddress)
      : walletEcosystem === 'sui'
        ? /^0x[a-fA-F0-9]{64}$/.test(cleanAddress)
        : /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(cleanAddress);

    if (!isValidAddress) {
      setWalletStatus(`Enter a valid public ${walletEcosystem.toUpperCase()} wallet address.`);
      return;
    }

    try {
      setWalletLoading(true);
      setImportCandidates([]);
      setWalletStatus('Scanning public balances across supported ZENTRA networks...');
      await scanReadOnlyWallet(cleanAddress, walletEcosystem);
    } catch (error) {
      console.error('Manual wallet scan failed:', error);
      trackEvent('wallet_scan_failed', { ecosystem: walletEcosystem, mode: 'manual_address' });
      setWalletStatus('Could not scan that address right now. No transaction, signature or wallet access was requested.');
    } finally {
      setWalletLoading(false);
    }
  };

  const analyzeScreenshot = async (file: File | null) => {
    if (!file) return;
    setScreenshotStatus('');
    setFormError('');
    setImportCandidates([]);

    const maxFileSize = 12 * 1024 * 1024;
    if (file.size > maxFileSize) {
      setScreenshotStatus('That file is too large. Try a file under 12MB or export only the portfolio sheet.');
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
        body: JSON.stringify({ fileBase64: imageBase64, mimeType: file.type || 'application/octet-stream', fileName: file.name }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Screenshot import failed');

      const candidates = (data.assets || []).map((asset: any): ImportCandidate => ({
        symbol: String(asset.symbol || '').toUpperCase(),
        name: asset.name || asset.symbol || '',
        type: asset.type === 'crypto' ? 'crypto' : 'stock',
        quantity: asset.quantity ? String(asset.quantity) : '',
        price: asset.averagePrice ? String(asset.averagePrice) : '',
        confidence: asset.confidence,
        notes: asset.notes || '',
      })).filter((asset: ImportCandidate) => asset.symbol);

      setImportCandidates(candidates);
      setScreenshotStatus(
        candidates.length > 0
          ? `${data.source === 'fallback-parser' ? 'Fallback parser' : 'AI'} detected ${candidates.length} position${candidates.length === 1 ? '' : 's'}. Review every row before importing.`
          : 'No positions were detected. Make sure the file shows ticker/symbol, quantity and buy or average price.'
      );
      trackEvent('portfolio_import_file_analyzed', {
        source: data.source || 'unknown',
        positions: candidates.length,
        mimeType: file.type || 'unknown',
      });
    } catch (error) {
      console.error('Screenshot analysis failed:', error);
      trackEvent('portfolio_import_file_failed', { mimeType: file.type || 'unknown' });
      setScreenshotStatus('Could not read that file. Try a clearer screenshot, CSV, Excel or Word document with symbols, quantities and average prices visible.');
    } finally {
      setScreenshotLoading(false);
    }
  };

  const updateCandidate = (index: number, patch: Partial<ImportCandidate>) => {
    setImportCandidates((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  };

  const importDetectedPositions = async () => {
    if (!auth.currentUser) return;

    const validCandidates = importCandidates
      .map((candidate) => ({
        ...candidate,
        parsedQuantity: Number(candidate.quantity),
        parsedPrice: Number(candidate.price),
      }))
      .filter((candidate) => candidate.symbol && Number.isFinite(candidate.parsedQuantity) && candidate.parsedQuantity > 0 && Number.isFinite(candidate.parsedPrice) && candidate.parsedPrice > 0);

    if (validCandidates.length === 0) {
      setFormError('Review the detected rows. Every import needs symbol, quantity and buy price.');
      return;
    }

    try {
      setFormError('');
      for (const candidate of validCandidates) {
        await savePosition({
          symbol: candidate.symbol,
          name: candidate.name || candidate.symbol,
          type: candidate.type,
          quantity: candidate.parsedQuantity,
          price: candidate.parsedPrice,
        });
      }
      setImportCandidates([]);
      setScreenshotStatus('');
      setWalletStatus('');
      setIsAdding(false);
      trackEvent('portfolio_import_positions_saved', { positions: validCandidates.length });
    } catch (error) {
      console.error('Bulk import failed:', error);
      trackEvent('portfolio_import_positions_failed', { positions: validCandidates.length });
      setFormError('Could not import the detected positions. Please try again.');
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
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent animate-pulse">Syncing portfolio...</div>
        </div>
      </div>
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
        description: 'Scan public balances across supported networks. ZENTRA never requests approvals.',
        icon: Shield,
      },
      {
        id: 'screenshot',
        label: 'AI import',
                description: 'Upload screenshots, XLSX spreadsheets, CSV, TXT or Word files and review before saving.',
        icon: Sparkles,
      },
    ] as const;

    return (
      <motion.div className="app-page" initial="hidden" animate="show" transition={{ staggerChildren: 0.07 }}>
        <motion.section variants={motionItem} className="app-hero overflow-visible">
          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-4">
              <button onClick={closeAddFlow} className="rounded-2xl border border-border-accent bg-bg/50 p-3 transition-all hover:border-accent hover:text-accent">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <div className="accent-chip mb-4"><WalletCards className="h-3.5 w-3.5" /> Portfolio import center</div>
                <h1 className="max-w-4xl text-4xl font-black uppercase tracking-tighter md:text-6xl">Add positions with confidence</h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-text-dim">
                  Registering your investments is one of the most important parts of ZENTRA. Choose the fastest path, review every number, and only save when symbol, quantity and buy price are right.
                </p>
              </div>
            </div>
            <button type="button" onClick={closeAddFlow} className="rounded-2xl border border-border-accent px-5 py-3 text-[10px] font-black uppercase tracking-widest text-text-dim transition-all hover:border-accent hover:text-text-main">
              Cancel import
            </button>
          </div>
          <div className="absolute bottom-0 left-0 h-px w-full scanline" />
        </motion.section>

        <motion.div variants={motionItem} className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_1fr]">
          <aside className="panel-card p-4">
            <div className="mb-4 px-2 text-[10px] font-black uppercase tracking-[0.24em] text-text-dim">Import method</div>
            <div className="space-y-3">
              {addOptions.map((option) => (
                <button
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
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${addMode === option.id ? 'bg-accent text-bg' : 'border border-border-accent text-accent'}`}>
                    <option.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-black uppercase tracking-wide">{option.label}</div>
                    <p className="mt-1 text-xs leading-5 text-text-dim">{option.description}</p>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-accent/25 bg-accent/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-accent"><KeyRound className="h-4 w-4" /> Safety promise</div>
              <p className="text-xs leading-6 text-text-dim">
                ZENTRA never asks for seed phrases, private keys, token approvals or transactions. Imports are saved only after your review.
              </p>
            </div>
          </aside>

          <section className="panel-card min-w-0 p-5 md:p-7">
            {formError && <div className="mb-5 flex items-center gap-2 rounded-xl border border-loss/40 bg-loss/10 p-3 text-xs font-bold text-loss"><AlertCircle className="h-4 w-4" />{formError}</div>}

            {addMode === 'manual' && (
              <form onSubmit={handleAddAsset} className="space-y-6">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-widest"><Search className="h-4 w-4 text-accent" /> Find the asset</div>
                  <p className="mb-4 text-xs leading-6 text-text-dim">Start typing a symbol or company name. Selecting a result fills name, type and live price when available.</p>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-text-dim" />
                    <input
                      type="text"
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
                      <div className="absolute left-0 right-0 top-full z-40 mt-3 max-h-[430px] overflow-y-auto rounded-2xl border border-accent/40 bg-surface shadow-2xl">
                        {filteredSymbolSuggestions.map((asset) => {
                          const numericPrice = Number(asset.price);
                          return (
                            <button
                              key={`${asset.type}-${asset.symbol}`}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault();
                                selectSuggestedAsset(asset);
                              }}
                              className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 border-b border-border-accent/40 px-4 py-4 text-left transition-all last:border-b-0 hover:bg-accent/10"
                            >
                              <CompanyLogo symbol={asset.symbol} name={asset.name} type={asset.type} className="h-12 w-12 rounded-2xl" imgClassName="h-7 w-7" />
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-lg font-black">{asset.symbol}</span>
                                  <span className="rounded-full border border-border-accent px-2 py-1 text-[9px] font-black uppercase tracking-widest text-accent">{asset.type}</span>
                                </div>
                                <div className="mt-1 truncate text-xs text-text-dim">{asset.name || asset.symbol}</div>
                              </div>
                              <div className="shrink-0 text-right">
                                {Number.isFinite(numericPrice) && numericPrice > 0 ? (
                                  <div className="data-value text-sm">{formatMoney(numericPrice)}</div>
                                ) : (
                                  <div className="text-[10px] font-black uppercase tracking-widest text-text-dim">Price lookup</div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.7fr]">
                  <div className="flex flex-col">
                    <label className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">Name</label>
                    <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Apple Inc." className="rounded-xl border border-border-accent bg-bg p-4 text-sm font-bold outline-none transition-colors focus:border-accent" />
                  </div>
                  <div className="flex flex-col">
                    <label className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">Quantity *</label>
                    <input type="number" step="any" min="0" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="0.00" className="rounded-xl border border-border-accent bg-bg p-4 text-sm font-bold outline-none transition-colors focus:border-accent" required />
                  </div>
                  <div className="flex flex-col">
                    <label className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">Buy price *</label>
                    <input type="number" step="any" min="0" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" className="rounded-xl border border-border-accent bg-bg p-4 text-sm font-bold outline-none transition-colors focus:border-accent" required />
                  </div>
                  <div className="flex flex-col">
                    <label className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">Type *</label>
                    <select value={type} onChange={(event) => setType(event.target.value as 'stock' | 'crypto')} className="rounded-xl border border-border-accent bg-bg p-4 text-sm font-bold outline-none transition-colors focus:border-accent">
                      <option value="stock">Stock</option>
                      <option value="crypto">Crypto</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-border-accent pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs leading-6 text-text-dim">Use your actual entry price, not necessarily the current market price.</div>
                  <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-7 py-4 text-[10px] font-black uppercase tracking-widest text-bg transition-all hover:brightness-110">
                    <Check className="h-4 w-4" />
                    Save position
                  </button>
                </div>
              </form>
            )}

            {addMode === 'wallet' && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-border-accent bg-bg/45 p-5">
                  <div className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-widest"><Shield className="h-4 w-4 text-accent" /> Wallet universe import</div>
                  <p className="text-sm leading-7 text-text-dim">Choose a wallet ecosystem, connect only to reveal your public address, or paste an address manually. ZENTRA scans public balances only. No seed phrases, private keys, approvals, signatures or transactions.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    { id: 'evm', label: 'MetaMask / EVM', detail: 'Ethereum, Base, Arbitrum, Optimism, Polygon, BNB, Avalanche' },
                    { id: 'solana', label: 'Phantom / Solana', detail: 'SOL, USDC, USDT, JUP, RAY, BONK, WIF' },
                    { id: 'sui', label: 'Sui Wallet', detail: 'SUI and supported Sui coins' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setWalletEcosystem(item.id as WalletEcosystem);
                        setSelectedWalletIndex(0);
                        setWalletStatus('');
                      }}
                      className={`rounded-2xl border p-4 text-left transition-all ${walletEcosystem === item.id ? 'border-accent/60 bg-accent/10' : 'border-border-accent bg-bg/35 hover:border-accent/50'}`}
                    >
                      <div className="text-xs font-black uppercase tracking-widest">{item.label}</div>
                      <div className="mt-2 text-[11px] leading-5 text-text-dim">{item.detail}</div>
                    </button>
                  ))}
                </div>
                {walletProviders.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {walletProviders.map((wallet) => (
                      <button
                        key={`${wallet.name}-${wallet.index}`}
                        type="button"
                        onClick={() => setSelectedWalletIndex(wallet.index)}
                        className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedWalletIndex === wallet.index ? 'bg-accent text-bg' : 'border border-border-accent bg-bg/60 text-text-dim hover:border-accent hover:text-text-main'}`}
                      >
                        {wallet.name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto_auto_auto]">
                  <input value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} placeholder={walletEcosystem === 'evm' ? 'Paste public 0x EVM address' : walletEcosystem === 'solana' ? 'Paste public Solana address' : 'Paste public Sui address'} className="rounded-xl border border-border-accent bg-bg p-4 text-sm font-bold outline-none transition-colors focus:border-accent" />
                  <button type="button" onClick={connectReadOnlyWallet} disabled={walletLoading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-4 text-[10px] font-black uppercase tracking-widest text-bg transition-all hover:opacity-90 disabled:opacity-60">
                    <Wallet className="h-4 w-4" />
                    {walletLoading ? 'Reading wallet' : 'Connect wallet'}
                  </button>
                  <button type="button" onClick={linkManualReadOnlyAddress} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-accent px-5 py-4 text-[10px] font-black uppercase tracking-widest text-text-dim transition-all hover:border-accent hover:text-text-main">
                    Link address
                  </button>
                  <button type="button" onClick={() => void resetWalletLink()} disabled={walletLoading && !walletAddress && importCandidates.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl border border-loss/40 px-5 py-4 text-[10px] font-black uppercase tracking-widest text-loss transition-all hover:bg-loss/10 disabled:cursor-not-allowed disabled:opacity-40">
                    Reset wallet
                  </button>
                </div>
                <div className="rounded-2xl border border-border-accent bg-bg/35 p-4 text-xs leading-6 text-text-dim">
                  ZENTRA now supports EVM, Solana and Sui read-only imports. Bitcoin, XRP, Cardano and exchange accounts need dedicated adapters or user-uploaded statements next, because they do not expose the same browser wallet standard.
                </div>
                {walletStatus && <div className="rounded-xl border border-border-accent bg-bg/45 p-3 text-xs font-bold text-text-dim">{walletStatus}</div>}
              </div>
            )}

            {addMode === 'screenshot' && (
              <div className="space-y-5">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-accent/50 bg-accent/5 p-10 text-center transition-all hover:bg-accent/10">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl bg-accent text-bg shadow-[0_0_28px_rgba(124,255,26,0.28)]">
                    <Upload className="h-7 w-7" />
                  </div>
                  <div>
                    <div className="text-lg font-black uppercase tracking-widest">Upload a portfolio file</div>
                    <div className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-text-dim">AI reads visible symbols, quantities and average buy prices from screenshots, CSV/TXT, XLSX and Word files. You review every detected row before it enters your portfolio.</div>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-text-dim">
                    {['PNG/JPG', 'CSV/TXT', 'XLSX', 'DOCX'].map((item) => <span key={item} className="rounded-full border border-border-accent px-3 py-1">{item}</span>)}
                  </div>
                  <input type="file" accept="image/*,.csv,.txt,.xlsx,.docx" className="hidden" onChange={(event) => analyzeScreenshot(event.target.files?.[0] || null)} />
                </label>
                {screenshotLoading && <div className="rounded-xl border border-border-accent bg-bg/45 p-3 text-xs font-bold text-accent">Reading file with AI...</div>}
                {screenshotStatus && <div className="rounded-xl border border-border-accent bg-bg/45 p-3 text-xs font-bold text-text-dim">{screenshotStatus}</div>}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {[
                    { icon: FileText, title: 'Extract', text: 'Symbols, names, quantities and buy prices.' },
                    { icon: Search, title: 'Review', text: 'You can edit every row before saving.' },
                    { icon: Check, title: 'Import', text: 'Valid rows become portfolio positions.' },
                  ].map((step) => (
                    <div key={step.title} className="rounded-2xl border border-border-accent bg-bg/35 p-4">
                      <step.icon className="mb-3 h-5 w-5 text-accent" />
                      <div className="text-xs font-black uppercase tracking-widest">{step.title}</div>
                      <p className="mt-2 text-xs leading-5 text-text-dim">{step.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importCandidates.length > 0 && (
              <div className="mt-7 overflow-hidden rounded-2xl border border-border-accent">
                <div className="flex flex-col gap-3 border-b border-border-accent bg-bg/55 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-widest">Review import</div>
                    <div className="mt-1 text-[11px] text-text-dim">Only rows with symbol, quantity and buy price will be saved.</div>
                  </div>
                  <button type="button" onClick={importDetectedPositions} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-[10px] font-black uppercase tracking-widest text-bg">
                    <Check className="h-4 w-4" />
                    Import valid rows
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-bg/35 text-[10px] uppercase tracking-widest text-text-dim">
                        <th className="p-3">Symbol</th>
                        <th className="p-3">Name</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Quantity</th>
                        <th className="p-3">Buy price</th>
                        <th className="p-3">Confidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importCandidates.map((candidate, index) => (
                        <tr key={`${candidate.symbol}-${index}`} className="border-t border-border-accent/40">
                          <td className="p-3"><input value={candidate.symbol} onChange={(event) => updateCandidate(index, { symbol: event.target.value.toUpperCase() })} className="w-24 rounded-lg border border-border-accent bg-bg p-2 text-xs font-black outline-none focus:border-accent" /></td>
                          <td className="p-3"><input value={candidate.name} onChange={(event) => updateCandidate(index, { name: event.target.value })} className="min-w-40 rounded-lg border border-border-accent bg-bg p-2 text-xs font-bold outline-none focus:border-accent" /></td>
                          <td className="p-3">
                            <select value={candidate.type} onChange={(event) => updateCandidate(index, { type: event.target.value as 'stock' | 'crypto' })} className="rounded-lg border border-border-accent bg-bg p-2 text-xs font-bold outline-none focus:border-accent">
                              <option value="stock">Stock</option>
                              <option value="crypto">Crypto</option>
                            </select>
                          </td>
                          <td className="p-3"><input value={candidate.quantity} onChange={(event) => updateCandidate(index, { quantity: event.target.value })} className="w-28 rounded-lg border border-border-accent bg-bg p-2 text-xs font-bold outline-none focus:border-accent" /></td>
                          <td className="p-3"><input value={candidate.price} onChange={(event) => updateCandidate(index, { price: event.target.value })} className="w-28 rounded-lg border border-border-accent bg-bg p-2 text-xs font-bold outline-none focus:border-accent" /></td>
                          <td className="p-3 text-xs text-text-dim">{candidate.confidence != null ? `${Math.round(candidate.confidence * 100)}%` : 'Review'}{candidate.notes ? ` - ${candidate.notes}` : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div className="app-page" initial="hidden" animate="show" transition={{ staggerChildren: 0.07 }}>
      <motion.section variants={motionItem} className="app-hero">
        <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-4">
            <button onClick={() => navigate(-1)} className="rounded-2xl border border-border-accent bg-bg/50 p-3 transition-all hover:border-accent hover:text-accent">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="accent-chip mb-4"><WalletCards className="h-3.5 w-3.5" /> Portfolio</div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter">Capital overview</h1>
              <p className="mt-3 max-w-2xl text-sm text-text-dim">Tus posiciones, flujo de caja y actividad reciente con una lectura mas clara.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setIsAdding(!isAdding)} className="inline-flex items-center gap-2 rounded-2xl bg-accent px-5 py-3 text-[10px] font-black uppercase tracking-widest text-bg shadow-[0_0_28px_rgba(124,255,26,0.25)] transition-all hover:scale-[1.03]">
              <Plus className="h-4 w-4" />
              Add asset
            </button>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 h-px w-full scanline" />
      </motion.section>

      {isAdding && (
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="panel-card border-accent/40 p-6">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest"><Plus className="h-4 w-4 text-accent" /> Add new position</h2>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'manual', label: 'Manual', icon: Plus },
                { id: 'wallet', label: 'Read-only wallet', icon: Shield },
                { id: 'screenshot', label: 'AI screenshot', icon: Camera },
              ].map((mode) => (
                <button
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
                </button>
              ))}
            </div>
          </div>
          {formError && <div className="mb-4 flex items-center gap-2 rounded-xl border border-loss/40 bg-loss/10 p-3 text-xs font-bold text-loss"><AlertCircle className="h-4 w-4" />{formError}</div>}

          {addMode === 'manual' && (
            <form onSubmit={handleAddAsset} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
              <div className="relative flex flex-col">
                <label className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">Symbol *</label>
                <input
                  type="text"
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
                  <div className="absolute left-0 top-full z-40 mt-2 max-h-96 w-[min(92vw,560px)] overflow-y-auto rounded-2xl border border-border-accent bg-surface shadow-2xl">
                    {filteredSymbolSuggestions.map((asset) => {
                      const numericPrice = Number(asset.price);
                      return (
                        <button
                          key={`${asset.type}-${asset.symbol}`}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault();
                            selectSuggestedAsset(asset);
                          }}
                          className="flex w-full items-center justify-between gap-4 border-b border-border-accent/40 px-4 py-3 text-left transition-all last:border-b-0 hover:bg-accent/10"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <CompanyLogo symbol={asset.symbol} name={asset.name} type={asset.type} className="h-9 w-9 rounded-xl" imgClassName="h-5 w-5" />
                            <div className="min-w-0">
                              <div className="text-sm font-black">{asset.symbol}</div>
                              <div className="max-w-[330px] truncate text-[11px] text-text-dim">{asset.name || asset.symbol}</div>
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-[10px] font-black uppercase text-accent">{asset.type}</div>
                            {Number.isFinite(numericPrice) && numericPrice > 0 && (
                              <div className="text-[10px] text-text-dim">{formatMoney(numericPrice)}</div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              {[
                { label: 'Name', value: name, set: setName, placeholder: 'Apple Inc.' },
                { label: 'Quantity *', value: quantity, set: setQuantity, placeholder: '0.00', type: 'number' },
                { label: 'Price *', value: price, set: setPrice, placeholder: '0.00', type: 'number' },
              ].map((field) => (
                <div key={field.label} className="flex flex-col">
                  <label className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">{field.label}</label>
                  <input type={field.type || 'text'} step="any" min="0" value={field.value} onChange={(e) => field.set(e.target.value)} placeholder={field.placeholder} className="rounded-xl border border-border-accent bg-bg p-3 text-sm font-bold outline-none transition-colors focus:border-accent" required={field.label.includes('*')} />
                </div>
              ))}
              <div className="flex flex-col">
                <label className="mb-2 text-[10px] font-black uppercase tracking-widest text-text-dim">Type *</label>
                <select value={type} onChange={(e) => setType(e.target.value as any)} className="rounded-xl border border-border-accent bg-bg p-3 text-sm font-bold outline-none transition-colors focus:border-accent">
                  <option value="stock">Stock</option>
                  <option value="crypto">Crypto</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 lg:col-span-5">
                <button type="button" onClick={() => setIsAdding(false)} className="rounded-xl border border-border-accent px-6 py-2 text-[10px] font-black uppercase transition-all hover:bg-surface">Cancel</button>
                <button type="submit" className="rounded-xl bg-accent px-8 py-2 text-[10px] font-black uppercase text-bg transition-all hover:opacity-90">Save position</button>
              </div>
            </form>
          )}

          {addMode === 'wallet' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border-accent bg-bg/45 p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest"><Shield className="h-4 w-4 text-accent" /> Read-only wallet link</div>
                <p className="text-xs leading-6 text-text-dim">ZENTRA only reads your public wallet address and public on-chain balances. It never asks for seed phrases, private keys, spending approvals, token permissions, signatures, or transactions.</p>
              </div>
              {walletProviders.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {walletProviders.map((wallet) => (
                    <button
                      key={`${wallet.name}-${wallet.index}`}
                      type="button"
                      onClick={() => setSelectedWalletIndex(wallet.index)}
                      className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${selectedWalletIndex === wallet.index ? 'bg-accent text-bg' : 'border border-border-accent bg-bg/60 text-text-dim hover:border-accent hover:text-text-main'}`}
                    >
                      {wallet.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_auto_auto]">
                <input value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} placeholder="0x wallet address" className="rounded-xl border border-border-accent bg-bg p-3 text-sm font-bold outline-none transition-colors focus:border-accent" />
                <button type="button" onClick={connectReadOnlyWallet} disabled={walletLoading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-[10px] font-black uppercase tracking-widest text-bg transition-all hover:opacity-90 disabled:opacity-60">
                  <Wallet className="h-4 w-4" />
                  {walletLoading ? 'Reading wallet' : 'Connect wallet'}
                </button>
                <button type="button" onClick={linkManualReadOnlyAddress} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border-accent px-5 py-3 text-[10px] font-black uppercase tracking-widest text-text-dim transition-all hover:border-accent hover:text-text-main">
                  Link address
                </button>
                <button type="button" onClick={() => void resetWalletLink()} disabled={walletLoading && !walletAddress && importCandidates.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl border border-loss/40 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-loss transition-all hover:bg-loss/10 disabled:cursor-not-allowed disabled:opacity-40">
                  Reset wallet
                </button>
              </div>
              <div className="rounded-2xl border border-border-accent bg-bg/35 p-4 text-xs leading-6 text-text-dim">
                Current wallet sync reads native ETH from browser wallets. Full token sync across Ethereum, Polygon, Base, Arbitrum, Optimism, Solana and more needs a portfolio indexer such as Zerion, Moralis, Alchemy or Covalent.
              </div>
              {walletStatus && <div className="rounded-xl border border-border-accent bg-bg/45 p-3 text-xs font-bold text-text-dim">{walletStatus}</div>}
            </div>
          )}

          {addMode === 'screenshot' && (
            <div className="space-y-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-accent/50 bg-accent/5 p-8 text-center transition-all hover:bg-accent/10">
                <Upload className="h-7 w-7 text-accent" />
                <div>
                  <div className="text-sm font-black uppercase tracking-widest">Upload screenshot, spreadsheet or document</div>
                  <div className="mt-2 text-xs text-text-dim">The AI reads visible symbols, quantities and average buy prices from images, CSV/TXT, Excel and Word files. You review everything before import.</div>
                </div>
                <input type="file" accept="image/*,.csv,.txt,.xls,.xlsx,.docx" className="hidden" onChange={(event) => analyzeScreenshot(event.target.files?.[0] || null)} />
              </label>
              {screenshotLoading && <div className="rounded-xl border border-border-accent bg-bg/45 p-3 text-xs font-bold text-accent">Reading file with AI...</div>}
              {screenshotStatus && <div className="rounded-xl border border-border-accent bg-bg/45 p-3 text-xs font-bold text-text-dim">{screenshotStatus}</div>}
            </div>
          )}

          {importCandidates.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-2xl border border-border-accent">
              <div className="flex items-center justify-between border-b border-border-accent bg-bg/55 px-4 py-3">
                <div className="text-xs font-black uppercase tracking-widest">Review import</div>
                <button type="button" onClick={importDetectedPositions} className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-[10px] font-black uppercase tracking-widest text-bg">
                  <Check className="h-4 w-4" />
                  Import valid rows
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-bg/35 text-[10px] uppercase tracking-widest text-text-dim">
                      <th className="p-3">Symbol</th>
                      <th className="p-3">Name</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Quantity</th>
                      <th className="p-3">Buy price</th>
                      <th className="p-3">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importCandidates.map((candidate, index) => (
                      <tr key={`${candidate.symbol}-${index}`} className="border-t border-border-accent/40">
                        <td className="p-3"><input value={candidate.symbol} onChange={(event) => updateCandidate(index, { symbol: event.target.value.toUpperCase() })} className="w-24 rounded-lg border border-border-accent bg-bg p-2 text-xs font-black outline-none focus:border-accent" /></td>
                        <td className="p-3"><input value={candidate.name} onChange={(event) => updateCandidate(index, { name: event.target.value })} className="min-w-40 rounded-lg border border-border-accent bg-bg p-2 text-xs font-bold outline-none focus:border-accent" /></td>
                        <td className="p-3">
                          <select value={candidate.type} onChange={(event) => updateCandidate(index, { type: event.target.value as 'stock' | 'crypto' })} className="rounded-lg border border-border-accent bg-bg p-2 text-xs font-bold outline-none focus:border-accent">
                            <option value="stock">Stock</option>
                            <option value="crypto">Crypto</option>
                          </select>
                        </td>
                        <td className="p-3"><input value={candidate.quantity} onChange={(event) => updateCandidate(index, { quantity: event.target.value })} className="w-28 rounded-lg border border-border-accent bg-bg p-2 text-xs font-bold outline-none focus:border-accent" /></td>
                        <td className="p-3"><input value={candidate.price} onChange={(event) => updateCandidate(index, { price: event.target.value })} className="w-28 rounded-lg border border-border-accent bg-bg p-2 text-xs font-bold outline-none focus:border-accent" /></td>
                        <td className="p-3 text-xs text-text-dim">{candidate.confidence != null ? `${Math.round(candidate.confidence * 100)}%` : 'Review'}{candidate.notes ? ` - ${candidate.notes}` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {[
          {
            label: 'Market value',
            value: formatMoney(totalValue),
            icon: TrendingUp,
            accent: true,
            badge: hasLivePortfolioPrices ? `${portfolioMetrics.livePricedCount}/${assets.length} Live` : 'Estimated',
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
          <motion.div key={card.label} variants={motionItem} whileHover={{ y: -5 }} className={`panel-card p-6 ${card.accent ? 'border-accent/35 bg-accent/10' : ''}`}>
            <div className="mb-5 flex items-center justify-between">
              <div className={card.accent ? 'accent-chip' : 'quiet-chip'}>{card.label}</div>
              <card.icon className="h-5 w-5 text-accent" />
            </div>
            <div className="data-value text-3xl font-black">{card.value}</div>
            <div className={`mt-4 inline-flex items-center gap-1 rounded-full bg-bg/60 px-3 py-1 text-[11px] font-black ${card.positive ? 'text-accent' : 'text-loss'}`}>
              <ArrowUpRight className={`h-3.5 w-3.5 ${card.positive ? '' : 'rotate-90'}`} />
              {card.badge}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div variants={motionItem} className="panel-card border-accent/20 bg-accent/5 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-widest">Portfolio data quality</div>
            <p className="mt-1 text-xs leading-5 text-text-dim">
              Market value uses live asset snapshots when available. Missing or fallback prices use the entry price as an estimate.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="accent-chip">{portfolioMetrics.livePricedCount} Live</span>
            <span className="quiet-chip">{assets.length - portfolioMetrics.livePricedCount} Estimated</span>
            <span className={`quiet-chip ${dailyChange >= 0 ? 'text-accent' : 'text-loss'}`}>
              Daily: {formatMoney(dailyChange)} ({formatPercent(dailyChangePercent)})
            </span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div variants={motionItem} className="panel-card p-6 lg:col-span-1">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase tracking-widest">Holdings</h3>
            <span className="quiet-chip">{assets.length}</span>
          </div>
          <div className="space-y-3">
            {assets.slice(0, 6).map((asset) => {
              const holding = holdingMetricsBySymbol.get(asset.symbol.toUpperCase());
              return (
                <Link key={asset.id} to={getAssetPath(asset)} className="flex items-center justify-between gap-3 rounded-2xl border border-border-accent/40 bg-bg/35 p-3 transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:bg-accent/10">
                  <div className="flex min-w-0 items-center gap-3">
                    <CompanyLogo symbol={asset.symbol} name={asset.name} type={asset.type} className="h-10 w-10 rounded-xl" imgClassName="h-6 w-6" />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black">{asset.symbol}</div>
                      <div className="truncate text-[10px] text-text-dim">{asset.totalQuantity} units · {holding?.isEstimated ? 'Estimated' : 'Live'}</div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="data-value text-sm font-black">{formatMoney(holding?.currentValue ?? asset.averagePrice * asset.totalQuantity)}</div>
                    <div className={`mt-1 text-[10px] font-black ${Number(holding?.pnl || 0) >= 0 ? 'text-accent' : 'text-loss'}`}>
                      {formatPercent(holding?.pnlPercent ?? null)}
                    </div>
                  </div>
                </Link>
              );
            })}
            {assets.length === 0 && <div className="rounded-2xl border border-dashed border-border-accent p-8 text-center text-xs text-text-dim">Add your first position to unlock portfolio analytics.</div>}
          </div>
        </motion.div>

        <motion.div variants={motionItem} className="panel-card p-6 lg:col-span-2">
          <div className="mb-5 flex items-start justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest">Value path</h3>
              <div className="mt-1 text-xs text-text-dim">
                {formatMoney(totalValue)} current market value · {hasValueHistory ? `${chartData.length} saved daily snapshots` : 'history starts after two daily snapshots'}
              </div>
            </div>
            <span className={hasValueHistory ? 'accent-chip' : 'quiet-chip'}>{hasValueHistory ? 'Live history' : 'No synthetic curve'}</span>
          </div>
          {hasValueHistory ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="portfolioFlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-accent)" opacity={0.4} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-dim)', fontSize: 10 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-dim)', fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border-accent)', borderRadius: '16px', color: 'var(--text-main)' }} />
                  <Area type="monotone" dataKey="value" stroke="var(--accent)" fillOpacity={1} fill="url(#portfolioFlow)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border-accent bg-bg/35 p-8 text-center">
              <TrendingUp className="h-8 w-8 text-accent opacity-70" />
              <h4 className="mt-4 text-sm font-black uppercase tracking-widest">Waiting for real history</h4>
              <p className="mt-2 max-w-md text-xs leading-6 text-text-dim">
                Zentra saves one portfolio snapshot per day. The chart appears after two real snapshots instead of using a fake performance curve.
              </p>
            </div>
          )}
        </motion.div>
      </div>

      <motion.div variants={motionItem} className="panel-card p-6">
        <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h3 className="text-sm font-black uppercase tracking-widest">Recent activity</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-dim" />
              <input value={txSearch} onChange={(e) => setTxSearch(e.target.value)} placeholder="Search symbol" className="rounded-full border border-border-accent bg-bg py-2 pl-9 pr-3 text-sm outline-none focus:border-accent" />
            </div>
            <button className="rounded-xl border border-border-accent bg-bg p-2 text-text-dim transition-all hover:border-accent hover:text-accent"><Filter className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-text-dim">
                <th className="pb-3">Asset</th>
                <th className="pb-3">Order</th>
                <th className="pb-3">Date</th>
                <th className="pb-3">Quantity</th>
                <th className="pb-3">Price</th>
                <th className="pb-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((tx) => (
                <tr key={tx.id} className="border-t border-border-accent/30">
                  <td className="py-4 text-sm font-bold">{tx.type.toUpperCase()} {tx.assetSymbol}</td>
                  <td className="py-4 text-sm text-text-dim">INV_{tx.id?.slice(0, 6)}</td>
                  <td className="py-4 text-sm">{new Date(tx.date).toLocaleDateString()}</td>
                  <td className="py-4 text-sm">{tx.quantity}</td>
                  <td className="py-4 text-sm">{formatMoney(tx.price)}</td>
                  <td className="py-4"><span className="stat-badge stat-up">Completed</span></td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr className="border-t border-border-accent/30">
                  <td className="py-8 text-center text-sm text-text-dim" colSpan={6}>No transactions found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
