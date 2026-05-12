import React, { Suspense, lazy, useEffect, useState } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { UserProfile } from './types';
import { LanguageProvider } from './contexts/LanguageContext';

const Dashboard = lazy(() => import('./components/Dashboard'));
const Portfolio = lazy(() => import('./components/Portfolio'));
const NewsFeed = lazy(() => import('./components/NewsFeed'));
const MarketExplorer = lazy(() => import('./components/MarketExplorer'));
const AssetDetail = lazy(() => import('./components/AssetDetail'));
const Auth = lazy(() => import('./components/Auth'));
const LandingPage = lazy(() => import('./components/LandingPage'));

function AppLoader({ label = 'Loading ZENTRA...' }: { label?: string }) {
  return (
    <div className="flex flex-col h-screen items-center justify-center bg-bg gap-6">
      <img
        src="/logo.png"
        alt="ZENTRA Logo"
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (user) {
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            currency: 'USD',
          };
          await setDoc(docRef, newProfile);
          setProfile(newProfile);
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <AppLoader label="ZENTRA initializing..." />;
  }

  return (
    <LanguageProvider>
      <Router>
        <Suspense fallback={<AppLoader />}>
          <Routes>
            {!user ? (
              <>
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="*" element={<Navigate to="/" />} />
              </>
            ) : (
              <Route element={<Layout user={user} profile={profile} />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/portfolio" element={<Portfolio />} />
                <Route path="/market" element={<MarketExplorer />} />
                <Route path="/market/:type/:symbol" element={<AssetDetail />} />
                <Route path="/news" element={<NewsFeed />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Route>
            )}
          </Routes>
        </Suspense>
      </Router>
    </LanguageProvider>
  );
}
