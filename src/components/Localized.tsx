import React, { createContext, forwardRef, useContext } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
const PreserveContent = createContext(false);
export function UiText({ children }: { children: React.ReactNode }) {
  const { text } = useLanguage();
  const preserve = useContext(PreserveContent);
  return (
    <>
      {preserve
        ? children
        : React.Children.map(children, (child) =>
            typeof child === 'string' ? text(child) : child,
          )}
    </>
  );
}
function localized<Tag extends keyof React.JSX.IntrinsicElements>(tag: Tag) {
  type Props = React.ComponentPropsWithoutRef<Tag> & { 'data-i18n'?: 'off' };
  return forwardRef<HTMLElement, Props>(function LocalizedElement(props, ref) {
    const { text } = useLanguage();
    const preserve = useContext(PreserveContent) || props['data-i18n'] === 'off';
    const translated: Record<string, unknown> = { ...props, ref };
    // An option without an explicit value uses its text as its value. Preserve
    // the original value so translated labels do not change stored enums.
    if (
      tag === 'option' &&
      translated.value === undefined &&
      typeof translated.children === 'string'
    )
      translated.value = translated.children;
    if (!preserve) {
      for (const key of ['title', 'placeholder', 'aria-label', 'alt'])
        if (typeof translated[key] === 'string') translated[key] = text(translated[key] as string);
      if ('children' in translated)
        translated.children = React.Children.map(translated.children as React.ReactNode, (child) =>
          typeof child === 'string' ? text(child) : child,
        );
    }
    const element = React.createElement(tag, translated);
    return props['data-i18n'] === 'off' ? (
      <PreserveContent.Provider value>{element}</PreserveContent.Provider>
    ) : (
      element
    );
  });
}
export const I18n = {
  kbd: localized('kbd'),
  title: localized('title'),
  a: localized('a'),
  article: localized('article'),
  aside: localized('aside'),
  b: localized('b'),
  blockquote: localized('blockquote'),
  br: localized('br'),
  button: localized('button'),
  code: localized('code'),
  details: localized('details'),
  div: localized('div'),
  em: localized('em'),
  fieldset: localized('fieldset'),
  footer: localized('footer'),
  form: localized('form'),
  h1: localized('h1'),
  h2: localized('h2'),
  h3: localized('h3'),
  h4: localized('h4'),
  h5: localized('h5'),
  header: localized('header'),
  hr: localized('hr'),
  i: localized('i'),
  img: localized('img'),
  input: localized('input'),
  label: localized('label'),
  legend: localized('legend'),
  li: localized('li'),
  main: localized('main'),
  nav: localized('nav'),
  ol: localized('ol'),
  option: localized('option'),
  p: localized('p'),
  pre: localized('pre'),
  section: localized('section'),
  select: localized('select'),
  small: localized('small'),
  span: localized('span'),
  strong: localized('strong'),
  summary: localized('summary'),
  table: localized('table'),
  tbody: localized('tbody'),
  td: localized('td'),
  textarea: localized('textarea'),
  th: localized('th'),
  thead: localized('thead'),
  time: localized('time'),
  tr: localized('tr'),
  ul: localized('ul'),
};
