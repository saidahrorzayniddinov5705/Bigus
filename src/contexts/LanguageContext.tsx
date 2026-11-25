import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Language, translations } from '../lib/i18n';

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const VALID_LANGUAGES: Language[] = ['uz', 'uz-cyrl', 'ru', 'en'];

const getInitialLanguage = (): Language => {
  if (typeof window === 'undefined') return 'uz';
  const saved = localStorage.getItem('language');
  return (VALID_LANGUAGES as string[]).includes(saved || '') ? (saved as Language) : 'uz';
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  // Previously this always reset to Uzbek on every reload — a patient who
  // picked Russian or English would be switched back to Uzbek every time
  // they reopened the app.
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('language', lang);
    } catch (e) {
      // ignore (e.g. private browsing storage restrictions)
    }
  };

  const t = (key: keyof typeof translations) => {
    return translations[key]?.[language] || translations[key]?.en || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
