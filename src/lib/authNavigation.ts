export const accountPaths = [
  '/portfolio',
  '/market',
  '/market/:type/:symbol',
  '/alerts',
  '/risk',
  '/briefing',
  '/news',
  '/watchlists',
  '/transactions',
  '/social',
  '/analytics',
  '/help',
  '/info',
];

export function postLoginPath(state: unknown): string {
  if (!state || typeof state !== 'object' || !('from' in state)) return '/';
  const from = state.from;
  if (
    typeof from !== 'string' ||
    !from.startsWith('/') ||
    from.startsWith('//') ||
    from.length > 2048 ||
    from.includes('\\') ||
    [...from].some((character) => character.charCodeAt(0) <= 32)
  )
    return '/';
  try {
    const url = new URL(from, 'https://zentra.invalid');
    if (url.origin !== 'https://zentra.invalid') return '/';
    if (
      url.pathname !== '/' &&
      !accountPaths.includes(url.pathname) &&
      !/^\/market\/(stocks|cryptos)\/[^/]+$/.test(url.pathname)
    )
      return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}
