import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { trackStoreButtonClick } from '@/utils/websiteAnalytics';

const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.werules.logger';
const TESTFLIGHT_URL = 'https://testflight.apple.com/join/mq3QMSHU';

function AppleLogo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 36 36">
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
    <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" fill="none" viewBox="0 0 36 36">
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

interface StoreButtonProps {
  logo: ReactNode;
  title: string;
  storeName: string;
  onClick?: () => void;
  href?: string;
  onLinkClick?: () => void;
}

function StoreButton({ logo, title, storeName, onClick, href, onLinkClick }: StoreButtonProps) {
  const className =
    'inline-flex min-w-[175px] items-center gap-3 rounded-xl border border-white/30 bg-black/85 px-4 py-2.5 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-colors hover:border-white/50';

  const content = (
    <>
      <span className="shrink-0">{logo}</span>
      <span className="flex flex-col items-start">
        <span className="text-[11px] leading-none text-gray-200">{title}</span>
        <span className="text-lg font-bold leading-tight text-white">{storeName}</span>
      </span>
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={onLinkClick}
    >
      {content}
    </a>
  );
}

export function StoreButtons() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.storeButtons' });

  return (
    <div className="flex flex-wrap gap-3">
      <StoreButton
        logo={<GooglePlayLogo />}
        title={t('googleTitle')}
        storeName={t('googleStore')}
        href={GOOGLE_PLAY_URL}
        onLinkClick={() =>
          trackStoreButtonClick({ store: 'google_play', availability: 'available' })
        }
      />
      <StoreButton
        logo={<AppleLogo />}
        title={t('appleTitle')}
        storeName={t('appleStore')}
        href={TESTFLIGHT_URL}
        onLinkClick={() =>
          trackStoreButtonClick({ store: 'app_store', availability: 'testflight' })
        }
      />
    </div>
  );
}
