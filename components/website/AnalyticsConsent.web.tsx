import { Link, usePathname } from 'expo-router';
import { Cookie } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  ANALYTICS_RESET_EVENT,
  AnalyticsConsentState,
  disableAnalytics,
  ensureAnalytics,
  getAnalyticsConsent,
  setAnalyticsConsent,
  trackPageView,
} from '@/utils/websiteAnalytics';

const BANNER_DELAY_MS = 400;

export function AnalyticsConsent() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.cookieConsent' });
  const pathname = usePathname();
  const [consent, setConsent] = useState<AnalyticsConsentState>(() => getAnalyticsConsent());
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (consent !== null) {
      setVisible(false);
      return;
    }

    disableAnalytics();
    const timer = window.setTimeout(() => setVisible(true), BANNER_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [consent]);

  useEffect(() => {
    const handleReset = () => {
      setConsent(null);
      setVisible(true);
    };

    window.addEventListener(ANALYTICS_RESET_EVENT, handleReset);
    return () => window.removeEventListener(ANALYTICS_RESET_EVENT, handleReset);
  }, []);

  useEffect(() => {
    if (consent !== 'accepted') {
      return;
    }

    void ensureAnalytics().then(() => {
      trackPageView(pathname, document.title);
    });
  }, [consent, pathname]);

  const accept = () => {
    setAnalyticsConsent('accepted');
    setConsent('accepted');
  };

  const reject = () => {
    setAnalyticsConsent('rejected');
    disableAnalytics();
    setConsent('rejected');
  };

  if (!visible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed right-0 bottom-0 left-0 z-[180] flex justify-center p-4 md:p-6">
      <div
        role="dialog"
        aria-label={t('ariaLabel')}
        className="pointer-events-auto flex w-full max-w-2xl flex-col items-start gap-4 rounded-2xl border p-5 shadow-2xl backdrop-blur-xl sm:flex-row sm:items-center"
        style={{
          background: 'linear-gradient(180deg, rgba(10,18,16,0.98) 0%, rgba(6,12,11,0.96) 100%)',
          borderColor: 'rgba(255,255,255,0.08)',
          boxShadow:
            '0 24px 70px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.03), 0 0 30px rgba(34,197,94,0.08)',
        }}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
            style={{
              backgroundColor: 'rgba(34,197,94,0.1)',
              borderColor: 'rgba(34,197,94,0.24)',
            }}
          >
            <Cookie className="h-4 w-4" color="#22C55E" />
          </div>

          <p className="text-sm leading-relaxed text-slate-300">
            {t('description')}{' '}
            <Link href="/privacy" className="text-[#22C55E] underline underline-offset-2">
              {t('privacyLink')}
            </Link>
            .
          </p>
        </div>

        <div className="flex w-full gap-2 sm:w-auto">
          <button
            type="button"
            onClick={reject}
            className="flex-1 rounded-full border px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/8 sm:flex-none"
            style={{ borderColor: 'rgba(255,255,255,0.16)' }}
          >
            {t('reject')}
          </button>
          <button
            type="button"
            onClick={accept}
            className="flex-1 rounded-full px-4 py-2 text-sm font-semibold text-black transition-colors hover:brightness-95 sm:flex-none"
            style={{ backgroundColor: '#22C55E' }}
          >
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
