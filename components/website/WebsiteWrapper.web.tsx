import { Link } from 'expo-router';
import { Download, Dumbbell, Menu, X } from 'lucide-react-native';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { computePopoverTop } from '@/components/website/popoverPlacement';
import { StoreButtons } from '@/components/website/StoreButtons';
import { SectionBackground } from '@/components/website/WebsiteBackgrounds';
import {
  BODY_TEXT,
  BODY_TEXT_SOFT,
  brand,
  BRAND_GREEN,
  HEADING_TEXT,
  ink,
  ON_BRAND,
  scrim,
  surface,
  surfaceCard,
} from '@/components/website/websiteColors';
import { WebsitePreferences } from '@/components/website/WebsitePreferences';
import packageJson from '@/package.json';
import { resetAnalyticsConsent } from '@/utils/websiteAnalytics';

const CARD_BORDER = ink(0.12);

interface DownloadModalProps {
  children: ReactNode;
  variant?: 'default' | 'outline' | 'white';
  className?: string;
  style?: React.CSSProperties;
}

export function DownloadModal({
  children,
  variant = 'default',
  className,
  style,
}: DownloadModalProps) {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.cta' });
  const [isOpen, setIsOpen] = useState(false);
  const [popoverHeight, setPopoverHeight] = useState(0);
  const [triggerRect, setTriggerRect] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const closeModal = () => setIsOpen(false);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    const handlePointerDown = (event: MouseEvent | PointerEvent | TouchEvent) => {
      const target = event.target as Node;
      const clickedTrigger = triggerRef.current?.contains(target);
      const clickedPopover = popoverContentRef.current?.contains(target);

      if (!clickedTrigger && !clickedPopover) {
        closeModal();
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
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setTriggerRect(triggerRef.current?.getBoundingClientRect() ?? null);

    if (popoverContentRef.current) {
      setPopoverHeight(popoverContentRef.current.getBoundingClientRect().height);
    }
  }, [isOpen]);

  const buttonClasses = {
    default: 'hover:opacity-90',
    outline: 'border border-ink/30 text-text-primary hover:bg-ink/10',
    white: 'hover:opacity-90',
  };
  const popoverClasses = {
    default: 'right-0',
    outline: 'right-0',
    white: 'left-1/2 -translate-x-1/2',
  };

  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const modalWidth = Math.min(Math.max(viewportWidth - 32, 0), 384);
  const centeredLeft =
    triggerRect != null && viewportWidth > 0
      ? Math.min(
          Math.max(triggerRect.left + triggerRect.width / 2 - modalWidth / 2, 16),
          viewportWidth - modalWidth - 16
        )
      : 16;
  const popoverTop = computePopoverTop({
    triggerRect,
    popoverHeight,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
  });

  const buttonStyleByVariant: Record<
    NonNullable<DownloadModalProps['variant']>,
    React.CSSProperties
  > = {
    default: {
      backgroundColor: BRAND_GREEN,
      color: ON_BRAND,
    },
    outline: {},
    white: {
      backgroundColor: HEADING_TEXT,
      color: surface(),
    },
  };

  return (
    <div className="relative inline-flex" ref={triggerRef}>
      <button
        type="button"
        className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold transition-colors ${buttonClasses[variant]} ${className ?? ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((current) => !current)}
        style={{ ...buttonStyleByVariant[variant], ...style }}
      >
        {children}
      </button>

      {isOpen
        ? createPortal(
            <div
              ref={popoverContentRef}
              className={`fixed z-[160] mt-3 w-[min(calc(100vw-2rem),24rem)] rounded-2xl border p-4 shadow-2xl backdrop-blur-xl ${popoverClasses[variant]}`}
              style={{
                backgroundColor: surface(0.96),
                borderColor: CARD_BORDER,
                top: popoverTop,
                left: centeredLeft,
              }}
              role="dialog"
              aria-labelledby="download-modal-title"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 id="download-modal-title" className="text-base font-bold text-text-primary">
                    {t('title')}
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: BODY_TEXT }}>
                    {t('description')}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t('close')}
                  className="text-xl leading-none text-text-tertiary hover:text-text-primary"
                  onClick={() => setIsOpen(false)}
                >
                  ×
                </button>
              </div>
              <StoreButtons />
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

const MOBILE_MENU_ID = 'website-mobile-menu';

export function MobileMenu() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.navigation' });
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    // The trigger is `lg:hidden`, so a viewport that grows past the desktop
    // breakpoint would otherwise leave the panel open with the scroll locked.
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const handleBreakpointChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsOpen(false);
      }
    };

    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.addEventListener('keydown', handleKeyDown);
    desktopQuery.addEventListener('change', handleBreakpointChange);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      desktopQuery.removeEventListener('change', handleBreakpointChange);
    };
  }, [isOpen]);

  useEffect(() => {
    // The panel is portalled to the end of `<body>`, so move focus into it on
    // open and hand it back to the trigger on close to keep tabbing coherent.
    if (isOpen) {
      panelRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [isOpen]);

  const menuLinks = [
    { text: t('features'), href: '/home#features' },
    { text: t('blog'), href: '/blog' },
    { text: t('calculator'), href: '/calculator' },
    { text: t('exercises'), href: '/exercises' },
    { text: t('progress'), href: '/progress' },
    { text: 'FAQ', href: '/faq' },
    { text: t('gameboy'), href: '/gameboy' },
    { text: t('alternatives'), href: '/alternatives' },
    { text: t('github'), href: 'https://github.com/blopa/musclog-app' },
  ];
  const linkClasses =
    'rounded-xl px-4 py-3 text-base font-semibold transition-colors hover:bg-ink/10';

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        aria-label={isOpen ? t('closeMenu') : t('openMenu')}
        aria-expanded={isOpen}
        aria-controls={MOBILE_MENU_ID}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors hover:border-ink/20 hover:bg-ink/10 lg:hidden"
        style={{
          borderColor: isOpen ? brand(0.4) : ink(0.08),
          backgroundColor: isOpen ? ink(0.08) : ink(0.04),
        }}
      >
        {isOpen ? (
          <X className="h-5 w-5 text-text-primary" />
        ) : (
          <Menu className="h-5 w-5 text-text-primary" />
        )}
      </button>

      {isOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 top-16 z-[140] lg:hidden">
              <div
                aria-hidden="true"
                className="absolute inset-0 backdrop-blur-sm"
                style={{ backgroundColor: scrim(0.6) }}
                onClick={() => setIsOpen(false)}
              />

              <div
                ref={panelRef}
                id={MOBILE_MENU_ID}
                tabIndex={-1}
                className="absolute inset-x-0 top-0 max-h-full overflow-y-auto border-b shadow-2xl backdrop-blur-xl"
                style={{
                  borderColor: ink(0.08),
                  background: `linear-gradient(180deg, ${surface(0.98)} 0%, ${surfaceCard(0.97)} 100%)`,
                }}
              >
                <nav
                  aria-label={t('menu')}
                  className="container mx-auto flex flex-col gap-1 px-4 py-4"
                >
                  {menuLinks.map((link) =>
                    link.href.startsWith('http') ? (
                      <a
                        key={link.text}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setIsOpen(false)}
                        className={`${linkClasses} text-text-primary`}
                      >
                        {link.text}
                      </a>
                    ) : (
                      <Link
                        key={link.text}
                        href={link.href}
                        onPress={() => setIsOpen(false)}
                        className={`${linkClasses} text-text-primary`}
                      >
                        {link.text}
                      </Link>
                    )
                  )}
                </nav>

                <div
                  className="container mx-auto border-t px-4 py-5"
                  style={{ borderColor: ink(0.08) }}
                >
                  <p
                    className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em]"
                    style={{ color: BODY_TEXT_SOFT }}
                  >
                    {t('download')}
                  </p>
                  <StoreButtons />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export function Header() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.navigation' });

  return (
    <header
      className="fixed left-0 right-0 top-0 z-50 border-b backdrop-blur-md"
      style={{ backgroundColor: surface(0.86), borderColor: ink(0.08) }}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: BRAND_GREEN }}
          >
            <Dumbbell className="h-5 w-5 text-text-on-accent" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="whitespace-nowrap text-base font-bold text-text-primary">
              {t('appName')}
            </span>
            <span className="whitespace-nowrap text-xs" style={{ color: BODY_TEXT_SOFT }}>
              {t('appTagline')}
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 lg:flex">
          <Link
            href="/blog"
            className="text-sm text-text-primary transition-colors hover:text-accent-primary"
          >
            {t('blog')}
          </Link>
          <Link
            href="/calculator"
            className="text-sm text-text-primary transition-colors hover:text-accent-primary"
          >
            {t('calculator')}
          </Link>
          <Link
            href="/exercises"
            className="text-sm text-text-primary transition-colors hover:text-accent-primary"
          >
            {t('exercises')}
          </Link>
          <Link
            href="/progress"
            className="text-sm text-text-primary transition-colors hover:text-accent-primary"
          >
            {t('progress')}
          </Link>
          <DownloadModal
            variant="default"
            className="shrink-0 whitespace-nowrap px-5 py-2.5 text-sm font-bold transition-transform hover:scale-[1.01]"
            style={{ backgroundColor: BRAND_GREEN, color: ON_BRAND }}
          >
            {t('download')}
          </DownloadModal>
          <WebsitePreferences />
        </nav>

        <div className="flex items-center gap-2 lg:hidden">
          <DownloadModal
            variant="default"
            className="hidden min-h-11 shrink-0 whitespace-nowrap px-4 py-2 text-sm font-bold shadow-[0_10px_30px_rgb(var(--c-accent-primary)/0.18)] [@media(min-width:550px)]:inline-flex"
          >
            <Download className="h-4 w-4" />
            <span>{t('download')}</span>
          </DownloadModal>
          <WebsitePreferences />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.footer' });
  const { t: navT } = useTranslation(undefined, { keyPrefix: 'website.navigation' });
  const { t: consentT } = useTranslation(undefined, { keyPrefix: 'website.cookieConsent' });

  const footerLinks = [
    { text: t('privacyPolicy'), href: '/privacy' },
    { text: t('terms'), href: '/terms' },
    { text: t('contact'), href: '/contact' },
    { text: navT('exercises'), href: '/exercises' },
    { text: navT('gameboy'), href: '/gameboy' },
    { text: 'FAQ', href: '/faq' },
    { text: navT('alternatives'), href: '/alternatives' },
    { text: navT('blog'), href: '/blog' },
    { text: t('license'), href: 'https://github.com/blopa/musclog-app/blob/main/LICENSE' },
    { text: t('github'), href: 'https://github.com/blopa/musclog-app' },
  ];

  return (
    <footer className="relative overflow-hidden border-t py-8" style={{ borderColor: ink(0.08) }}>
      <SectionBackground variant="grid" />
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <Link href="/" className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: BRAND_GREEN }}
            >
              <Dumbbell className="h-5 w-5 text-text-on-accent" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-text-primary">{navT('appName')}</span>
              <span className="text-xs" style={{ color: BODY_TEXT_SOFT }}>
                {navT('appTagline')}
              </span>
            </div>
          </Link>

          <nav className="grid grid-cols-2 justify-items-center gap-x-8 gap-y-3 text-center sm:grid-cols-3 md:justify-items-start md:text-left">
            {footerLinks.map((link) =>
              link.href.startsWith('http') ? (
                <a
                  key={link.text}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-text-tertiary transition-colors hover:text-accent-primary"
                >
                  {link.text}
                </a>
              ) : (
                <Link
                  key={link.text}
                  href={link.href}
                  className="text-sm text-text-tertiary transition-colors hover:text-accent-primary"
                >
                  {link.text}
                </Link>
              )
            )}
            <button
              onClick={resetAnalyticsConsent}
              className="col-span-2 cursor-pointer text-sm transition-colors hover:text-accent-primary sm:col-span-1"
              style={{ color: BODY_TEXT_SOFT }}
            >
              {consentT('cookieSettings')}
            </button>
          </nav>

          <div className="flex items-center gap-4">
            <a
              href="https://youtube.com/@musclog"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-accent-primary"
              style={{ color: BODY_TEXT_SOFT }}
              aria-label="YouTube"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            </a>
            <a
              href="https://instagram.com/musclog.app"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-accent-primary"
              style={{ color: BODY_TEXT_SOFT }}
              aria-label="Instagram"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
          </div>
        </div>

        <div className="mt-8 border-t border-border-default pt-6 text-center">
          <p className="text-sm" style={{ color: BODY_TEXT_SOFT }}>
            {`© ${new Date().getFullYear()} Musclog. ${t('copyright')} ${t('latestBuild', { version: packageJson.version })}`}
          </p>
        </div>
      </div>
    </footer>
  );
}

export function WebsiteWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-bg-primary text-text-secondary">
      <Header />
      {children}
      <Footer />
    </div>
  );
}
