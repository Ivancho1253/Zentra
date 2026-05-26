import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { User } from 'firebase/auth';
import { UserProfile } from '../types';
import { BellRing, Brain, LayoutDashboard, Wallet, Newspaper, LogOut, Compass, Sun, Moon, HelpCircle, Info, Radar, MoreHorizontal } from 'lucide-react';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import TickerTape from './TickerTape';
import LanguageSelector from './LanguageSelector';
import { useLanguage } from '../contexts/LanguageContext';
import ZentraAIChat from './ZentraAIChat';

interface LayoutProps {
  user: User;
  profile: UserProfile | null;
}

export default function Layout({ user, profile }: LayoutProps) {
  const location = useLocation();
  const { t } = useLanguage();
  const [isLight, setIsLight] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

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
    { path: '/alerts', icon: BellRing, label: t('alerts') },
    { path: '/risk', icon: Radar, label: t('risk') },
    { path: '/briefing', icon: Brain, label: t('briefing') },
    { path: '/news', icon: Newspaper, label: t('marketNews') },
  ];
  const secondaryItems = [
    { path: '/help', icon: HelpCircle, label: t('help') },
    { path: '/info', icon: Info, label: t('info') },
  ];
  const mobilePrimaryItems = navItems.slice(0, 4);
  const mobileMoreItems = [...navItems.slice(4), ...secondaryItems];

  return (
    <div className="flex h-screen bg-bg text-text-main font-sans">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-border-accent/70 bg-surface/30 flex-col p-6 gap-8">
        <div className="flex items-center gap-3">
          <img 
            src="/logo.png" 
            alt="ZENTRA Logo" 
            className="w-9 h-9 object-contain" 
            referrerPolicy="no-referrer" 
          />
            <span className="flex flex-col leading-none">
            <span className="font-extrabold tracking-tight text-xl uppercase">ZENTRA</span>
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-accent">{t('brandTagline')}</span>
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
          <div className="mt-6 border-t border-border-accent/50 pt-4">
            <div className="mb-2 px-4 text-[9px] font-black uppercase tracking-widest text-text-dim">{t('support')}</div>
            <ul className="space-y-1">
              {secondaryItems.map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-bold transition-all border border-transparent",
                      location.pathname === item.path
                        ? "bg-accent/10 text-accent border-accent/30"
                        : "text-text-dim hover:text-text-main hover:bg-bg/50 hover:border-border-accent"
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
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
        <header className="h-16 border-b border-border-accent/70 flex items-center justify-between gap-4 px-4 md:px-8 bg-bg/72 backdrop-blur-xl sticky top-12 z-20">
          <div className="hidden sm:block" />
          <div className="sm:hidden flex items-center gap-2">
            <img src="/logo.png" alt="ZENTRA Logo" className="w-7 h-7 object-contain" referrerPolicy="no-referrer" />
            <span className="font-extrabold tracking-tight uppercase">ZENTRA</span>
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
            <span className="hidden sm:flex items-center gap-2 rounded-full border border-border-accent bg-surface px-3.5 py-2 text-[12px] font-medium text-text-dim">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              {t('liveMarketData')}
            </span>
          </div>
        </header>
        <div className="p-4 md:p-6 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
      <ZentraAIChat />
      {mobileMoreOpen && (
        <div className="fixed bottom-[4.35rem] left-3 right-3 z-40 rounded-2xl border border-border-accent bg-bg/95 p-3 shadow-2xl backdrop-blur md:hidden">
          <div className="grid grid-cols-3 gap-2">
            {mobileMoreItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMoreOpen(false)}
                className={cn(
                  "flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-border-accent px-2 py-2 text-center text-[10px] font-bold",
                  location.pathname === item.path ? "border-accent bg-accent/10 text-accent" : "text-text-dim"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="max-w-full truncate">{item.label.replace('Market ', '').replace('Mercado ', '')}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
      <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-border-accent bg-bg/95 backdrop-blur md:hidden">
        {mobilePrimaryItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setMobileMoreOpen(false)}
            className={cn(
              "flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-bold",
              location.pathname === item.path ? "text-accent" : "text-text-dim"
            )}
          >
            <item.icon className="w-4 h-4" />
            <span className="max-w-full truncate">{item.label.replace('Market ', '').replace('Mercado ', '')}</span>
          </Link>
        ))}
        <button
          onClick={() => setMobileMoreOpen((open) => !open)}
          className={cn(
            "flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-bold",
            mobileMoreOpen || mobileMoreItems.some((item) => location.pathname === item.path) ? "text-accent" : "text-text-dim"
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span>{t('more')}</span>
        </button>
      </nav>
    </div>
  );
}
