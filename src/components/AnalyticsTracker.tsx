import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from '../lib/analytics';

export default function AnalyticsTracker() {
  const location = useLocation();

  useEffect(() => {
    trackEvent('page_view', {
      path: location.pathname,
      search: location.search || null,
    });
  }, [location.pathname, location.search]);

  return null;
}
