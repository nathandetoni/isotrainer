/**
 * src/i18n/index.ts
 * ─────────────────
 * Configures i18next with three languages: pt-BR, en, es.
 * Language detection order: localStorage → browser navigator → fallback (pt-BR).
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import ptBR from "./locales/pt-BR/translation.json";
import en   from "./locales/en/translation.json";
import es   from "./locales/es/translation.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      "pt-BR": { translation: ptBR },
      en:      { translation: en  },
      es:      { translation: es  },
    },
    // Detection order: localStorage key "i18nextLng" → browser language
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
    fallbackLng: "pt-BR",
    // Supported languages — prevents falling back to "pt" (without region) unexpectedly
    supportedLngs: ["pt-BR", "en", "es"],
    nonExplicitSupportedLngs: true,
    interpolation: {
      // React already escapes values; disable double-escaping
      escapeValue: false,
    },
  });

export default i18n;
