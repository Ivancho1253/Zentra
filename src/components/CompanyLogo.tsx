import React, { useState, useEffect } from 'react';
import { TrendingUp } from 'lucide-react';

interface CompanyLogoProps {
  symbol: string;
  name: string;
  type?: 'stock' | 'crypto';
  className?: string;
  imgClassName?: string;
}

export default function CompanyLogo({ symbol, name, type = 'stock', className = '', imgClassName = '' }: CompanyLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [attemptIndex, setAttemptIndex] = useState(0);
  const cleanSymbol = symbol.split('/')[0].toUpperCase();

  const getLogoSources = () => {
    const companyDomains: Record<string, string[]> = {
      AAPL: ['apple.com'],
      MSFT: ['microsoft.com'],
      NVDA: ['nvidia.com'],
      AMZN: ['amazon.com'],
      META: ['facebook.com', 'about.meta.com', 'meta.com'],
      GOOGL: ['abc.xyz', 'google.com'],
      GOOG: ['abc.xyz', 'google.com'],
      TSLA: ['tesla.com'],
      NFLX: ['netflix.com'],
      AMD: ['amd.com'],
      INTC: ['intel.com'],
      ADBE: ['adobe.com'],
      CSCO: ['cisco.com'],
      PYPL: ['paypal.com'],
      SHOP: ['shopify.com'],
      PLTR: ['palantir.com'],
      CRWD: ['crowdstrike.com'],
      DDOG: ['datadoghq.com'],
      WDAY: ['workday.com'],
      TEAM: ['atlassian.com'],
    };

    const domainSources = (companyDomains[cleanSymbol] || [])
      .map((domain) => `https://logo.clearbit.com/${domain}`);

    return [
      ...domainSources,
      `https://static2.finnhub.io/logo/${cleanSymbol}.png`,
      `https://logo.clearbit.com/${cleanSymbol.toLowerCase()}.com`,
      name ? `https://logo.clearbit.com/${name.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}.com` : null,
    ].filter(Boolean) as string[];
  };

  useEffect(() => {
    const fetchLogo = async () => {
      if (!symbol) return;
      setError(false);
      setAttemptIndex(0);

      if (type === 'crypto') {
        // Cryptocurrency icons from multiple sources
        setLogoUrl(`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${cleanSymbol.toLowerCase()}.png`);
        return;
      }

      const fallbackSources = getLogoSources();

      try {
        // Try Twelve Data Logo API first
        const response = await fetch(`/api/market/logo?symbol=${encodeURIComponent(cleanSymbol)}`);
        const data = await response.json();
        
        if (data.url && !data.url.includes('twelvedata.com/static/img/empty')) {
          setLogoUrl(data.url);
          return;
        }
      } catch (e) {
        console.debug("Twelve Data logo failed, trying alternatives");
      }

      setLogoUrl(fallbackSources[0] || null);
    };

    fetchLogo();
  }, [symbol, name, type, cleanSymbol]);

  const handleImageError = () => {
    const logoSources = getLogoSources();

    if (attemptIndex < logoSources.length - 1) {
      setLogoUrl(logoSources[attemptIndex + 1]);
      setAttemptIndex(attemptIndex + 1);
    } else {
      setError(true);
    }
  };

  if (error || (!logoUrl && !error)) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-accent/20 to-accent/5 rounded-xl ${className}`}>
        {cleanSymbol ? (
          <span className="text-xs font-black text-accent">{cleanSymbol.slice(0, 3)}</span>
        ) : (
          <TrendingUp className="w-1/2 h-1/2 text-accent/70" />
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center bg-bg border border-border-accent rounded-xl overflow-hidden ${className}`}>
      <img
        key={logoUrl}
        src={logoUrl!}
        alt={`${cleanSymbol} logo`}
        className={`object-contain transition-all duration-500 ${imgClassName}`}
        onError={handleImageError}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
      />
    </div>
  );
}
