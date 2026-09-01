/**
 * features/exercise/components/LanguageSelector.tsx
 * ───────────────────────────────────────────────────
 * Dropdown language switcher rendered in the app header.
 * Displays the active language as flag + code and opens a panel with
 * all options on click. Closes on outside click or Escape key.
 * Fully responsive — compact trigger, clear dropdown menu.
 */

import { memo, useCallback, useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";

const LANGUAGES = [
  { code: "pt-BR", flag: "🇧🇷", label: "PT" },
  { code: "en",    flag: "🇺🇸", label: "EN" },
  { code: "es",    flag: "🇪🇸", label: "ES" },
] as const;

/** Returns the LANGUAGES entry that matches the current i18n language code. */
function resolveActive(lang: string) {
  return (
    LANGUAGES.find(
      (l) =>
        l.code === lang ||
        (l.code === "pt-BR" && lang.startsWith("pt")) ||
        (l.code === "en"    && lang.startsWith("en") && !lang.startsWith("es")) ||
        (l.code === "es"    && lang.startsWith("es")),
    ) ?? LANGUAGES[0]
  );
}

export const LanguageSelector = memo(function LanguageSelector() {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const active = resolveActive(i18n.language);

  /** Close on outside click */
  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  /** Close on Escape key */
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const handleSelect = useCallback(
    (code: string) => {
      i18n.changeLanguage(code);
      setOpen(false);
    },
    [i18n],
  );

  return (
    <div className="lang-dropdown" ref={containerRef}>
      {/* ── Trigger button ──────────────────────────────────────────── */}
      <button
        className={`lang-trigger${open ? " lang-trigger--open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Select language"
        title="Select language"
      >
        <span className="lang-trigger__flag">{active.flag}</span>
        <span className="lang-trigger__label">{active.label}</span>
        <span className="lang-trigger__chevron" aria-hidden="true">▾</span>
      </button>

      {/* ── Dropdown panel ──────────────────────────────────────────── */}
      {open && (
        <ul className="lang-menu" role="listbox" aria-label="Language options">
          {LANGUAGES.map(({ code, flag, label }) => {
            const isActive = active.code === code;
            return (
              <li
                key={code}
                role="option"
                aria-selected={isActive}
                className={`lang-option${isActive ? " lang-option--active" : ""}`}
                onClick={() => handleSelect(code)}
                onKeyDown={(e) => e.key === "Enter" && handleSelect(code)}
                tabIndex={0}
              >
                <span className="lang-option__flag">{flag}</span>
                <span className="lang-option__label">{label}</span>
                {isActive && <span className="lang-option__check" aria-hidden="true">✓</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});
