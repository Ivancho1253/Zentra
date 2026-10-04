import { useLanguage } from '../contexts/LanguageContext';
import { I18n } from './Localized';
import { ArrowUpRight, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { AssetQuote } from '../../shared/domain';
import { useQuote } from '../lib/query';
import CompanyLogo from './CompanyLogo';
import DataProvenance from './DataProvenance';

export default function MarketAssetCard({
  asset,
  favorite,
  favoriteBusy,
  onFavorite,
}: {
  asset: AssetQuote;
  favorite: boolean;
  favoriteBusy: boolean;
  onFavorite: () => Promise<void>;
}) {
  const { locale } = useLanguage();
  const query = useQuote(asset.symbol, asset.type, asset.price ? asset : undefined);
  const quote = query.data || asset;
  const change = quote.change == null ? null : Number(quote.change);
  const price = quote.price == null ? null : Number(quote.price);
  return (
    <I18n.article className="panel-card relative p-5" aria-label={`${asset.symbol} market card`}>
      <I18n.button
        className="absolute right-5 top-5 z-10 icon-button"
        aria-label={`${favorite ? 'Remove' : 'Add'} ${asset.symbol} ${favorite ? 'from' : 'to'} favorites`}
        aria-pressed={favorite}
        disabled={favoriteBusy}
        onClick={() => void onFavorite()}
      >
        <Star size={18} className={favorite ? 'fill-accent text-accent' : 'text-text-dim'} />
      </I18n.button>
      <Link
        to={`/market/${asset.type === 'crypto' ? 'cryptos' : 'stocks'}/${encodeURIComponent(asset.symbol)}`}
        className="block"
      >
        <CompanyLogo
          symbol={asset.symbol}
          name={quote.name}
          type={asset.type === 'crypto' ? 'crypto' : 'stock'}
          className="mb-4 h-12 w-12 rounded-2xl"
          imgClassName="h-8 w-8"
        />
        <I18n.h2 className="text-xl font-black">{asset.symbol}</I18n.h2>
        <I18n.p className="mt-1 min-h-10 text-xs leading-5 text-text-dim">{quote.name}</I18n.p>
        <I18n.div className="mt-4 rounded-2xl border border-border-accent bg-bg/55 p-4">
          <I18n.div className="flex justify-between gap-2">
            <I18n.span className="eyebrow">Price</I18n.span>
            <I18n.span className="font-mono font-semibold">
              {price !== null && Number.isFinite(price) && price > 0
                ? new Intl.NumberFormat(locale, {
                    style: 'currency',
                    currency: /^[A-Z]{3}$/.test(quote.currency) ? quote.currency : 'XXX',
                    maximumFractionDigits: price < 1 ? 6 : 2,
                  }).format(price)
                : query.isPending || query.isFetching
                  ? 'Loading...'
                  : 'Unavailable'}
            </I18n.span>
          </I18n.div>
          <I18n.div className="mt-3 flex justify-between gap-2">
            <I18n.span className="eyebrow">Daily move</I18n.span>
            <I18n.span
              className={`font-mono ${change === null ? 'text-text-dim' : change < 0 ? 'text-loss' : 'text-accent'}`}
            >
              {change === null || !Number.isFinite(change)
                ? '—'
                : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}
            </I18n.span>
          </I18n.div>
        </I18n.div>
        <I18n.div className="mt-4">
          <DataProvenance quote={quote} />
        </I18n.div>
        <I18n.p className="mt-3 flex justify-between text-[10px] text-text-dim">
          {quote.exchange || 'Exchange unavailable'}
          <ArrowUpRight size={14} />
        </I18n.p>
      </Link>
      {!query.isFetching && !quote.price && (
        <I18n.button
          className="mt-2 text-xs text-accent underline"
          onClick={() => void query.refetch()}
        >
          Retry quote
        </I18n.button>
      )}
    </I18n.article>
  );
}
