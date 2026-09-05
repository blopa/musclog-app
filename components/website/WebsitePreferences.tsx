import { Check, Globe, Monitor, Palette, SlidersHorizontal, X } from 'lucide-react-native';
import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

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
const LANGUAGES = [
  { code: 'en-us', flag: '🇬🇧', label: 'English' },
  { code: 'es-es', flag: '🇪🇸', label: 'Español' },
  { code: 'nl-nl', flag: '🇳🇱', label: 'Nederlands' },
  { code: 'pt-br', flag: '🇧🇷', label: 'Português' },
];

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
        className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-ink/[0.06] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent-primary"
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
  const locale = (i18n.resolvedLanguage ?? i18n.language).toLowerCase();
  const language = LANGUAGES.find(({ code }) => code.split('-')[0] === locale.split('-')[0]);

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
              className="fixed z-[170] max-h-[calc(100dvh-2rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border p-3 text-text-primary shadow-2xl backdrop-blur-xl"
              style={{
                ...position,
                background: `linear-gradient(180deg, ${surfaceCard(0.98)}, ${surface(0.98)})`,
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
                className="mb-3 grid grid-cols-2 gap-1 rounded-xl bg-ink/[0.04] p-1"
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
                    className="flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-sm font-semibold transition-colors hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-primary"
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
                <div
                  role="radiogroup"
                  aria-label={t(`website.navigation.${activeTab}`)}
                  className="flex flex-col gap-1"
                >
                  {activeTab === 'language'
                    ? LANGUAGES.map(({ code, label, flag }) => (
                        <PreferenceOption
                          key={code}
                          name={`${id}-language`}
                          value={code}
                          label={label}
                          selected={language?.code === code}
                          onSelect={() => {
                            i18n
                              .changeLanguage(code)
                              .catch((error) =>
                                console.warn(
                                  '[WebsitePreferences] Failed to change language:',
                                  error
                                )
                              );
                          }}
                        >
                          <span aria-hidden="true" className="w-6 text-xl leading-none">
                            {flag}
                          </span>
                        </PreferenceOption>
                      ))
                    : THEME_OPTIONS.map((option) => (
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
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
