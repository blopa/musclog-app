import { Link } from 'expo-router';
import {
  ArrowRight,
  Calendar,
  Code2,
  Download,
  Dumbbell,
  Heart,
  Lock,
  Quote,
  ScanBarcode,
  Shield,
  Smartphone,
  Sparkles,
  TrendingUp,
} from 'lucide-react-native';
import { ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import i18n from '@/lang/lang';

// TODO: implement this later
const trackStoreButtonClick = (param: any) => {};

interface DownloadModalProps {
  children: ReactNode;
  variant?: 'default' | 'outline' | 'white';
}

const clientSnapshot = () => true;
const serverSnapshot = () => false;
const emptySubscribe = () => () => {};

function useIsClient() {
  return useSyncExternalStore(emptySubscribe, clientSnapshot, serverSnapshot);
}

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
  logo: React.ReactNode;
  title: string;
  storeName: string;
  onClick?: () => void;
  href?: string;
  /** Fires on link click (e.g. analytics) before navigation */
  onLinkClick?: () => void;
}

function StoreButton({ logo, title, storeName, onClick, href, onLinkClick }: StoreButtonProps) {
  const className =
    'inline-flex items-center gap-3 px-4 py-2.5 rounded-xl border-2 border-zinc-700 bg-black text-white hover:border-zinc-500 transition-colors cursor-pointer min-w-[175px]';

  const content = (
    <>
      <span className="shrink-0">{logo}</span>
      <span className="flex flex-col items-start">
        <span className="text-[11px] leading-none text-zinc-400">{title}</span>
        <span className="font-sans text-lg font-bold leading-tight">{storeName}</span>
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

interface Snackbar {
  isOpen: boolean;
  message: string;
}

export function StoreButtons() {
  const [snackbar, setSnackbar] = useState<Snackbar>({ isOpen: false, message: '' });
  const mounted = useIsClient();
  const { t } = useTranslation();

  const handleAppStoreClick = () => {
    trackStoreButtonClick({ store: 'app_store', availability: 'coming_soon' });
    setSnackbar({ isOpen: true, message: t('comingSoon') });
    setTimeout(() => setSnackbar({ isOpen: false, message: '' }), 3000);
  };

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <StoreButton
          logo={<GooglePlayLogo />}
          title={t('googleTitle')}
          storeName={t('googleStore')}
          href="https://play.google.com/store/apps/details?id=com.werules.logger"
          onLinkClick={() =>
            trackStoreButtonClick({ store: 'google_play', availability: 'available' })
          }
        />
        <StoreButton
          logo={<AppleLogo />}
          title={t('appleTitle')}
          storeName={t('appleStore')}
          onClick={handleAppStoreClick}
        />
      </div>

      {mounted && snackbar.isOpen
        ? createPortal(
            <div
              className="pointer-events-auto fixed bottom-4 left-4 right-4 z-[200] flex items-center justify-between rounded-lg bg-zinc-800 px-4 py-3 text-white shadow-lg sm:left-auto sm:right-4 sm:w-80"
              role="status"
            >
              <span className="text-sm">{snackbar.message}</span>
              <button
                type="button"
                onClick={() => setSnackbar({ isOpen: false, message: '' })}
                className="ml-4 text-zinc-400 transition-colors hover:text-white"
              >
                ✕
              </button>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export function GridPattern({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`absolute inset-0 h-full w-full ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="grid-pattern" width="40" height="40" patternUnits="userSpaceOnUse">
          <path
            d="M 40 0 L 0 0 0 40"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeOpacity="0.4"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-pattern)" />
    </svg>
  );
}

export function DotPattern({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`absolute inset-0 h-full w-full ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="dot-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.2" fill="currentColor" fillOpacity="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#dot-pattern)" />
    </svg>
  );
}

export function GlowOrb({
  className = '',
  color = 'primary',
}: {
  className?: string;
  color?: 'primary' | 'accent' | 'cyan';
}) {
  const colorMap = {
    primary: 'from-primary/20 via-primary/5',
    accent: 'from-emerald-500/20 via-emerald-500/5',
    cyan: 'from-cyan-500/15 via-cyan-500/5',
  };

  return (
    <div
      className={`bg-gradient-radial absolute rounded-full blur-3xl ${colorMap[color]} to-transparent ${className}`}
      aria-hidden="true"
    />
  );
}

export function FloatingShapes({ className = '' }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* Large ring */}
      <svg
        className="text-primary/10 absolute -right-20 -top-20 h-96 w-96"
        viewBox="0 0 200 200"
        fill="none"
      >
        <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="0.5" />
        <circle cx="100" cy="100" r="60" stroke="currentColor" strokeWidth="0.5" />
        <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="0.5" />
      </svg>

      {/* Hexagon grid */}
      <svg
        className="text-primary/10 absolute -left-10 top-1/3 h-64 w-64"
        viewBox="0 0 100 100"
        fill="none"
      >
        <polygon
          points="50,5 90,25 90,75 50,95 10,75 10,25"
          stroke="currentColor"
          strokeWidth="0.5"
        />
        <polygon
          points="50,20 75,35 75,65 50,80 25,65 25,35"
          stroke="currentColor"
          strokeWidth="0.5"
        />
      </svg>

      {/* Diagonal lines */}
      <svg
        className="text-primary/10 absolute bottom-0 right-1/4 h-80 w-80"
        viewBox="0 0 100 100"
        fill="none"
      >
        {[...Array(5)].map((_, i) => (
          <line
            key={i}
            x1={i * 20}
            y1="0"
            x2={i * 20 + 100}
            y2="100"
            stroke="currentColor"
            strokeWidth="0.3"
          />
        ))}
      </svg>
    </div>
  );
}

export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* Base grid */}
      <GridPattern className="text-primary" />

      {/* Gradient overlays */}
      <div className="from-background to-background absolute inset-0 bg-gradient-to-b via-transparent" />
      <div className="from-background to-background/50 absolute inset-0 bg-gradient-to-r via-transparent" />

      {/* Glow orbs */}
      <div className="bg-primary/10 absolute right-1/4 top-20 h-96 w-96 rounded-full blur-[128px]" />
      <div className="absolute bottom-0 left-1/4 h-64 w-64 rounded-full bg-cyan-500/10 blur-[100px]" />

      {/* Floating geometric shapes */}
      <FloatingShapes />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

export function SectionBackground({ variant = 'dots' }: { variant?: 'dots' | 'grid' | 'minimal' }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {variant === 'dots' ? <DotPattern className="text-primary/60" /> : null}
      {variant === 'grid' ? <GridPattern className="text-primary/60" /> : null}

      {/* Subtle gradient for depth */}
      <div className="via-primary/[0.05] absolute inset-0 bg-gradient-to-b from-transparent to-transparent" />

      {/* Edge fades - reduced height */}
      <div className="from-background absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent" />
      <div className="from-background absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t to-transparent" />
    </div>
  );
}

export function CTA() {
  const { t } = useTranslation();
  return (
    <section className="px-4 py-16 md:py-24">
      <div className="container mx-auto">
        <div className="from-primary/80 relative overflow-hidden rounded-3xl bg-gradient-to-r via-teal-500/80 to-cyan-500/80 p-8 md:p-16">
          {/* Background Glow */}
          <div className="from-background/20 absolute inset-0 bg-gradient-to-t to-transparent" />

          <div className="relative z-10 mx-auto max-w-2xl space-y-6 text-center">
            <h2 className="text-balance text-3xl font-bold text-white md:text-4xl lg:text-5xl">
              {t('title')}
            </h2>
            <p className="text-balance text-lg text-white/90">{t('description')}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <DownloadModal variant="white">
                <Download className="h-4 w-4" />
                {t('download')}
              </DownloadModal>
              <a
                href="https://github.com/blopa/musclog-app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/30 px-4 py-3 font-medium text-white transition-colors hover:bg-white/10"
              >
                <Code2 className="h-4 w-4" />
                {t('sourceCode')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function DownloadModal({ children, variant = 'default' }: DownloadModalProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const buttonClasses = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-white/30 text-white hover:bg-white/10',
    white: 'bg-white text-background hover:bg-white/90',
  };

  return (
    <>
      <button
        type="button"
        className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium transition-colors ${buttonClasses[variant]}`}
        onClick={() => setIsOpen(true)}
      >
        {children}
      </button>
      {isOpen ? (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="download-modal-title"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-background border-border w-full max-w-md rounded-2xl border p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 id="download-modal-title" className="text-xl font-semibold">
                  {t('title')}
                </h3>
                <p className="text-muted-foreground mt-1 text-sm">{t('description')}</p>
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
            <div className="flex justify-center py-4">
              <StoreButtons />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function FeatureGrid() {
  const { t } = useTranslation();

  const features = [
    {
      icon: Sparkles,
      title: t('items.aiCoach.title'),
      description: t('items.aiCoach.description'),
    },
    {
      icon: ScanBarcode,
      title: t('items.barcode.title'),
      description: t('items.barcode.description'),
    },
    {
      icon: Calendar,
      title: t('items.checkins.title'),
      description: t('items.checkins.description'),
    },
    {
      icon: TrendingUp,
      title: t('items.analytics.title'),
      description: t('items.analytics.description'),
    },
    {
      icon: Heart,
      title: t('items.cycle.title'),
      description: t('items.cycle.description'),
    },
    {
      icon: Dumbbell,
      title: t('items.templates.title'),
      description: t('items.templates.description'),
    },
    {
      icon: Smartphone,
      title: t('items.healthConnect.title'),
      description: t('items.healthConnect.description'),
    },
    {
      icon: Lock,
      title: t('items.encryption.title'),
      description: t('items.encryption.description'),
    },
  ];

  return (
    <section className="bg-card/50 relative overflow-hidden py-16 md:py-24">
      <SectionBackground variant="grid" />
      <div className="container relative z-10 mx-auto px-4">
        <div className="mb-12 text-center md:mb-16">
          <h2 className="mb-4 text-balance text-3xl font-bold md:text-4xl">{t('title')}</h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-balance">{t('description')}</p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="border-border bg-background hover:border-primary/40 group rounded-2xl border p-6 transition-colors"
            >
              <div className="bg-primary/10 group-hover:bg-primary/20 mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors">
                <feature.icon className="text-primary h-6 w-6" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Features() {
  const { t } = useTranslation();

  const features = [
    {
      icon: Dumbbell,
      iconColor: 'text-primary',
      title: t('strengthTracking.title'),
      description: t('strengthTracking.description'),
      link: { text: t('strengthTracking.link'), href: '#features' },
    },
    {
      icon: Shield,
      iconColor: 'text-cyan-400',
      title: t('privacyFirst.title'),
      description: t('privacyFirst.description'),
      link: { text: t('privacyFirst.link'), href: '/privacy' },
    },
    {
      icon: Code2,
      iconColor: 'text-pink-400',
      title: t('openSource.title'),
      description: t('openSource.description'),
      link: {
        text: t('openSource.link'),
        href: 'https://github.com/blopa/musclog-app',
        external: true,
      },
    },
  ];

  return (
    <section id="features" className="relative overflow-hidden py-16 md:py-24">
      <SectionBackground variant="dots" />
      <div className="container relative z-10 mx-auto px-4">
        {/* Section Header */}
        <div className="mb-12 text-center md:mb-16">
          <h2 className="mb-4 text-balance text-3xl font-bold md:text-4xl">{t('title')}</h2>
          <p className="text-muted-foreground mx-auto max-w-xl text-balance">{t('description')}</p>
        </div>

        {/* Feature Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-card border-border hover:border-primary/30 space-y-4 rounded-2xl border p-6 transition-colors"
            >
              <div
                className={`bg-secondary flex h-10 w-10 items-center justify-center rounded-lg ${feature.iconColor}`}
              >
                <feature.icon className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
              {feature.link.external ? (
                <a
                  href={feature.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
                >
                  {feature.link.text}
                  <ArrowRight className="h-4 w-4" />
                </a>
              ) : (
                <Link
                  href={feature.link.href}
                  className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
                >
                  {feature.link.text}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  const { t } = useTranslation();

  const footerLinks = [
    { text: t('privacyPolicy'), href: '/privacy' },
    { text: t('terms'), href: '/terms' },
    { text: t('contact'), href: '/contact' },
    { text: t('license'), href: 'https://github.com/blopa/musclog-app/blob/main/LICENSE' },
    { text: t('github'), href: 'https://github.com/blopa/musclog-app' },
  ];

  return (
    <footer className="border-border border-t py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="bg-primary flex h-7 w-7 items-center justify-center rounded-lg">
              <Dumbbell className="text-primary-foreground h-4 w-4" />
            </div>
            <span className="font-semibold">{t('title')}</span>
          </Link>

          {/* Links */}
          <nav className="flex flex-wrap justify-center gap-6">
            {footerLinks.map((link) =>
              link.href.startsWith('http') ? (
                <a
                  key={link.text}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  {link.text}
                </a>
              ) : (
                <Link
                  key={link.text}
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  {link.text}
                </Link>
              )
            )}
            <button
              // resetAnalyticsConsent
              onClick={() => {}}
              className="text-muted-foreground hover:text-foreground cursor-pointer text-sm transition-colors"
            >
              {t('cookieSettings')}
            </button>
          </nav>

          {/* Social Icons */}
          <div className="flex items-center gap-4">
            <a
              href="https://youtube.com/@musclog"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
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
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Instagram"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
              </svg>
            </a>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-border mt-8 border-t pt-6 text-center">
          <p className="text-muted-foreground text-sm">
            {`© ${new Date().getFullYear()} Musclog. Free & Open Source Software. Built for your privacy.`}
          </p>
        </div>
      </div>
    </footer>
  );
}

export function Header() {
  const { t } = useTranslation();
  return (
    <header className="bg-background/80 border-border fixed left-0 right-0 top-0 z-50 border-b backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="bg-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            <Dumbbell className="text-primary-foreground h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-semibold">{t('appName')}</span>
            <span className="text-muted-foreground text-xs">{t('appTagline')}</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="#features"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            {t('features')}
          </Link>
          <Link
            href="/calculator"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            {t('calculator')}
          </Link>
          <a
            href="https://github.com/blopa/musclog-app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            {t('github')}
          </a>
          <DownloadModal variant="default">{t('download')}</DownloadModal>
          <LanguagePicker />
        </nav>

        <div className="flex items-center gap-2 md:hidden">
          <DownloadModal variant="default">{t('downloadShort')}</DownloadModal>
          <LanguagePicker />
        </div>
      </div>
    </header>
  );
}

export function Testimonial() {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden py-16 md:py-24">
      <DotPattern className="text-primary/50" />
      <div className="from-background/50 to-background/50 absolute inset-0 bg-gradient-to-b via-transparent" />
      <div className="container relative z-10 mx-auto px-4">
        <div className="mx-auto max-w-3xl space-y-8 text-center">
          {/* Quote Icon */}
          <div className="flex justify-center">
            <Quote className="text-primary h-12 w-12 rotate-180" />
          </div>

          {/* Quote Text */}
          <blockquote className="text-balance text-2xl font-medium leading-relaxed md:text-3xl lg:text-4xl">
            {t('quote')}
          </blockquote>

          {/* Author */}
          <div className="flex flex-col items-center gap-3">
            <div className="bg-secondary border-primary/30 h-14 w-14 overflow-hidden rounded-full border-2">
              <img
                src="/images/user-avatar.jpg"
                alt={t('author')}
                width={56}
                height={56}
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <p className="font-semibold">{t('author')}</p>
              <p className="text-muted-foreground text-sm">{t('role')}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Stats() {
  const { t } = useTranslation();

  const stats = [
    {
      value: t('vitamins.value'),
      label: t('vitamins.label'),
      description: t('vitamins.description'),
    },
    {
      value: t('offline.value'),
      label: t('offline.label'),
      description: t('offline.description'),
    },
    {
      value: t('cloud.value'),
      label: t('cloud.label'),
      description: t('cloud.description'),
    },
    {
      value: t('encryption.value'),
      label: t('encryption.label'),
      description: t('encryption.description'),
    },
  ];

  return (
    <section className="border-border relative overflow-hidden border-y py-16 md:py-20">
      <DotPattern className="text-primary/40" />
      <div className="from-background/80 to-background/80 absolute inset-0 bg-gradient-to-r via-transparent" />
      <div className="container relative z-10 mx-auto px-4">
        <div className="grid grid-cols-2 gap-8 md:gap-12 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-primary mb-2 text-4xl font-bold md:text-5xl">{stat.value}</div>
              <div className="text-foreground mb-1 font-medium">{stat.label}</div>
              <div className="text-muted-foreground text-sm">{stat.description}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const languages = [
  { code: 'en-us', label: 'English', flag: '🇺🇸' },
  { code: 'es-es', label: 'Español', flag: '🇪🇸' },
  { code: 'nl-nl', label: 'Nederlands', flag: '🇳🇱' },
  { code: 'pt-br', label: 'Português', flag: '🇧🇷' },
];

export function LanguagePicker() {
  const { t } = useTranslation();
  const locale = i18n.resolvedLanguage ?? i18n.language;

  const handleLanguageChange = (newLocale: string) => {
    i18n.changeLanguage(newLocale).catch((err) => {
      console.warn('[LanguagePicker] Failed to change language:', err);
    });
  };

  const currentLanguage = languages.find((lang) => lang.code === locale);

  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">{t('language')}</span>
      <select
        aria-label={t('language')}
        className="hover:bg-accent text-foreground w-fit cursor-pointer rounded-md border-none bg-transparent px-2 py-1 text-sm outline-none"
        value={locale}
        onChange={(event) => handleLanguageChange(event.target.value)}
      >
        {!currentLanguage ? <option value="">{t('language')}</option> : null}
        {languages.map((language) => (
          <option key={language.code} value={language.code}>
            {language.flag} {language.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function HowItWorks() {
  const { t } = useTranslation();

  const steps = [
    {
      icon: Download,
      step: '01',
      title: t('steps.step1.title'),
      description: t('steps.step1.description'),
    },
    {
      icon: Dumbbell,
      step: '02',
      title: t('steps.step2.title'),
      description: t('steps.step2.description'),
    },
    {
      icon: TrendingUp,
      step: '03',
      title: t('steps.step3.title'),
      description: t('steps.step3.description'),
    },
  ];

  return (
    <section className="relative overflow-hidden py-16 md:py-24">
      <GridPattern className="text-primary/40" />
      <div className="from-background to-background absolute inset-0 bg-gradient-to-b via-transparent" />
      <div className="container relative z-10 mx-auto px-4">
        <div className="mb-12 text-center md:mb-16">
          <h2 className="mb-4 text-balance text-3xl font-bold md:text-4xl">{t('title')}</h2>
          <p className="text-muted-foreground mx-auto max-w-xl text-balance">{t('description')}</p>
        </div>

        <div className="grid gap-8 md:grid-cols-3 md:gap-12">
          {steps.map((item, index) => (
            <div key={item.step} className="relative">
              {/* Connector line for desktop */}
              {index < steps.length - 1 ? (
                <div className="bg-border absolute left-[60%] top-12 hidden h-px w-[80%] md:block" />
              ) : null}

              <div className="flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <div className="bg-primary/10 flex h-24 w-24 items-center justify-center rounded-full">
                    <item.icon className="text-primary h-10 w-10" />
                  </div>
                  <span className="bg-primary text-primary-foreground absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold">
                    {item.step}
                  </span>
                </div>
                <h3 className="mb-3 text-xl font-semibold">{item.title}</h3>
                <p className="text-muted-foreground max-w-xs leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Hero() {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden pb-16 pt-24 md:pb-24 md:pt-32">
      <HeroBackground />
      <div className="container relative z-10 mx-auto px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left Content */}
          <div className="space-y-6">
            {/* Badges */}
            <div className="flex flex-wrap gap-3">
              <span className="bg-primary/10 text-primary border-primary/20 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium">
                <span className="text-yellow-400">★</span> {t('badge1')}
              </span>
              <span className="bg-secondary text-muted-foreground border-border inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium">
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                </svg>
                {t('badge2')}
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-balance text-4xl font-bold leading-tight md:text-5xl lg:text-6xl">
              {t('title1')}
              <br />
              <span className="text-primary">{t('title2')}</span>
            </h1>

            {/* Subheading */}
            <p className="text-muted-foreground max-w-md text-lg">{t('subheading')}</p>

            {/* CTA Buttons */}
            <StoreButtons />

            {/* GitHub Link */}
            <a
              href="https://github.com/blopa/musclog-app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm transition-colors"
            >
              <Code2 className="h-4 w-4" />
              {t('github')}
            </a>
          </div>

          {/* Right Content - Phone Mockup with Screenshot */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative">
              {/* Phone Frame */}
              <div className="bg-card border-primary/30 shadow-primary/10 relative w-[280px] rounded-[2.5rem] border-2 p-2 shadow-2xl md:w-[320px]">
                <div className="overflow-hidden rounded-[2rem]">
                  <img
                    src="/images/app-screenshot.png"
                    alt={t('appScreenshot')}
                    width={320}
                    height={640}
                    className="h-auto w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <Header />
      <main>
        <Hero />
        <Features />
        <FeatureGrid />
        <Stats />
        <HowItWorks />
        <Testimonial />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
