import { useTranslation } from 'react-i18next';

import { DotPattern } from '@/components/website/WebsiteBackgrounds';
import { trackStoreButtonClick } from '@/utils/websiteAnalytics';

const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.werules.logger';
const TESTFLIGHT_URL = 'https://testflight.apple.com/join/mq3QMSHU';

function AppleLogo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 36 36">
      <path
        fill="currentColor"
        d="M22.667 6.639C23.76 5.223 24.59 3.22 24.29 1.178c-1.789.124-3.88 1.272-5.098 2.767-1.111 1.356-2.026 3.37-1.67 5.328 1.955.061 3.975-1.114 5.145-2.634Z"
      />
      <path
        fill="currentColor"
        d="M31.36 12.466c-1.718-2.16-4.132-3.414-6.412-3.414-3.009 0-4.282 1.445-6.373 1.445-2.155 0-3.793-1.44-6.396-1.44-2.556 0-5.278 1.566-7.004 4.245-2.426 3.773-2.011 10.865 1.921 16.906 1.407 2.162 3.286 4.593 5.744 4.614 2.187.02 2.803-1.407 5.767-1.422 2.963-.016 3.525 1.441 5.708 1.418 2.46-.02 4.442-2.713 5.849-4.875 1.009-1.55 1.384-2.33 2.166-4.079-5.69-2.172-6.601-10.285-.97-13.399Z"
      />
    </svg>
  );
}

function GooglePlayLogo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="none" viewBox="0 0 36 36">
      <path
        fill="#2299F8"
        d="M19.728 17.3 3.496 33.576c-.776-.736-1.195-1.745-1.195-2.839V5.21c0-1.115.44-2.124 1.237-2.88l16.19 14.97Z"
      />
      <path
        fill="#FFC107"
        d="M33.757 17.973c0 1.473-.797 2.776-2.118 3.512l-4.613 2.566-5.726-5.3-1.572-1.45 6.06-6.078 5.85 3.239c1.322.736 2.12 2.04 2.12 3.511Z"
      />
      <path
        fill="#5ACF5F"
        d="M19.728 17.3 3.538 2.33c.21-.211.483-.4.755-.569 1.321-.799 2.915-.82 4.278-.063l17.217 9.525-6.06 6.077Z"
      />
      <path
        fill="#F84437"
        d="M27.026 24.05 8.57 34.25a4.166 4.166 0 0 1-2.097.546c-.755 0-1.51-.189-2.18-.609a3.807 3.807 0 0 1-.798-.61L19.728 17.3l1.572 1.451 5.726 5.3Z"
      />
    </svg>
  );
}

export default function Download() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.download' });

  return (
    <>
      <main className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center overflow-hidden px-4 py-20">
        <DotPattern className="text-primary/30" />
        <div className="from-background/60 to-background/80 absolute inset-0 bg-gradient-to-b via-transparent" />

        <div className="relative z-10 mx-auto flex w-full max-w-xl flex-col items-center text-center">
          <p className="mb-4 rounded-full border border-[#00FFA3]/25 bg-[#00FFA3]/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-[#00FFA3]">
            {t('eyebrow')}
          </p>
          <h1 className="max-w-lg text-balance text-4xl font-black leading-tight text-white sm:text-5xl">
            {t('title')}
          </h1>
          <p className="mt-4 max-w-md text-balance text-base leading-7 text-gray-300 sm:text-lg">
            {t('subtitle')}
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-5 sm:gap-6">
            <a
              href={GOOGLE_PLAY_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('googleLabel')}
              className="flex h-28 w-28 items-center justify-center rounded-2xl border border-white/15 bg-black/75 text-white shadow-2xl transition-all hover:-translate-y-1 hover:border-white/35 hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-[#00FFA3] focus:ring-offset-2 focus:ring-offset-black sm:h-32 sm:w-32"
              onClick={() =>
                trackStoreButtonClick({ store: 'google_play', availability: 'available' })
              }
            >
              <GooglePlayLogo />
            </a>

            <a
              href={TESTFLIGHT_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('appleLabel')}
              className="flex h-28 w-28 items-center justify-center rounded-2xl border border-white/15 bg-black/75 text-white shadow-2xl transition-all hover:-translate-y-1 hover:border-white/35 hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-[#00FFA3] focus:ring-offset-2 focus:ring-offset-black sm:h-32 sm:w-32"
              onClick={() =>
                trackStoreButtonClick({ store: 'app_store', availability: 'testflight' })
              }
            >
              <AppleLogo />
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
