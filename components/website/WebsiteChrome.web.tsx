import { Link } from 'expo-router';
import { Check, ChevronDown, Download, Dumbbell } from 'lucide-react-native';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { StoreButtons } from '@/components/website/StoreButtons';
import { SectionBackground } from '@/components/website/WebsiteBackgrounds';
import i18n from '@/lang/lang';
import { resetAnalyticsConsent } from '@/utils/websiteAnalytics';

const BRAND_GREEN = '#22C55E';
const BODY_TEXT = '#D1D5DB';
const BODY_TEXT_SOFT = '#9CA3AF';
const CARD_BORDER = 'rgba(255, 255, 255, 0.12)';

const languages = [
  { code: 'en-us', label: 'English', flag: '🇬🇧' },
  { code: 'es-es', label: 'Español', flag: '🇪🇸' },
  { code: 'nl-nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'pt-br', label: 'Português', flag: '🇧🇷' },
];

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

  const buttonClasses = {
    default: 'hover:opacity-90',
    outline: 'border border-white/30 text-white hover:bg-white/10',
    white: 'hover:bg-white/90',
  };
  const popoverClasses = {
    default: 'right-0',
    outline: 'right-0',
    white: 'left-1/2 -translate-x-1/2',
  };

  const triggerRect = triggerRef.current?.getBoundingClientRect();
  const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
  const modalWidth = Math.min(Math.max(viewportWidth - 32, 0), 384);
  const centeredLeft =
    triggerRect != null && viewportWidth > 0
      ? Math.min(
          Math.max(triggerRect.left + triggerRect.width / 2 - modalWidth / 2, 16),
          viewportWidth - modalWidth - 16
        )
      : 16;

  const buttonStyleByVariant: Record<
    NonNullable<DownloadModalProps['variant']>,
    React.CSSProperties
  > = {
    default: {
      backgroundColor: BRAND_GREEN,
      color: '#000000',
    },
    outline: {},
    white: {
      backgroundColor: '#FFFFFF',
      color: '#000000',
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
              className={`fixed z-[160] mt-3 w-[min(calc(100vw-2rem),24rem)] rounded-2xl border bg-[rgba(7,13,12,0.96)] p-4 shadow-2xl backdrop-blur-xl ${popoverClasses[variant]}`}
              style={{
                borderColor: CARD_BORDER,
                top: triggerRect ? triggerRect.bottom + 12 : 0,
                left: centeredLeft,
              }}
              role="dialog"
              aria-labelledby="download-modal-title"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 id="download-modal-title" className="text-base font-bold text-white">
                    {t('title')}
                  </h3>
                  <p className="mt-1 text-sm" style={{ color: BODY_TEXT }}>
                    {t('description')}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t('close', { defaultValue: 'Close' })}
                  className="text-muted-foreground hover:text-foreground text-xl leading-none"
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

export function LanguagePicker() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.navigation' });
  const locale = i18n.resolvedLanguage ?? i18n.language;
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, [isOpen]);

  const handleLanguageChange = (newLocale: string) => {
    i18n.changeLanguage(newLocale).catch((err) => {
      console.warn('[LanguagePicker] Failed to change language:', err);
    });
    setIsOpen(false);
  };

  const currentLanguage = languages.find((language) => language.code === locale);
  const currentLanguageLabel = currentLanguage?.label ?? t('language');

  return (
    <div className="relative inline-flex" ref={pickerRef}>
      <button
        type="button"
        aria-label={t('language')}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        title={currentLanguageLabel}
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-all duration-150 hover:border-white/20 hover:bg-white/10"
        style={{
          color: '#F3F4F6',
          borderColor: isOpen ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255,255,255,0.08)',
          backgroundColor: isOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
          boxShadow: isOpen ? '0 0 0 1px rgba(34,197,94,0.18)' : 'none',
        }}
      >
        <span className="text-base leading-none">{currentLanguage?.flag ?? '🌐'}</span>
        <span className="hidden lg:inline" style={{ color: BODY_TEXT_SOFT }}>
          {t('language')}
        </span>
        <span className="max-w-[7.5rem] truncate font-medium">{currentLanguageLabel}</span>
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          color={BODY_TEXT_SOFT}
        />
      </button>

      {isOpen ? (
        <div
          role="menu"
          aria-label={t('language')}
          className="absolute right-0 top-full z-[170] mt-3 min-w-[220px] overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl"
          style={{
            borderColor: 'rgba(255,255,255,0.1)',
            background: 'linear-gradient(180deg, rgba(10,18,16,0.98) 0%, rgba(6,12,11,0.96) 100%)',
            boxShadow:
              '0 24px 70px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.03), 0 0 30px rgba(34,197,94,0.08)',
          }}
        >
          <div
            className="border-b px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: BODY_TEXT_SOFT, borderColor: 'rgba(255,255,255,0.08)' }}
          >
            {t('language')}
          </div>

          <div className="p-2">
            {languages.map((language) => {
              const isSelected = language.code === locale;

              return (
                <button
                  key={language.code}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  onClick={() => handleLanguageChange(language.code)}
                  className="hover:bg-white/6 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
                  style={{
                    backgroundColor: isSelected ? 'rgba(34,197,94,0.14)' : 'transparent',
                    color: isSelected ? '#F9FAFB' : BODY_TEXT,
                  }}
                >
                  <span className="text-lg leading-none">{language.flag}</span>
                  <span className="flex-1 text-sm font-medium">{language.label}</span>
                  {isSelected ? <Check className="h-4 w-4" color="#00FFA3" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Header() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.navigation' });

  return (
    <header
      className="fixed left-0 right-0 top-0 z-50 border-b backdrop-blur-md"
      style={{ backgroundColor: 'rgba(4, 10, 9, 0.86)', borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: BRAND_GREEN }}
          >
            <Dumbbell className="h-5 w-5 text-black" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-bold text-white">{t('appName')}</span>
            <span className="text-xs" style={{ color: BODY_TEXT_SOFT }}>
              {t('appTagline')}
            </span>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="/home#features"
            className="text-sm transition-colors hover:text-[#22C55E]"
            style={{ color: '#F3F4F6' }}
          >
            {t('features')}
          </Link>
          <Link
            href="/calculator"
            className="text-sm transition-colors hover:text-[#22C55E]"
            style={{ color: '#F3F4F6' }}
          >
            Calculator
          </Link>
          <Link
            href="/progress"
            className="text-sm transition-colors hover:text-[#22C55E]"
            style={{ color: '#F3F4F6' }}
          >
            {t('progress')}
          </Link>
          <a
            href="https://github.com/blopa/musclog-app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm transition-colors hover:text-[#22C55E]"
            style={{ color: '#F3F4F6' }}
          >
            {t('github')}
          </a>
          <DownloadModal
            variant="default"
            className="px-5 py-2.5 text-sm font-bold transition-transform hover:scale-[1.01]"
            style={{ backgroundColor: BRAND_GREEN, color: '#000000' }}
          >
            {t('download')}
          </DownloadModal>
          <LanguagePicker />
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <DownloadModal
            variant="default"
            className="hidden min-h-11 shrink-0 whitespace-nowrap px-4 py-2 text-sm font-bold shadow-[0_10px_30px_rgba(34,197,94,0.18)] [@media(min-width:550px)]:inline-flex"
          >
            <Download className="h-4 w-4" />
            <span>{t('download')}</span>
          </DownloadModal>
          <LanguagePicker />
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
    { text: t('license'), href: 'https://github.com/blopa/musclog-app/blob/main/LICENSE' },
    { text: t('github'), href: 'https://github.com/blopa/musclog-app' },
  ];

  return (
    <footer
      className="relative overflow-hidden border-t py-8"
      style={{ borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <SectionBackground variant="grid" />
      <div className="container mx-auto px-4">
        <div
          className="mb-8 flex flex-wrap items-center justify-center gap-3 [@media(min-width:767px)]:hidden"
          aria-label={navT('appName')}
        >
          <Link
            href="/home#features"
            className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors hover:border-white/20 hover:bg-white/10"
            style={{ color: '#F3F4F6', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            {navT('features')}
          </Link>
          <Link
            href="/calculator"
            className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors hover:border-white/20 hover:bg-white/10"
            style={{ color: '#F3F4F6', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            Calculator
          </Link>
          <Link
            href="/progress"
            className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors hover:border-white/20 hover:bg-white/10"
            style={{ color: '#F3F4F6', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            {navT('progress')}
          </Link>
          <a
            href="https://github.com/blopa/musclog-app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors hover:border-white/20 hover:bg-white/10"
            style={{ color: '#F3F4F6', borderColor: 'rgba(255,255,255,0.08)' }}
          >
            {navT('github')}
          </a>
          <DownloadModal
            variant="default"
            className="min-h-10 shrink-0 whitespace-nowrap px-4 py-2 text-sm font-bold shadow-[0_10px_30px_rgba(34,197,94,0.18)]"
          >
            <Download className="h-4 w-4" />
            <span>{navT('download')}</span>
          </DownloadModal>
        </div>

        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <Link href="/" className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: BRAND_GREEN }}
            >
              <Dumbbell className="h-5 w-5 text-black" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-white">{navT('appName')}</span>
              <span className="text-xs" style={{ color: BODY_TEXT_SOFT }}>
                {navT('appTagline')}
              </span>
            </div>
          </Link>

          <nav className="flex flex-wrap justify-center gap-6">
            {footerLinks.map((link) =>
              link.href.startsWith('http') ? (
                <a
                  key={link.text}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm transition-colors hover:text-[#22C55E]"
                  style={{ color: BODY_TEXT_SOFT }}
                >
                  {link.text}
                </a>
              ) : (
                <Link
                  key={link.text}
                  href={link.href}
                  className="text-sm transition-colors hover:text-[#22C55E]"
                  style={{ color: BODY_TEXT_SOFT }}
                >
                  {link.text}
                </Link>
              )
            )}
            <button
              onClick={resetAnalyticsConsent}
              className="cursor-pointer text-sm transition-colors hover:text-[#22C55E]"
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
              className="transition-colors hover:text-[#22C55E]"
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
              className="transition-colors hover:text-[#22C55E]"
              style={{ color: BODY_TEXT_SOFT }}
              aria-label="Instagram"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
          </div>
        </div>

        <div className="border-border mt-8 border-t pt-6 text-center">
          <p className="text-sm" style={{ color: 'rgba(209, 213, 219, 0.62)' }}>
            {`© ${new Date().getFullYear()} Musclog. ${t('copyright')}`}
          </p>
        </div>
      </div>
    </footer>
  );
}

export function WebsiteChrome({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <Header />
      {children}
      <Footer />
    </div>
  );
}
