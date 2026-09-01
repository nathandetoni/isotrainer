/**
 * features/exercise/components/LanguageSelector.tsx
 * ───────────────────────────────────────────────────
 * Compact language switcher rendered in the app header.
 * Uses flag + ISO code for a clean, minimal look.
 */

import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "pt-BR", flag: "🇧🇷", label: "PT" },
  { code: "en",    flag: "🇺🇸", label: "EN" },
  { code: "es",    flag: "🇪🇸", label: "ES" },
] as const;

export const LanguageSelector = memo(function LanguageSelector() {
  const { i18n } = useTranslation();

  const handleChange = useCallback(
    (code: string) => {
      i18n.changeLanguage(code);
    },
    [i18n],
  );

  return (
    <div className="lang-selector" role="group" aria-label="Language">
      {LANGUAGES.map(({ code, flag, label }) => {
        // Match both exact code ("pt-BR") and base language ("pt" → "pt-BR")
        const isActive =
          i18n.language === code ||
          (code === "pt-BR" && i18n.language.startsWith("pt")) ||
          (code === "en" && i18n.language.startsWith("en") && !i18n.language.startsWith("es")) ||
          (code === "es" && i18n.language.startsWith("es"));
        return (
          <button
            key={code}
            className={`lang-btn${isActive ? " lang-btn--active" : ""}`}
            onClick={() => handleChange(code)}
            aria-pressed={isActive}
            title={code}
          >
            <span className="lang-btn__flag">{flag}</span>
            <span className="lang-btn__label">{label}</span>
          </button>
        );
      })}
    </div>
  );
});
