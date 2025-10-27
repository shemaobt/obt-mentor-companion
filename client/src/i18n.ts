import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import pt from './locales/pt.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ru from './locales/ru.json';
import zh from './locales/zh.json';
import id from './locales/id.json';
import ko from './locales/ko.json';
import ar from './locales/ar.json';

const resources = {
  en: { translation: en },
  pt: { translation: pt },
  es: { translation: es },
  fr: { translation: fr },
  ru: { translation: ru },
  zh: { translation: zh },
  id: { translation: id },
  ko: { translation: ko },
  ar: { translation: ar },
};

i18n
  .use(LanguageDetector) // Auto-detect user's language
  .use(initReactI18next) // Pass i18n instance to react-i18next
  .init({
    resources,
    fallbackLng: 'en', // Fallback language
    lng: localStorage.getItem('i18nextLng') || 'en', // Default language
    
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    
    detection: {
      order: ['localStorage', 'navigator'], // Check localStorage first, then browser language
      caches: ['localStorage'], // Cache language selection
    },
  });

export default i18n;
