import { I18n } from './Localized';
import { useReadiness } from '../lib/readiness';

const labels: Record<string, string> = {
  stocks: 'Stocks',
  crypto: 'Crypto',
  news: 'News',
  social: 'X feeds',
  fx: 'Currency conversion',
  events: 'Earnings calendar',
  ai: 'AI summaries',
  notifications: 'Automatic alerts',
  auth: 'Account administration',
};

export default function ConnectionStatus() {
  const { data, isPending, isError, refetch } = useReadiness();
  return (
    <I18n.section className="panel-card p-6">
      <I18n.h2 className="font-semibold">Service connections</I18n.h2>
      <I18n.p className="mt-2 text-sm text-text-dim">
        Connection settings for this instance. Provider access and delivery still need live
        verification.
      </I18n.p>
      {isPending && <I18n.p className="mt-4 text-sm text-text-dim">Checking connections...</I18n.p>}
      {isError && (
        <I18n.button className="quiet-chip mt-4" onClick={() => void refetch()}>
          Could not check connections · Retry
        </I18n.button>
      )}
      {data && (
        <>
          {data.demo && (
            <I18n.p className="mt-4 text-sm text-text-dim">
              Demo mode is enabled. Market inputs are fictional fixtures.
            </I18n.p>
          )}
          <I18n.div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.providers.map((provider) => {
              const needsAdmin = ['auth', 'notifications'].includes(provider.domain);
              const configured = needsAdmin ? data.firebaseAdmin : provider.status === 'configured';
              return (
                <I18n.div
                  key={provider.domain}
                  className="rounded-xl border border-border-accent p-4"
                >
                  <I18n.div className="font-medium">
                    {labels[provider.domain] || provider.domain}
                  </I18n.div>
                  <I18n.div className="mt-2 text-xs text-accent">
                    {configured
                      ? 'Configured · access not verified'
                      : provider.status === 'fallback-only' && !needsAdmin
                        ? 'Fallback available'
                        : 'Connection required'}
                  </I18n.div>
                  <I18n.p className="mt-2 text-xs leading-5 text-text-dim">
                    {provider.userLabel}
                  </I18n.p>
                </I18n.div>
              );
            })}
          </I18n.div>
        </>
      )}
    </I18n.section>
  );
}
