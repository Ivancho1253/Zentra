import { brand } from './brand.ts';
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
export function brandedHtml(html: string): string {
  return html
    .replaceAll('%BRAND_NAME%', escape(brand.name))
    .replaceAll('%BRAND_TAGLINE%', escape(brand.tagline))
    .replaceAll('%BRAND_DESCRIPTION%', escape(brand.description))
    .replaceAll('%BRAND_COLOR%', escape(brand.themeColor))
    .replaceAll('%BRAND_ICON%', escape(brand.icon));
}
export function brandManifest() {
  return {
    name: brand.name,
    short_name: brand.name,
    description: brand.tagline,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: brand.themeColor,
    theme_color: brand.themeColor,
    icons: [{ src: brand.icon, sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
  };
}
