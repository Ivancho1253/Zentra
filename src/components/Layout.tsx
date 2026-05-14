import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { User } from 'firebase/auth';
import { UserProfile } from '../types';
import { LayoutDashboard, Wallet, Newspaper, LogOut, Compass, Sun, Moon } from 'lucide-react';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import TickerTape from './TickerTape';
import LanguageSelector from './LanguageSelector';
import { useLanguage } from '../contexts/LanguageContext';

interface LayoutProps {
  user: User;
  profile: UserProfile | null;
}

export default function Layout({ user, profile }: LayoutProps) {
  const location = useLocation();
  const { t } = useLanguage();
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
      setIsLight(true);
      document.documentElement.classList.add('light');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isLight;
    setIsLight(newTheme);
    if (newTheme) {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    }
  };

  const navItems = [
    { path: '/', icon: LayoutDashboard, label: t('dashboard') },
    { path: '/portfolio', icon: Wallet, label: t('portfolio') },
    { path: '/market', icon: Compass, label: t('market') },
    { path: '/news', icon: Newspaper, label: t('marketNews') },
  ];

  return (
    <div className="flex h-screen bg-bg text-text-main font-sans">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border-accent/70 bg-surface/30 flex-col p-6 gap-8">
        <div className="flex items-center gap-2">
          <img 
            src="/logo.png" 
            alt="ZENTRA Logo" 
            className="w-8 h-8 object-contain" 
            referrerPolicy="no-referrer" 
          />
          <span className="flex flex-col leading-none">
            <span className="font-bold tracking-tighter text-lg uppercase">ZENTRA</span>
            <span className="text-[8px] uppercase tracking-[0.18em] text-accent">Know before it moves</span>
          </span>
        </div>

        <nav className="flex-1">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all border border-transparent",
                    location.pathname === item.path 
                      ? "bg-accent text-[#061000] border-accent shadow-[0_0_24px_rgba(124,255,26,0.22)]" 
                      : "text-text-dim hover:text-text-main hover:bg-bg/50 hover:border-border-accent"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-auto space-y-4">
          <div className="relative overflow-hidden rounded-3xl border border-accent/20 bg-accent/10 p-4">
            <div className="text-[10px] text-accent uppercase font-black tracking-widest">ZENTRA PRO</div>
            <div className="text-xs font-bold mt-1">{t('liveEdgeEnabled')}</div>
            <div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-accent/20 blur-2xl" />
          </div>
          
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 bg-accent rounded-2xl flex items-center justify-center text-bg font-bold text-xs shadow-[0_0_18px_rgba(124,255,26,0.25)]">
              {user.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.email}</p>
              <p className="text-[10px] text-text-dim uppercase">{t('premiumUser')}</p>
            </div>
          </div>
          
          <button
            onClick={() => auth.signOut()}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-xs text-text-dim hover:text-loss hover:bg-loss/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            {t('logout')}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto flex flex-col pb-16 md:pb-0">
        <TickerTape />
        <header className="h-16 border-b border-border-accent/70 flex items-center justify-between gap-4 px-4 md:px-8 bg-bg/72 backdrop-blur-xl sticky top-10 z-20">
          <div className="hidden sm:block" />
          <div className="sm:hidden flex items-center gap-2">
            <img src="/logo.png" alt="ZENTRA Logo" className="w-7 h-7 object-contain" referrerPolicy="no-referrer" />
            <span className="font-bold tracking-tighter uppercase">ZENTRA</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <LanguageSelector />
            <button 
              onClick={toggleTheme}
              className="p-2 bg-surface border border-border-accent rounded-xl hover:border-accent hover:text-accent transition-all"
              title={isLight ? t('switchDarkMode') : t('switchLightMode')}
            >
              {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <span className="hidden sm:flex items-center gap-2 rounded-full border border-border-accent bg-surface px-3 py-2 text-text-dim">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              {t('liveMarketData')}
            </span>
          </div>
        </header>
        <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-4 border-t border-border-accent bg-bg/95 backdrop-blur md:hidden">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 px-2 py-3 text-[10px] font-bold",
              location.pathname === item.path ? "text-accent" : "text-text-dim"
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label.replace('Market ', '').replace('Mercado ', '')}
          </Link>
        ))}
      </nav>
    </div>
  );
}
