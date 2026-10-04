import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LanguageProvider } from '../contexts/LanguageContext';
import { I18n } from '../components/Localized';
import { translateText } from './translate';
import phrases from './ui.json';
import { additions } from './additions';
afterEach(() => vi.unstubAllGlobals());
describe('application languages', () => {
  it('contains both translations and preserves every interpolated placeholder', () => {
    for (const [key, values] of Object.entries({ ...phrases, ...additions })) {
      const slots = (key.match(/\{\d+\}/g) || []).sort();
      for (const value of [values.es, values.pt]) {
        expect(value.trim(), key).not.toBe('');
        expect((value.match(/\{\d+\}/g) || []).sort(), key).toEqual(slots);
      }
    }
  });
  it('translates navigation and interpolated labels while retaining exact quantities', () => {
    expect(translateText('News terminal', 'es')).not.toBe('News terminal');
    expect(translateText('Refresh news', 'pt')).toBe('Atualizar notícias');
    expect(translateText('Receipt fee 2', 'es')).not.toContain('Receipt');
    expect(translateText('0.123456789123456789', 'es')).toBe('0.123456789123456789');
    expect(translateText('News terminal', 'en')).toBe('News terminal');
  });
  it('keeps select values and user-authored text unchanged when labels are localized', () => {
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (key === 'language' ? 'es' : 'true'),
    });
    const html = renderToStaticMarkup(
      <LanguageProvider>
        <I18n.select defaultValue="Buy">
          <I18n.option>Buy</I18n.option>
        </I18n.select>
        <I18n.span data-i18n="off">News terminal</I18n.span>
      </LanguageProvider>,
    );
    expect(html).toContain('value="Buy"');
    expect(html).toContain('News terminal');
    expect(html).not.toContain('>Buy<');
  });
});
