import { SlidersHorizontal, X } from 'lucide-react-native';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { computePopoverTop } from '@/components/website/popoverPlacement';
import { brand, HEADING_TEXT, ink, surface } from '@/components/website/websiteColors';
import { THEME_IDS, type ThemeOption } from '@/constants/settings';
import { SettingsService } from '@/database/services/SettingsService';
import { useThemePreference } from '@/hooks/useTheme';
import { setMirroredThemePreference } from '@/utils/themeMirror';

const THEME_OPTIONS = ['system', ...THEME_IDS] as const satisfies readonly ThemeOption[];
const LANGUAGES = [
  { code: 'en-us', label: 'English' },
  { code: 'es-es', label: 'Español' },
  { code: 'nl-nl', label: 'Nederlands' },
  { code: 'pt-br', label: 'Português' },
];

export function WebsitePreferences() {
  const { t, i18n } = useTranslation();
  const themePreference = useThemePreference();
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
    panelRef.current?.querySelector('select')?.focus();
    window.addEventListener('resize', placePanel);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('resize', placePanel);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen]);

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
              className="fixed z-[170] max-h-[calc(100dvh-2rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border p-5 text-text-primary shadow-2xl"
              style={{ ...position, backgroundColor: surface(), borderColor: ink(0.12) }}
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
              <div className="mb-5 flex items-center justify-between gap-3">
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
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-2 text-sm font-medium">
                  {t('website.navigation.language')}
                  <select
                    value={language?.code ?? ''}
                    onChange={(event) => {
                      i18n
                        .changeLanguage(event.target.value)
                        .catch((error) =>
                          console.warn('[WebsitePreferences] Failed to change language:', error)
                        );
                    }}
                    className="min-h-11 w-full rounded-xl border border-border-default bg-bg-primary px-3 text-sm text-text-primary focus:outline-accent-primary"
                  >
                    {!language ? (
                      <option value="" disabled>
                        {t('website.navigation.language')}
                      </option>
                    ) : null}
                    {LANGUAGES.map(({ code, label }) => (
                      <option key={code} value={code}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-sm font-medium">
                  {t('website.navigation.theme')}
                  <select
                    value={themePreference}
                    onChange={(event) => {
                      const option = event.target.value as ThemeOption;
                      // The mirror updates the public site before the app settings database is observed.
                      setMirroredThemePreference(option);
                      SettingsService.setTheme(option).catch((error) =>
                        console.warn('[WebsitePreferences] Failed to save theme:', error)
                      );
                    }}
                    className="min-h-11 w-full rounded-xl border border-border-default bg-bg-primary px-3 text-sm text-text-primary focus:outline-accent-primary"
                  >
                    {THEME_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {t(`settings.theme.options.${option}.label`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
