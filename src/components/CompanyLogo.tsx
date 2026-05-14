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
  const cleanSymbol = symbol.split('/')[0].toUpperCase();
  const localLogoPath = cleanSymbol ? `/logos/${type === 'crypto' ? 'cryptos' : 'stocks'}/${cleanSymbol}.png` : null;
  const [logoUrl, setLogoUrl] = useState<string | null>(localLogoPath);
  const [error, setError] = useState(false);
  const [attemptIndex, setAttemptIndex] = useState(0);

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
      AVGO: ['broadcom.com'],
      WMT: ['walmart.com'],
      MU: ['micron.com'],
      ASML: ['asml.com'],
      COST: ['costco.com'],
      LRCX: ['lamresearch.com'],
      AMAT: ['appliedmaterials.com'],
      TXN: ['ti.com'],
      KLAC: ['kla.com'],
      LIN: ['linde.com'],
      QCOM: ['qualcomm.com'],
      ARM: ['arm.com'],
      TMUS: ['t-mobile.com'],
      PEP: ['pepsico.com'],
      ADI: ['analog.com'],
      AMGN: ['amgen.com'],
      STX: ['seagate.com'],
      PANW: ['paloaltonetworks.com'],
      WDC: ['westerndigital.com'],
      GILD: ['gilead.com'],
      APP: ['applovin.com'],
      ISRG: ['intuitive.com'],
      MRVL: ['marvell.com'],
      HON: ['honeywell.com'],
      PDD: ['pinduoduo.com'],
      BKNG: ['bookingholdings.com', 'booking.com'],
      SBUX: ['starbucks.com'],
      VRTX: ['vrtx.com'],
      INTU: ['intuit.com'],
      CEG: ['constellationenergy.com'],
      CDNS: ['cadence.com'],
      SNPS: ['synopsys.com'],
      MAR: ['marriott.com'],
      CMCSA: ['comcast.com'],
      ADP: ['adp.com'],
      MNST: ['monsterbevcorp.com', 'monsterenergy.com'],
      FTNT: ['fortinet.com'],
      CSX: ['csx.com'],
      ABNB: ['airbnb.com'],
      MELI: ['mercadolibre.com'],
      MDLZ: ['mondelezinternational.com'],
      MPWR: ['monolithicpower.com'],
      ORLY: ['oreillyauto.com'],
      NXPI: ['nxp.com'],
      REGN: ['regeneron.com'],
      AEP: ['aep.com'],
      ROST: ['rossstores.com'],
      WBD: ['wbd.com'],
      DASH: ['doordash.com'],
      CTAS: ['cintas.com'],
      BKR: ['bakerhughes.com'],
      MSTR: ['strategy.com', 'microstrategy.com'],
      PCAR: ['paccar.com'],
      FANG: ['diamondbackenergy.com'],
      MCHP: ['microchip.com'],
      EA: ['ea.com'],
      XEL: ['xcelenergy.com'],
      FAST: ['fastenal.com'],
      ADSK: ['autodesk.com'],
      FER: ['ferrovial.com'],
      EXC: ['exeloncorp.com'],
      IDXX: ['idexx.com'],
      TTWO: ['take2games.com'],
      CCEP: ['cocacolaep.com'],
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
      ODFL: ['odfl.com'],
      KDP: ['keurigdrpepper.com'],
      ALNY: ['alnylam.com'],
      TRI: ['thomsonreuters.com'],
      PAYX: ['paychex.com'],
      ROP: ['ropertech.com'],
      CPRT: ['copart.com'],
      AXON: ['axon.com'],
      GEHC: ['gehealthcare.com'],
      KHC: ['kraftheinzcompany.com'],
      INSM: ['insmed.com'],
      DXCM: ['dexcom.com'],
      ZS: ['zscaler.com'],
      CTSH: ['cognizant.com'],
      VRSK: ['verisk.com'],
      CHTR: ['charter.com', 'spectrum.com'],
      CSGP: ['costargroup.com'],
    };

    const cryptoSlugs: Record<string, string> = {
      ADA: 'cardano',
      ALGO: 'algorand',
      APT: 'aptos',
      ARB: 'arbitrum',
      ATOM: 'cosmos',
      AVAX: 'avalanche-avax',
      BCH: 'bitcoin-cash',
      BNB: 'bnb',
      BTC: 'bitcoin',
      DAI: 'multi-collateral-dai',
      DOGE: 'dogecoin',
      DOT: 'polkadot-new',
      EGLD: 'multiversx-egld',
      ENS: 'ethereum-name-service',
      ETC: 'ethereum-classic',
      ETH: 'ethereum',
      FIL: 'filecoin',
      FLOW: 'flow',
      GRT: 'the-graph',
      HBAR: 'hedera',
      IMX: 'immutable-x',
      INJ: 'injective',
      LINK: 'chainlink',
      LTC: 'litecoin',
      MANA: 'decentraland',
      MATIC: 'polygon',
      MKR: 'maker',
      NEAR: 'near-protocol',
      OKB: 'okb',
      OP: 'optimism-ethereum',
      QNT: 'quant',
      RUNE: 'thorchain',
      SAND: 'the-sandbox',
      SHIB: 'shiba-inu',
      SOL: 'solana',
      STX: 'stacks',
      SUI: 'sui',
      THETA: 'theta-network',
      TRX: 'tron',
      UNI: 'uniswap',
      USDC: 'usd-coin',
      USDT: 'tether',
      VET: 'vechain',
      WBTC: 'wrapped-bitcoin',
      XLM: 'stellar',
      XRP: 'xrp',
    };

    if (type === 'crypto') {
      const lowerSymbol = cleanSymbol.toLowerCase();
      const slug = cryptoSlugs[cleanSymbol];
      return [
        localLogoPath,
        `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${lowerSymbol}.png`,
        `https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${lowerSymbol}.png`,
        `https://coinicons-api.vercel.app/api/icon/${lowerSymbol}`,
        slug ? `https://cryptologos.cc/logos/${slug}-${lowerSymbol}-logo.png` : null,
        slug ? `https://cryptologos.cc/logos/${slug}-${lowerSymbol}-logo.svg` : null,
      ].filter(Boolean) as string[];
    }

    const domainSources = (companyDomains[cleanSymbol] || [])
      .map((domain) => `https://logo.clearbit.com/${domain}`);

    return [
      localLogoPath,
      ...domainSources,
      `https://images.financialmodelingprep.com/symbol/${cleanSymbol}.png`,
      `https://static2.finnhub.io/logo/${cleanSymbol}.png`,
      `https://logo.clearbit.com/${cleanSymbol.toLowerCase()}.com`,
      name ? `https://logo.clearbit.com/${name.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}.com` : null,
    ].filter(Boolean) as string[];
  };

  useEffect(() => {
    if (!symbol) return;
    const logoSources = getLogoSources();
    setError(false);
    setAttemptIndex(0);
    setLogoUrl(logoSources[0] || null);
  }, [symbol, name, type, cleanSymbol, localLogoPath]);

  const handleImageError = () => {
    const logoSources = getLogoSources();
    const nextIndex = attemptIndex + 1;

    if (nextIndex < logoSources.length) {
      setLogoUrl(logoSources[nextIndex]);
      setAttemptIndex(nextIndex);
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
