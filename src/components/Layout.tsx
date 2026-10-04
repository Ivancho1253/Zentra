import { I18n, UiText } from './Localized';
import { User } from 'firebase/auth';
import {
  BellRing,
  Brain,
  ChartPie,
  Compass,
  HelpCircle,
  Info,
  LayoutDashboard,
  List,
  LogOut,
  Moon,
  MoreHorizontal,
  Newspaper,
  Radar,
  Radio,
  Receipt,
  Sun,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { brand } from '../../shared/brand';
import { useLanguage } from '../contexts/LanguageContext';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { UserProfile } from '../types';
import CommandPalette from './CommandPalette';
import LanguageSelector from './LanguageSelector';
import TickerTape from './TickerTape';
import ZentraAIChat from './ZentraAIChat';

interface LayoutProps {
  user: User;
  profile: UserProfile | null;
}

export default function Layout({ user, profile: _profile }: LayoutProps) {
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
    { path: '/watchlists', icon: List, label: 'Watchlists' },
    { path: '/transactions', icon: Receipt, label: 'Transactions' },
    { path: '/analytics', icon: ChartPie, label: 'Analytics' },
    { path: '/social', icon: Radio, label: 'Social intelligence' },
  ];
  const secondaryItems = [
    { path: '/help', icon: HelpCircle, label: t('help') },
    { path: '/info', icon: Info, label: t('info') },
  ];
  const mobilePrimaryItems = navItems.slice(0, 4);
  const mobileMoreItems = [...navItems.slice(4), ...secondaryItems];

  return (
    <I18n.div className="flex h-screen bg-bg text-text-main font-sans">
      {/* Sidebar */}
      <I18n.aside className="hidden md:flex w-60 shrink-0 overflow-y-auto border-r border-border-accent/70 bg-surface/30 flex-col p-4 gap-5">
        <I18n.div className="flex items-center gap-3">
          <I18n.img
            src={brand.icon}
            alt={brand.name + ' Logo'}
            className="w-9 h-9 object-contain"
            referrerPolicy="no-referrer"
          />
          <I18n.span className="flex flex-col leading-none">
            <I18n.span className="font-extrabold tracking-tight text-xl uppercase">
              {brand.name}
            </I18n.span>
            <I18n.span className="mt-0.5 text-[10px] text-text-dim">{brand.tagline}</I18n.span>
          </I18n.span>
        </I18n.div>

        <I18n.nav className="flex-1">
          <I18n.ul className="space-y-2">
            {navItems.map((item) => (
              <I18n.li key={item.path}>
                <Link
                  to={item.path}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-semibold transition-all border border-transparent',
                    location.pathname === item.path
                      ? 'bg-accent text-[#061000] border-accent shadow-[0_0_24px_rgba(124,255,26,0.22)]'
                      : 'text-text-dim hover:text-text-main hover:bg-bg/50 hover:border-border-accent',
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <UiText>{item.label}</UiText>
                </Link>
              </I18n.li>
            ))}
          </I18n.ul>
          <I18n.div className="mt-6 border-t border-border-accent/50 pt-4">
            <I18n.div className="mb-2 px-4 text-[9px] font-black uppercase tracking-widest text-text-dim">
              {t('support')}
            </I18n.div>
            <I18n.ul className="space-y-1">
              {secondaryItems.map((item) => (
                <I18n.li key={item.path}>
                  <Link
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 px-4 py-2 rounded-xl text-xs font-bold transition-all border border-transparent',
                      location.pathname === item.path
                        ? 'bg-accent/10 text-accent border-accent/30'
                        : 'text-text-dim hover:text-text-main hover:bg-bg/50 hover:border-border-accent',
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    <UiText>{item.label}</UiText>
                  </Link>
                </I18n.li>
              ))}
            </I18n.ul>
          </I18n.div>
        </I18n.nav>

        <I18n.div className="mt-auto space-y-4">
          <I18n.div className="relative overflow-hidden rounded-3xl border border-accent/20 bg-accent/10 p-4">
            <I18n.div className="text-[10px] text-accent uppercase font-black tracking-widest">
              {brand.name} intelligence
            </I18n.div>
            <I18n.div className="text-xs font-bold mt-1">Your market, in context</I18n.div>
            <I18n.div className="absolute -right-8 -top-8 h-20 w-20 rounded-full bg-accent/20 blur-2xl" />
          </I18n.div>

          <I18n.div className="flex items-center gap-3 px-2">
            <I18n.div className="w-9 h-9 bg-accent rounded-2xl flex items-center justify-center text-bg font-bold text-xs shadow-[0_0_18px_rgba(124,255,26,0.25)]">
              {user.email?.[0].toUpperCase()}
            </I18n.div>
            <I18n.div className="flex-1 min-w-0">
              <I18n.p className="text-xs font-medium truncate">{user.email}</I18n.p>
              <I18n.p className="text-[10px] text-text-dim uppercase">Personal workspace</I18n.p>
            </I18n.div>
          </I18n.div>

          <I18n.button
            onClick={() => auth.signOut()}
            className="w-full flex items-center gap-3 px-4 py-2 rounded-lg text-xs text-text-dim hover:text-loss hover:bg-loss/10 transition-all"
          >
            <LogOut className="w-4 h-4" />
            {t('logout')}
          </I18n.button>
        </I18n.div>
      </I18n.aside>

      {/* Main Content */}
      <I18n.main className="min-w-0 flex-1 overflow-auto flex flex-col pb-16 md:pb-0">
        <TickerTape />
        <I18n.header className="h-16 shrink-0 border-b border-border-accent/70 flex items-center justify-between gap-4 px-4 md:px-8 bg-bg/72 backdrop-blur-xl sticky top-14 z-20">
          <CommandPalette />
          <I18n.div className="sm:hidden flex items-center gap-2">
            <I18n.img
              src={brand.icon}
              alt={brand.name + ' Logo'}
              className="w-7 h-7 object-contain"
              referrerPolicy="no-referrer"
            />
            <I18n.span className="font-extrabold tracking-tight uppercase">{brand.name}</I18n.span>
          </I18n.div>
          <I18n.div className="flex items-center gap-3 text-xs">
            <LanguageSelector />
            <I18n.button
              onClick={toggleTheme}
              className="p-2 bg-surface border border-border-accent rounded-xl hover:border-accent hover:text-accent transition-all"
              title={isLight ? t('switchDarkMode') : t('switchLightMode')}
            >
              {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </I18n.button>
            <Link to="/alerts" aria-label="Alerts and notifications" className="icon-button">
              <BellRing size={18} />
            </Link>
          </I18n.div>
        </I18n.header>
        <I18n.div className="p-4 pb-36 md:p-6 max-w-7xl mx-auto w-full">
          <Outlet />
        </I18n.div>
      </I18n.main>
      <ZentraAIChat />
      {mobileMoreOpen && (
        <I18n.div className="fixed bottom-[4.35rem] left-3 right-3 z-[70] rounded-2xl border border-border-accent bg-bg/95 p-3 shadow-2xl backdrop-blur md:hidden">
          <I18n.div className="grid grid-cols-3 gap-2">
            {mobileMoreItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMoreOpen(false)}
                className={cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border border-border-accent px-2 py-2 text-center text-[10px] font-bold',
                  location.pathname === item.path
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'text-text-dim',
                )}
              >
                <item.icon className="h-4 w-4" />
                <I18n.span className="max-w-full truncate">
                  {item.label.replace('Market ', '').replace('Mercado ', '')}
                </I18n.span>
              </Link>
            ))}
          </I18n.div>
        </I18n.div>
      )}
      <I18n.nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-border-accent bg-bg/95 backdrop-blur md:hidden">
        {mobilePrimaryItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            onClick={() => setMobileMoreOpen(false)}
            className={cn(
              'flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-bold',
              location.pathname === item.path ? 'text-accent' : 'text-text-dim',
            )}
          >
            <item.icon className="w-4 h-4" />
            <I18n.span className="max-w-full truncate">
              {item.label.replace('Market ', '').replace('Mercado ', '')}
            </I18n.span>
          </Link>
        ))}
        <I18n.button
          onClick={() => setMobileMoreOpen((open) => !open)}
          className={cn(
            'flex min-h-16 flex-col items-center justify-center gap-1 px-1 py-2 text-[10px] font-bold',
            mobileMoreOpen || mobileMoreItems.some((item) => location.pathname === item.path)
              ? 'text-accent'
              : 'text-text-dim',
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
          <I18n.span>{t('more')}</I18n.span>
        </I18n.button>
      </I18n.nav>
    </I18n.div>
  );
}
