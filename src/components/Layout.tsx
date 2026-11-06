import { User } from 'firebase/auth';
import {
  BellRing,
  Compass,
  HelpCircle,
  Info,
  LayoutDashboard,
  LogOut,
  Moon,
  MoreHorizontal,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Wallet,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { brand } from '../../shared/brand';
import { useLanguage } from '../contexts/LanguageContext';
import { auth } from '../lib/firebase';
import { getWorkspaceGroup, isWorkspaceLinkActive, workspaceGroups } from '../lib/navigation';
import { cn } from '../lib/utils';
import { UserProfile } from '../types';
import BrandMark from './BrandMark';
import CommandPalette from './CommandPalette';
import LanguageSelector from './LanguageSelector';
import { I18n, UiText } from './Localized';
import TickerTape from './TickerTape';
import ZentraAIChat from './ZentraAIChat';

interface LayoutProps {
  user: User;
  profile: UserProfile | null;
}

const groupIcons = {
  overview: LayoutDashboard,
  markets: Compass,
  portfolio: Wallet,
  intelligence: Newspaper,
};
const supportLinks = [
  { path: '/help', label: 'Help', icon: HelpCircle },
  { path: '/info', label: 'About Zentra', icon: Info },
];

export default function Layout({ user, profile: _profile }: LayoutProps) {
  const location = useLocation();
  const { t, text } = useLanguage();
  const [isLight, setIsLight] = useState(() => localStorage.getItem('theme') === 'light');
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('zentra:sidebar') === 'collapsed',
  );
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const group = getWorkspaceGroup(location.pathname);

  useEffect(() => {
    document.documentElement.classList.toggle('light', isLight);
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
  }, [isLight]);
  useEffect(() => {
    setMobileMoreOpen(false);
  }, [location.pathname, location.search]);

  const toggleSidebar = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem('zentra:sidebar', next ? 'collapsed' : 'open');
  };

  return (
    <I18n.div className={cn('zentra-shell', collapsed && 'zentra-shell-collapsed')}>
      <I18n.aside className="workspace-sidebar">
        <Link to="/" aria-label="Zentra home" className="workspace-brand">
          <BrandMark className="h-7 w-7 shrink-0 text-accent" />
          {!collapsed && (
            <span className="text-base font-semibold tracking-tight">{brand.name}</span>
          )}
        </Link>
        <I18n.nav aria-label="Primary navigation" className="workspace-primary-nav">
          {workspaceGroups.map((item) => {
            const Icon = groupIcons[item.id];
            return (
              <Link
                key={item.id}
                to={item.path}
                title={text(item.label)}
                aria-label={text(item.label)}
                aria-current={group?.id === item.id ? 'page' : undefined}
                className={cn('workspace-nav-link', group?.id === item.id && 'active')}
              >
                <Icon size={18} strokeWidth={1.7} />
                {!collapsed && <UiText>{item.label}</UiText>}
              </Link>
            );
          })}
        </I18n.nav>
        <I18n.div className="workspace-sidebar-footer">
          {supportLinks.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              title={text(item.label)}
              aria-label={text(item.label)}
              className={cn('workspace-nav-link', location.pathname === item.path && 'active')}
            >
              <item.icon size={16} strokeWidth={1.7} />
              {!collapsed && <UiText>{item.label}</UiText>}
            </Link>
          ))}
          <I18n.button
            onClick={toggleSidebar}
            className="workspace-nav-link"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            {!collapsed && <UiText>Collapse sidebar</UiText>}
          </I18n.button>
          <I18n.div className="workspace-account">
            <I18n.span className="workspace-avatar">
              {user.email?.[0].toUpperCase() || 'Z'}
            </I18n.span>
            {!collapsed && (
              <>
                <I18n.span
                  className="min-w-0 flex-1 truncate text-xs"
                  title={user.email || undefined}
                >
                  {user.email}
                </I18n.span>
                <I18n.button
                  onClick={() => auth.signOut()}
                  className="icon-button !h-7 !w-7"
                  title={t('logout')}
                  aria-label={t('logout')}
                >
                  <LogOut size={14} />
                </I18n.button>
              </>
            )}
          </I18n.div>
          {collapsed && (
            <I18n.button
              onClick={() => auth.signOut()}
              className="workspace-nav-link"
              title={t('logout')}
              aria-label={t('logout')}
            >
              <LogOut size={16} />
            </I18n.button>
          )}
        </I18n.div>
      </I18n.aside>

      <I18n.main className="workspace-main">
        <TickerTape />
        <I18n.header className="workspace-header">
          <I18n.div className="workspace-mobile-brand">
            <BrandMark className="h-6 w-6 text-accent" />
            <span className="font-semibold">{brand.name}</span>
          </I18n.div>
          <CommandPalette />
          <I18n.div className="flex shrink-0 items-center gap-1.5">
            <LanguageSelector />
            <I18n.button
              onClick={() => setIsLight((light) => !light)}
              className="icon-button"
              title={isLight ? t('switchDarkMode') : t('switchLightMode')}
              aria-label={isLight ? t('switchDarkMode') : t('switchLightMode')}
            >
              {isLight ? <Moon size={17} /> : <Sun size={17} />}
            </I18n.button>
            <Link to="/market/alerts" aria-label="Alerts and notifications" className="icon-button">
              <BellRing size={17} />
            </Link>
          </I18n.div>
        </I18n.header>
        {group && group.children.length > 0 && (
          <I18n.nav className="workspace-context-tabs" aria-label={`${group.label} navigation`}>
            {group.children.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                aria-current={
                  isWorkspaceLinkActive(location.pathname, item.path, location.search)
                    ? 'page'
                    : undefined
                }
                className={cn(
                  'workspace-context-tab',
                  isWorkspaceLinkActive(location.pathname, item.path, location.search) && 'active',
                )}
              >
                <UiText>{item.label}</UiText>
              </Link>
            ))}
          </I18n.nav>
        )}
        <I18n.div className="workspace-content">
          <Outlet />
        </I18n.div>
      </I18n.main>
      <ZentraAIChat />
      {mobileMoreOpen && (
        <I18n.div className="workspace-mobile-more">
          {supportLinks.map((item) => (
            <Link key={item.path} to={item.path} className="workspace-nav-link">
              <item.icon size={17} />
              <UiText>{item.label}</UiText>
            </Link>
          ))}
          <I18n.button onClick={() => auth.signOut()} className="workspace-nav-link">
            <LogOut size={17} />
            {t('logout')}
          </I18n.button>
        </I18n.div>
      )}
      <I18n.nav className="workspace-mobile-nav" aria-label="Mobile navigation">
        {workspaceGroups.map((item) => {
          const Icon = groupIcons[item.id];
          return (
            <Link
              key={item.id}
              to={item.path}
              className={cn('workspace-mobile-link', group?.id === item.id && 'active')}
              aria-current={group?.id === item.id ? 'page' : undefined}
            >
              <Icon size={19} strokeWidth={1.7} />
              <UiText>{item.label}</UiText>
            </Link>
          );
        })}
        <I18n.button
          onClick={() => setMobileMoreOpen((open) => !open)}
          className={cn('workspace-mobile-link', mobileMoreOpen && 'active')}
          aria-expanded={mobileMoreOpen}
        >
          <MoreHorizontal size={19} />
          {t('more')}
        </I18n.button>
      </I18n.nav>
    </I18n.div>
  );
}
