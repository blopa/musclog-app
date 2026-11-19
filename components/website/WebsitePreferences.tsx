import { Check, Globe, Monitor, Palette, SlidersHorizontal, X } from 'lucide-react-native';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import {
  localeForLanguage,
  localeScopeOf,
  localizedPath,
  parsePublicPath,
  WEBSITE_LOCALES,
} from '@/components/website/localeRoutes';
import { computePopoverTop } from '@/components/website/popoverPlacement';
import {
  brand,
  HEADING_TEXT,
  ink,
  scrim,
  surface,
  surfaceCard,
} from '@/components/website/websiteColors';
import { THEME_IDS, type ThemeOption } from '@/constants/settings';
import { SettingsService } from '@/database/services/SettingsService';
import { useThemePreference } from '@/hooks/useTheme';
import { THEME_DEFINITIONS } from '@/theme.registry';
import { setMirroredThemePreference } from '@/utils/themeMirror';

const THEME_OPTIONS = ['system', ...THEME_IDS] as const satisfies readonly ThemeOption[];
const LANGUAGE_STORAGE_KEY = 'musclog_lang';
// The native names are by design untranslated: each language is named in itself.
const LANGUAGE_LABELS: Record<string, { badge: string; label: string }> = {
  en: { badge: 'EN', label: 'English' },
  es: { badge: 'ES', label: 'Español' },
  nl: { badge: 'NL', label: 'Nederlands' },
  'pt-br': { badge: 'PT', label: 'Português' },
  ru: { badge: 'RU', label: 'Русский' },
};

function rememberLanguage(language: string) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Storage can be blocked; the address still carries the language.
  }
}

function PreferenceOption({
  name,
  value,
  label,
  selected,
  onSelect,
  children,
}: {
  name: string;
  value: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  return (
    <label className="relative block cursor-pointer">
      <input
        type="radio"
        name={name}
        value={value}
        checked={selected}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span
        className="flex min-h-12 items-center gap-3 rounded-control px-3 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-ink/[0.06] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent-primary"
        style={selected ? { backgroundColor: brand(0.12), color: HEADING_TEXT } : undefined}
      >
        {children}
        <span className="flex-1">{label}</span>
        {selected ? <Check size={18} className="text-accent-primary" aria-hidden={true} /> : null}
      </span>
    </label>
  );
}

export function WebsitePreferences() {
  const { t, i18n } = useTranslation();
  const themePreference = useThemePreference();
  const [activeTab, setActiveTab] = useState<'language' | 'theme'>('language');
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const title = t('website.navigation.preferences');
  const i18nLocale = localeForLanguage(i18n.resolvedLanguage ?? i18n.language);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const placePanel = () => {
      const rect = triggerRef.current!.getBoundingClientRect();
      if (rect.width === 0) {
        setIsOpen(false);
        return;
      }

      const panel = panelRef.current!;
      setPosition({
        top: computePopoverTop({
          triggerRect: rect,
          popoverHeight: panel.offsetHeight,
          viewportHeight: window.innerHeight,
        }),
        left: Math.max(
          16,
          Math.min(rect.right - panel.offsetWidth, window.innerWidth - panel.offsetWidth - 16)
        ),
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopImmediatePropagation();
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };

    placePanel();
    panelRef.current
      ?.querySelector<HTMLButtonElement>('[role="tab"][aria-selected="true"]')
      ?.focus();
    window.addEventListener('resize', placePanel);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('resize', placePanel);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, activeTab]);

  // The panel only exists after a click, so the address can be read straight from the window.
  const page = isOpen ? parsePublicPath(window.location.pathname) : null;
  const logicalTarget = page ? `${page.path}${window.location.search}${window.location.hash}` : '/';
  // A page with a translated URL is switched by navigating; the blog and unprefixed pages
  // (`/open`) have no other language, so the chrome changes in place.
  const navigates = page !== null && page.locale !== null && localeScopeOf(page.path) === 'all';
  const currentLocale = page?.locale && navigates ? page.locale : i18nLocale;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        title={title}
        aria-label={title}
        aria-expanded={isOpen}
        aria-controls={isOpen ? id : undefined}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors hover:bg-ink/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary"
        style={{
          color: HEADING_TEXT,
          borderColor: isOpen ? brand(0.4) : ink(0.12),
          backgroundColor: isOpen ? brand(0.12) : ink(0.04),
        }}
      >
        <SlidersHorizontal size={20} aria-hidden={true} />
      </button>
      {isOpen
        ? createPortal(
            <div
              ref={panelRef}
              id={id}
              role="dialog"
              aria-labelledby={`${id}-title`}
              className="fixed z-[170] max-h-[calc(100dvh-2rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-card border p-3 text-text-primary"
              style={{
                ...position,
                backgroundColor: surface(),
                borderColor: ink(0.12),
                boxShadow: `0 24px 70px ${scrim(0.3)}, 0 0 0 1px ${ink(0.03)}`,
              }}
              onBlur={(event) => {
                if (
                  event.relatedTarget &&
                  !event.currentTarget.contains(event.relatedTarget) &&
                  event.relatedTarget !== triggerRef.current
                ) {
                  setIsOpen(false);
                }
              }}
            >
              <div className="mb-3 flex items-center justify-between gap-3 px-3 py-2">
                <h2 id={`${id}-title`} className="text-base font-bold">
                  {title}
                </h2>
                <button
                  type="button"
                  aria-label={t('website.cta.close')}
                  className="-m-2 inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-ink/10"
                  onClick={() => {
                    setIsOpen(false);
                    triggerRef.current?.focus();
                  }}
                >
                  <X size={18} aria-hidden={true} />
                </button>
              </div>
              <div
                role="tablist"
                aria-label={title}
                className="mb-3 grid grid-cols-2 gap-1 rounded-control bg-ink/[0.04] p-1"
                onKeyDown={(event) => {
                  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                    event.preventDefault();
                    if (event.key === 'Home') {
                      setActiveTab('language');
                    } else if (event.key === 'End') {
                      setActiveTab('theme');
                    } else {
                      setActiveTab(activeTab === 'language' ? 'theme' : 'language');
                    }
                  }
                }}
              >
                {(['language', 'theme'] as const).map((tab) => (
                  <button
                    key={tab}
                    id={`${id}-${tab}-tab`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab}
                    aria-controls={`${id}-${tab}-panel`}
                    tabIndex={activeTab === tab ? 0 : -1}
                    onClick={() => setActiveTab(tab)}
                    className="flex min-h-11 items-center justify-center gap-2 rounded-control px-2 text-sm font-semibold transition-colors hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-primary"
                    style={{
                      backgroundColor: activeTab === tab ? surfaceCard() : 'transparent',
                      color: activeTab === tab ? HEADING_TEXT : undefined,
                      boxShadow: activeTab === tab ? `0 1px 4px ${scrim(0.1)}` : undefined,
                    }}
                  >
                    {tab === 'language' ? (
                      <Globe size={16} aria-hidden={true} />
                    ) : (
                      <Palette size={16} aria-hidden={true} />
                    )}
                    {t(`website.navigation.${tab}`)}
                  </button>
                ))}
              </div>
              <div
                id={`${id}-${activeTab}-panel`}
                role="tabpanel"
                aria-labelledby={`${id}-${activeTab}-tab`}
              >
                {activeTab === 'language' ? (
                  <nav aria-label={t('website.navigation.language')}>
                    <ul className="flex flex-col gap-1">
                      {WEBSITE_LOCALES.map((locale) => {
                        const { badge, label } = LANGUAGE_LABELS[locale.prefix];
                        const selected = currentLocale.prefix === locale.prefix;

                        return (
                          <li key={locale.prefix}>
                            <a
                              href={localizedPath(logicalTarget, locale.prefix)}
                              hrefLang={locale.hreflang}
                              lang={locale.hreflang}
                              aria-current={selected ? 'true' : undefined}
                              onClick={(event) => {
                                rememberLanguage(locale.language);
                                if (!navigates) {
                                  event.preventDefault();
                                  i18n
                                    .changeLanguage(locale.language)
                                    .catch((error) =>
                                      console.warn(
                                        '[WebsitePreferences] Failed to change language:',
                                        error
                                      )
                                    );
                                }
                              }}
                              className="flex min-h-12 items-center gap-3 rounded-control px-3 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-ink/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-primary"
                              style={
                                selected
                                  ? { backgroundColor: brand(0.12), color: HEADING_TEXT }
                                  : undefined
                              }
                            >
                              <span
                                aria-hidden="true"
                                className="w-7 text-center text-xs font-bold leading-none tracking-wide"
                              >
                                {badge}
                              </span>
                              <span className="flex-1">{label}</span>
                              {selected ? (
                                <Check
                                  size={18}
                                  className="text-accent-primary"
                                  aria-hidden={true}
                                />
                              ) : null}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                ) : (
                  <div
                    role="radiogroup"
                    aria-label={t('website.navigation.theme')}
                    className="flex flex-col gap-1"
                  >
                    {THEME_OPTIONS.map((option) => (
                      <PreferenceOption
                        key={option}
                        name={`${id}-theme`}
                        value={option}
                        label={t(`settings.theme.options.${option}.label`)}
                        selected={themePreference === option}
                        onSelect={() => {
                          // The public site observes the mirror before the app settings database.
                          setMirroredThemePreference(option);
                          SettingsService.setTheme(option).catch((error) =>
                            console.warn('[WebsitePreferences] Failed to save theme:', error)
                          );
                        }}
                      >
                        {option === 'system' ? (
                          <Monitor size={24} aria-hidden={true} />
                        ) : (
                          <span
                            aria-hidden="true"
                            className="h-6 w-6 shrink-0 rounded-full border-4"
                            style={{
                              backgroundColor: THEME_DEFINITIONS[option].palette.brandPrimary,
                              borderColor: THEME_DEFINITIONS[option].palette.borderHairline,
                            }}
                          />
                        )}
                      </PreferenceOption>
                    ))}
                  </div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
