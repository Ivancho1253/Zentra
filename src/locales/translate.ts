import phrases from './ui.json';
import { additions } from './additions';
type Language = 'en' | 'es' | 'pt';
const dictionary: Record<string, { es: string; pt: string }> = Object.fromEntries(
  Object.entries({ ...phrases, ...additions }).map(([key, value]) => [
    key.replace(/\s+/g, ' ').trim(),
    value,
  ]),
);
const templates = Object.entries(dictionary)
  .filter(([key]) => /\{\d+\}/.test(key))
  .map(([key, values]) => {
    const slots = [...key.matchAll(/\{(\d+)\}/g)].map((match) => Number(match[1]));
    const pattern = key
      .split(/\{\d+\}/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('(.+?)');
    return {
      pattern: new RegExp(`^${pattern}$`),
      slots,
      values,
      specificity: key.length - slots.length * 3,
    };
  })
  .sort((a, b) => b.specificity - a.specificity);
export function translateText(value: string, language: Language) {
  if (language === 'en') return value;
  const key = value.replace(/\s+/g, ' ').trim();
  const exact = dictionary[key]?.[language];
  const prefix = value.match(/^\s*/)?.[0] || '',
    suffix = value.match(/\s*$/)?.[0] || '';
  if (exact) return prefix + exact + suffix;
  for (const template of templates) {
    const match = key.match(template.pattern);
    if (match)
      return (
        prefix +
        template.values[language].replace(
          /\{(\d+)\}/g,
          (placeholder, slot) => match[template.slots.indexOf(Number(slot)) + 1] || placeholder,
        ) +
        suffix
      );
  }
  return value;
}
