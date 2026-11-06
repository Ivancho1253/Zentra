import { ChevronDown, Globe } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../lib/utils';

export default function LanguageSelector() {
  const { language, setLanguage, text } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: 'es', label: 'Español', short: 'ES' },
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'pt', label: 'Português', short: 'PT' },
  ] as const;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', escape);
    };
  }, []);

  const currentLang = languages.find((lang) => lang.code === language);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-8 items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-text-dim transition-colors hover:bg-surface hover:text-text-main"
        title={text('Change language')}
        aria-label={text('Change language')}
        aria-expanded={isOpen}
      >
        <Globe className="h-4 w-4" />
        <span>{currentLang?.short}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-[100] mt-2 w-40 overflow-hidden rounded-md border border-border-accent bg-surface p-1 shadow-lg">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code);
                setIsOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-3 rounded px-3 py-2.5 text-left text-xs font-medium transition-colors hover:bg-accent/10',
                language === lang.code ? 'bg-accent/5 text-accent' : 'text-text-dim',
              )}
            >
              <span className="rounded-md border border-border-accent px-1.5 py-0.5 text-[9px]">
                {lang.short}
              </span>
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
