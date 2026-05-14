import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Globe } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../lib/utils';

export default function LanguageSelector() {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languages = [
    { code: 'es', label: 'Espanol', short: 'ES' },
    { code: 'en', label: 'English', short: 'EN' },
    { code: 'pt', label: 'Portugues', short: 'PT' },
  ] as const;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentLang = languages.find((lang) => lang.code === language);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-xl border border-border-accent bg-surface px-3 py-2 text-[10px] font-black uppercase tracking-widest text-text-main transition-all hover:border-accent hover:text-accent"
        title="Change language"
      >
        <Globe className="h-4 w-4 text-accent" />
        <span>{currentLang?.short}</span>
        <ChevronDown className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-[100] mt-2 w-40 overflow-hidden rounded-xl border border-border-accent bg-surface shadow-2xl backdrop-blur-xl">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code);
                setIsOpen(false);
              }}
              className={cn(
                'flex w-full items-center gap-3 px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest transition-all hover:bg-accent/10',
                language === lang.code ? 'bg-accent/5 text-accent' : 'text-text-dim'
              )}
            >
              <span className="rounded-md border border-border-accent px-1.5 py-0.5 text-[9px]">{lang.short}</span>
              {lang.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
