import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from 'react-router-dom';
import { brand } from '../shared/brand';
import AnalyticsTracker from './components/AnalyticsTracker';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { LanguageProvider } from './contexts/LanguageContext';
import { auth, db } from './lib/firebase';
import { accountPaths, postLoginPath } from './lib/authNavigation';
import { queryClient } from './lib/query';
import { UserProfile } from './types';

const Dashboard = lazy(() => import('./components/Dashboard'));
const Portfolio = lazy(() => import('./components/Portfolio'));
const NewsFeed = lazy(() => import('./components/NewsFeed'));
const MarketExplorer = lazy(() => import('./components/MarketExplorer'));
const AssetDetail = lazy(() => import('./components/AssetDetail'));
const Alerts = lazy(() => import('./components/Alerts'));
const Risk = lazy(() => import('./components/Risk'));
const Briefing = lazy(() => import('./components/Briefing'));
const Auth = lazy(() => import('./components/Auth'));
const LandingPage = lazy(() => import('./components/LandingPage'));
const Help = lazy(() => import('./components/Help'));
const Info = lazy(() => import('./components/Info'));
const Privacy = lazy(() => import('./components/Privacy'));
const Security = lazy(() => import('./components/Security'));
const Pricing = lazy(() => import('./components/Pricing'));
const Terms = lazy(() => import('./components/Terms'));
const Watchlists = lazy(() => import('./components/Watchlists'));
const TransactionLedger = lazy(() => import('./components/TransactionLedger'));
const SocialIntelligence = lazy(() => import('./components/SocialIntelligence'));
const PortfolioAnalytics = lazy(() => import('./components/PortfolioAnalytics'));
const DemoTerminal = lazy(() => import('./components/DemoTerminal'));

function AuthRedirect({ signedIn = false }: { signedIn?: boolean }) {
  const location = useLocation();
  return signedIn ? (
    <Navigate to={postLoginPath(location.state)} replace />
  ) : (
    <Navigate
      to="/auth"
      replace
      state={{ from: `${location.pathname}${location.search}${location.hash}` }}
    />
  );
}

function AppLoader({ label = `Loading ${brand.name}...` }: { label?: string }) {
  return (
    <div className="flex flex-col h-screen items-center justify-center bg-bg gap-6">
      <img
        src={brand.icon}
        alt={`${brand.name} logo`}
        className="w-20 h-20 object-contain animate-pulse"
        referrerPolicy="no-referrer"
      />
      <div className="text-accent text-xs uppercase tracking-[0.3em] font-bold">{label}</div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let generation = 0;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      const current = ++generation;
      queryClient.clear();
      setUser(user);
      setProfile(null);
      // Routes depend on the verified Auth session, not a network profile read.
      setLoading(false);
      try {
        if (user) {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            if (current === generation) setProfile(docSnap.data() as UserProfile);
          } else {
            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              displayName: user.displayName || '',
              photoURL: user.photoURL || '',
              currency: 'USD',
            };
            await setDoc(docRef, newProfile);
            if (current === generation) setProfile(newProfile);
          }
        } else {
          if (current === generation) setProfile(null);
        }
      } catch (error) {
        console.error('Auth profile bootstrap failed:', error);
        if (current === generation) setProfile(null);
      }
    });

    return () => {
      generation++;
      unsubscribe();
    };
  }, []);

  if (loading) {
    return <AppLoader label={`${brand.name} initializing...`} />;
  }

  return (
    <LanguageProvider>
      <Router>
        <AnalyticsTracker />
        <ErrorBoundary>
          <Suspense fallback={<AppLoader />}>
            <Routes>
              <Route path="/demo" element={<DemoTerminal />} />
              <Route path="/landing" element={<LandingPage />} />
              {!user ? (
                <>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/security" element={<Security />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/terms" element={<Terms />} />
                  {accountPaths.map((path) => (
                    <Route key={path} path={path} element={<AuthRedirect />} />
                  ))}
                  <Route path="*" element={<Navigate to="/" />} />
                </>
              ) : (
                <>
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/security" element={<Security />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/auth" element={<AuthRedirect signedIn />} />
                  <Route element={<Layout user={user} profile={profile} />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/portfolio" element={<Portfolio />} />
                    <Route path="/market" element={<MarketExplorer />} />
                    <Route path="/market/:type/:symbol" element={<AssetDetail />} />
                    <Route path="/alerts" element={<Alerts />} />
                    <Route path="/risk" element={<Risk />} />
                    <Route path="/briefing" element={<Briefing />} />
                    <Route path="/news" element={<NewsFeed />} />
                    <Route path="/watchlists" element={<Watchlists />} />
                    <Route path="/transactions" element={<TransactionLedger />} />
                    <Route path="/social" element={<SocialIntelligence />} />
                    <Route path="/analytics" element={<PortfolioAnalytics />} />
                    <Route path="/help" element={<Help />} />
                    <Route path="/info" element={<Info />} />
                    <Route path="*" element={<Navigate to="/" />} />
                  </Route>
                </>
              )}
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </Router>
    </LanguageProvider>
  );
}
