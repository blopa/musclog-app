import { Languages, X } from 'lucide-react-native';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { localeForLanguage } from '@/components/website/localeRoutes';
import { hue, surface } from '@/components/website/websiteColors';

/** How long the notice stays on screen before it goes away by itself. */
export const ENGLISH_ONLY_NOTICE_MS = 7000;

/**
 * The note shown when a visitor switches language on a page that only exists in English (the blog):
 * the interface changes language but the address and the posts stay English, so this says so.
 *
 * It sits at the top, under the header, because the cookie banner owns the bottom of the screen.
 * It is portalled to `<body>` like the preferences panel (the header would otherwise be its
 * containing block), reads its own text so it follows the language that was just chosen, and is
 * a polite `status` region rather than an alert: nothing is wrong, the visitor is being told.
 * `onDismiss` must be stable, since the timer restarts whenever it changes.
 */
export function EnglishOnlyNotice({ onDismiss }: { onDismiss: () => void }) {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    const timer = window.setTimeout(onDismiss, ENGLISH_ONLY_NOTICE_MS);

    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return createPortal(
    <div
      role="status"
      lang={localeForLanguage(i18n.resolvedLanguage ?? i18n.language).hreflang}
      className="fixed left-1/2 top-20 z-[190] flex w-[min(32rem,calc(100vw-2rem))] -translate-x-1/2 items-center gap-3 rounded-card border py-3 pl-4 pr-2 text-sm font-medium text-text-primary"
      style={{ backgroundColor: surface(), borderColor: hue('amber', 0.45) }}
    >
      <Languages size={18} color={hue('amber')} aria-hidden={true} />
      <p className="min-w-0 flex-1">{t('website.blog.englishOnlyNotice')}</p>
      <button
        type="button"
        aria-label={t('website.cta.close')}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-ink/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-primary"
        onClick={onDismiss}
      >
        <X size={18} aria-hidden={true} />
      </button>
    </div>,
    document.body
  );
}
