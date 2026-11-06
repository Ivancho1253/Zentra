export type WorkspaceGroupId = 'overview' | 'markets' | 'portfolio' | 'intelligence';

export interface WorkspaceLink {
  path: string;
  label: string;
}

export interface WorkspaceGroup extends WorkspaceLink {
  id: WorkspaceGroupId;
  children: WorkspaceLink[];
}

// URLs remain stable; the shell presents related tools in one workspace.
export const workspaceGroups: WorkspaceGroup[] = [
  { id: 'overview', path: '/', label: 'Overview', children: [] },
  {
    id: 'markets',
    path: '/charts',
    label: 'Markets',
    children: [
      { path: '/charts', label: 'Chart' },
      { path: '/market', label: 'Asset explorer' },
      { path: '/market?view=heatmap', label: 'Heat Map' },
      { path: '/market/watchlists', label: 'Watchlists' },
      { path: '/market/alerts', label: 'Alerts' },
    ],
  },
  {
    id: 'portfolio',
    path: '/portfolio',
    label: 'Portfolio',
    children: [
      { path: '/portfolio', label: 'Positions' },
      { path: '/portfolio/transactions', label: 'Transactions' },
      { path: '/portfolio/analytics', label: 'Analytics' },
      { path: '/portfolio/risk', label: 'Risk' },
    ],
  },
  {
    id: 'intelligence',
    path: '/intelligence/news',
    label: 'Intelligence',
    children: [
      { path: '/intelligence/news', label: 'News' },
      { path: '/intelligence/briefing', label: 'Briefing' },
      { path: '/intelligence/social', label: 'Social intelligence' },
    ],
  },
];

export function getWorkspaceGroup(pathname: string): WorkspaceGroup | undefined {
  return workspaceGroups.find((group) =>
    group.children.length
      ? group.children.some((child) => {
          const path = child.path.split('?')[0];
          return pathname === path || pathname.startsWith(path + '/');
        })
      : pathname === group.path,
  );
}

export function isWorkspaceLinkActive(pathname: string, path: string, search = ''): boolean {
  const [targetPath, query] = path.split('?');
  if (query)
    return pathname === targetPath && new URLSearchParams(search).get('view') === 'heatmap';
  if (targetPath === '/market')
    return pathname === targetPath && new URLSearchParams(search).get('view') !== 'heatmap';
  return pathname === targetPath;
}
