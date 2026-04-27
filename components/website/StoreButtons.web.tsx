import { BrowserQRCodeSvgWriter } from '@zxing/library';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
        <span className="text-lg leading-tight font-bold text-white">{storeName}</span>
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

function QRCodeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" fill="none" viewBox="0 0 24 24">
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M4 4h5v5H4V4Zm11 0h5v5h-5V4ZM4 15h5v5H4v-5Zm13 0v2m0 3v.01M15 15h2m3 0h.01M8 8h.01M8 16h1m2 0h1m-2 2v1m4-4h1m0 2h2m-2 2h1"
      />
    </svg>
  );
}

function QRCodeCard({
  href,
  label,
  alt,
  onLinkClick,
}: {
  href: string;
  label: string;
  alt: string;
  onLinkClick?: () => void;
}) {
  const qrCodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const qrCodeNode = qrCodeRef.current;

    if (!qrCodeNode) {
      return;
    }

    qrCodeNode.replaceChildren();

    const writer = new BrowserQRCodeSvgWriter();
    const svg = writer.write(href, 132, 132);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', alt);
    svg.style.display = 'block';
    svg.style.width = '132px';
    svg.style.height = '132px';
    qrCodeNode.appendChild(svg);

    return () => {
      qrCodeNode.replaceChildren();
    };
  }, [alt, href]);

  return (
    <div className="flex flex-1 flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <span className="mb-3 text-sm font-semibold text-white">{label}</span>
      <div
        ref={qrCodeRef}
        className="rounded-xl bg-white p-2 shadow-[0_10px_30px_rgba(0,0,0,0.3)]"
        aria-hidden="true"
      />
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 text-sm font-medium text-[#A7F3D0] transition-colors hover:text-white"
        onClick={onLinkClick}
      >
        {label}
      </a>
    </div>
  );
}

export function StoreButtons() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.storeButtons' });
  const [isQrOpen, setIsQrOpen] = useState(false);
  const qrButtonRef = useRef<HTMLDivElement>(null);
  const qrPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isQrOpen) {
      return;
    }

    const closePopover = () => setIsQrOpen(false);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePopover();
      }
    };

    const handlePointerDown = (event: MouseEvent | PointerEvent | TouchEvent) => {
      const target = event.target as Node;
      const clickedTrigger = qrButtonRef.current?.contains(target);
      const clickedPopover = qrPopoverRef.current?.contains(target);

      if (!clickedTrigger && !clickedPopover) {
        closePopover();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isQrOpen]);

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
      <div className="relative hidden [@media(min-width:767px)]:inline-flex" ref={qrButtonRef}>
        <button
          type="button"
          aria-label={t('qrButton', { defaultValue: 'Show QR codes' })}
          aria-expanded={isQrOpen}
          aria-haspopup="dialog"
          className="inline-flex h-[58px] w-[58px] items-center justify-center rounded-xl border border-white/30 bg-black/85 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.03)] transition-colors hover:border-white/50"
          onClick={() => setIsQrOpen((current) => !current)}
        >
          <QRCodeIcon />
        </button>

        {isQrOpen && typeof document !== 'undefined'
          ? createPortal(
              <div
                ref={qrPopoverRef}
                role="dialog"
                aria-labelledby="store-qr-popover-title"
                className="fixed z-[170] w-[min(calc(100vw-2rem),30rem)] rounded-3xl border border-white/12 bg-[rgba(7,13,12,0.97)] p-5 shadow-2xl backdrop-blur-xl"
                style={{
                  top: qrButtonRef.current
                    ? qrButtonRef.current.getBoundingClientRect().bottom + 12
                    : 0,
                  left: qrButtonRef.current
                    ? Math.min(
                        Math.max(qrButtonRef.current.getBoundingClientRect().left - 180, 16),
                        window.innerWidth - 16 - Math.min(window.innerWidth - 32, 480)
                      )
                    : 16,
                }}
              >
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h3 id="store-qr-popover-title" className="text-base font-bold text-white">
                      {t('qrTitle', { defaultValue: 'Scan to install' })}
                    </h3>
                    <p className="mt-1 text-sm text-gray-300">
                      {t('qrDescription', {
                        defaultValue:
                          'Open the Android or iOS install page directly on your phone.',
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={t('close', { defaultValue: 'Close' })}
                    className="text-xl leading-none text-gray-400 transition-colors hover:text-white"
                    onClick={() => setIsQrOpen(false)}
                  >
                    ×
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <QRCodeCard
                    href={GOOGLE_PLAY_URL}
                    label={t('qrGoogleLabel', { defaultValue: 'Google Play' })}
                    alt={t('qrGoogleAlt', { defaultValue: 'Google Play QR code' })}
                    onLinkClick={() =>
                      trackStoreButtonClick({ store: 'google_play', availability: 'available' })
                    }
                  />
                  <QRCodeCard
                    href={TESTFLIGHT_URL}
                    label={t('qrAppleLabel', { defaultValue: 'TestFlight' })}
                    alt={t('qrAppleAlt', { defaultValue: 'TestFlight QR code' })}
                    onLinkClick={() =>
                      trackStoreButtonClick({ store: 'app_store', availability: 'testflight' })
                    }
                  />
                </div>
              </div>,
              document.body
            )
          : null}
      </div>
    </div>
  );
}
