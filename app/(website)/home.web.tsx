import { Link } from 'expo-router';
import { ArrowRight, Code2, Download, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { StoreButtons } from '@/components/website/StoreButtons';
import {
  BODY_TEXT,
  BODY_TEXT_SOFT,
  BRAND_GREEN_BRIGHT,
  HEADING_TEXT,
  ink,
} from '@/components/website/websiteColors';
import { WebsiteLoggy } from '@/components/website/WebsiteLoggy';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';
import { SoftwareApplicationJsonLd } from '@/components/website/WebsiteStructuredData';
import { DownloadModal } from '@/components/website/WebsiteWrapper';
import { GITHUB_REPO_URL } from '@/constants/misc';
import { THEME_IDS, type ThemeId } from '@/constants/settings';
import { useThemeId } from '@/hooks/useTheme';
import { THEME_DEFINITIONS } from '@/theme.registry';
import { trackDemoStart } from '@/utils/websiteAnalytics';
import { withExpoBaseUrl } from '@/utils/withExpoBaseUrl';

const STATIC_IMAGE = (filename: string) => withExpoBaseUrl(`/images/${filename}`);
const PHONE_SCREENSHOT = (filename: string) => STATIC_IMAGE(`phone/${filename}`);
const THEME_SCREENSHOT = (themeId: ThemeShowcaseId) => STATIC_IMAGE(`themes/${themeId}.webp`);

/**
 * The gallery shows every palette side by side, so, unlike the rest of the page,
 * its accents are read from the registry rather than from the active theme. The
 * labels come from the same `settings.theme.options` strings the in-app picker uses.
 */
const THEME_SHOWCASE = THEME_IDS.map((id) => ({
  accent: THEME_DEFINITIONS[id].palette.brandPrimary,
  id,
}));

type ThemeShowcaseId = ThemeId;

const SECTION_RULE = { borderColor: ink(0.08) };

export function CTA() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.cta' });

  return (
    <section className="border-t px-4 py-16 md:py-20" style={SECTION_RULE}>
      <div className="container mx-auto flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-xl">
          <h2 className="text-balance text-3xl font-bold text-text-primary md:text-4xl">
            {t('title')}
          </h2>
          <p className="mt-3 text-base md:text-lg" style={{ color: BODY_TEXT }}>
            {t('description')}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <DownloadModal>
            <Download className="h-4 w-4" />
            {t('download')}
          </DownloadModal>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-control border border-ink/25 px-5 py-3 font-semibold text-text-primary transition-colors hover:bg-ink/10"
          >
            <Code2 className="h-4 w-4" />
            {t('sourceCode')}
          </a>
        </div>
      </div>
    </section>
  );
}

/** Every capability as one scannable list; the section is the container, not each row. */
export function FeatureGrid() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.featureGrid' });

  const items = [
    'aiCoach',
    'barcode',
    'checkins',
    'analytics',
    'cycle',
    'templates',
    'healthConnect',
    'encryption',
  ] as const;

  return (
    <section id="features" className="border-t py-16 md:py-20" style={SECTION_RULE}>
      <div className="container mx-auto px-4">
        <div className="mb-10 max-w-2xl md:mb-12">
          <h2 className="text-balance text-3xl font-bold text-text-primary md:text-4xl">
            {t('title')}
          </h2>
          <p className="mt-3 text-base md:text-lg" style={{ color: BODY_TEXT }}>
            {t('description')}
          </p>
        </div>

        <dl className="grid gap-x-12 md:grid-cols-2">
          {items.map((key) => (
            <div key={key} className="border-t py-5" style={SECTION_RULE}>
              <dt className="text-lg font-bold text-text-primary">{t(`items.${key}.title`)}</dt>
              <dd className="mt-1 text-sm leading-relaxed" style={{ color: BODY_TEXT }}>
                {t(`items.${key}.description`)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/**
 * A short introduction to the mascot, the only place the homepage shows him. His picture sits
 * beside the text and is the section's one illustration; with "Show Loggy" off the text simply
 * stands alone, which is why he is a direct child of the flex row (no wrapper left to hold a gap).
 */
export function MeetLoggy() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.loggy' });

  return (
    <section className="border-t py-16 md:py-20" style={SECTION_RULE}>
      <div className="container mx-auto flex flex-col gap-8 px-4 md:flex-row md:items-center md:justify-between md:gap-16">
        <div className="max-w-xl">
          <h2 className="text-balance text-3xl font-bold text-text-primary md:text-4xl">
            {t('title')}
          </h2>
          <p className="mt-3 text-base md:text-lg" style={{ color: BODY_TEXT }}>
            {t('description')}
          </p>
          <p className="mt-3 text-sm" style={{ color: BODY_TEXT_SOFT }}>
            {t('setting')}
          </p>
        </div>
        <WebsiteLoggy
          pose="wave"
          className="order-first h-40 w-auto self-start md:order-last md:h-56 md:shrink-0 md:self-auto"
        />
      </div>
    </section>
  );
}

export function ScreenshotShowcase() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.screenshots' });
  const [isPaused, setIsPaused] = useState(false);
  const [activeModalIndex, setActiveModalIndex] = useState<number | null>(null);
  const [isMobileModal, setIsMobileModal] = useState(false);

  const slides = [
    {
      src: PHONE_SCREENSHOT('screenshot-1.png'),
      title: t('slides.home.title'),
      description: t('slides.home.description'),
      alt: t('slides.home.alt'),
    },
    {
      src: PHONE_SCREENSHOT('screenshot-13.png'),
      title: t('slides.chatCoach2.title'),
      description: t('slides.chatCoach2.description'),
      alt: t('slides.chatCoach2.alt'),
    },
    {
      src: PHONE_SCREENSHOT('screenshot-3.png'),
      title: t('slides.workouts.title'),
      description: t('slides.workouts.description'),
      alt: t('slides.workouts.alt'),
    },
    {
      src: PHONE_SCREENSHOT('screenshot-14.png'),
      title: t('slides.mealLogging.title'),
      description: t('slides.mealLogging.description'),
      alt: t('slides.mealLogging.alt'),
    },
    {
      src: PHONE_SCREENSHOT('screenshot-2.png'),
      title: t('slides.today.title'),
      description: t('slides.today.description'),
      alt: t('slides.today.alt'),
    },
    {
      src: PHONE_SCREENSHOT('screenshot-5.png'),
      title: t('slides.bodyMetrics.title'),
      description: t('slides.bodyMetrics.description'),
      alt: t('slides.bodyMetrics.alt'),
    },
    {
      src: PHONE_SCREENSHOT('screenshot-8.png'),
      title: t('slides.settings.title'),
      description: t('slides.settings.description'),
      alt: t('slides.settings.alt'),
    },
    {
      src: PHONE_SCREENSHOT('screenshot-10.png'),
      title: t('slides.restTimer.title'),
      description: t('slides.restTimer.description'),
      alt: t('slides.restTimer.alt'),
    },
  ];

  useEffect(() => {
    if (activeModalIndex === null) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActiveModalIndex(null);
        return;
      }

      if (event.key === 'ArrowLeft') {
        setActiveModalIndex((currentIndex) => {
          if (currentIndex === null) {
            return currentIndex;
          }

          return (currentIndex - 1 + slides.length) % slides.length;
        });
      }

      if (event.key === 'ArrowRight') {
        setActiveModalIndex((currentIndex) => {
          if (currentIndex === null) {
            return currentIndex;
          }

          return (currentIndex + 1) % slides.length;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeModalIndex, slides.length]);

  useEffect(() => {
    const updateIsMobileModal = () => {
      setIsMobileModal(window.innerWidth < 768);
    };

    updateIsMobileModal();
    window.addEventListener('resize', updateIsMobileModal);

    return () => window.removeEventListener('resize', updateIsMobileModal);
  }, []);

  const isTrackPaused = isPaused || activeModalIndex !== null;

  return (
    <section className="overflow-hidden border-t py-16 md:py-20" style={{ borderColor: ink(0.08) }}>
      <style>{`
        @keyframes musclog-screenshot-marquee {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .musclog-screenshot-track { animation: none !important; }
        }
      `}</style>

      <div className="container relative z-10 mx-auto px-4">
        <div className="mb-10 max-w-2xl md:mb-12">
          <h2 className="text-balance text-3xl font-bold text-text-primary md:text-4xl">
            {t('title')}
          </h2>
          <p className="mt-3 text-base md:text-lg" style={{ color: BODY_TEXT }}>
            {t('description')}
          </p>
        </div>

        <div>
          <div
            className="relative overflow-hidden py-2"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onFocusCapture={() => setIsPaused(true)}
            onBlurCapture={() => setIsPaused(false)}
          >
            <div
              className="musclog-screenshot-track flex w-max will-change-transform"
              style={{
                animation: 'musclog-screenshot-marquee 68s linear infinite',
                animationPlayState: isTrackPaused ? 'paused' : 'running',
              }}
            >
              {[0, 1].map((loopIndex) => (
                <div key={loopIndex} className="flex shrink-0 gap-5 pr-5">
                  {slides.map((slide, index) => (
                    <button
                      key={`${loopIndex}-${slide.alt}`}
                      type="button"
                      onClick={() => setActiveModalIndex(index)}
                      aria-label={`${t('openSlide')} ${slide.title}`}
                      className="group flex w-[180px] shrink-0 flex-col text-left sm:w-[200px] md:w-[220px]"
                    >
                      <div className="rounded-sheet border border-ink/10 bg-bg-card p-1.5 transition-colors group-hover:border-ink/30">
                        <div className="overflow-hidden rounded-card bg-bg-primary">
                          <img
                            src={slide.src}
                            alt={slide.alt}
                            className="aspect-[537/1165] w-full object-cover object-top"
                            loading={loopIndex === 0 && index < 3 ? 'eager' : 'lazy'}
                          />
                        </div>
                      </div>

                      <div className="px-1 pt-3">
                        <p className="text-sm font-bold text-text-primary">{slide.title}</p>
                        <p className="mt-1 text-xs leading-5" style={{ color: BODY_TEXT_SOFT }}>
                          {slide.description}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {activeModalIndex !== null && isMobileModal && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[220] flex items-center justify-center bg-scrim-base/90 p-3"
              onClick={() => setActiveModalIndex(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={t('modalAriaLabel')}
                className="relative flex h-full w-full items-center justify-center"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setActiveModalIndex(null)}
                  aria-label={t('close')}
                  className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-control border border-ink/10 bg-scrim-base/60 text-text-primary"
                >
                  <X className="h-5 w-5" />
                </button>

                <img
                  src={slides[activeModalIndex].src}
                  alt={slides[activeModalIndex].alt}
                  className="max-h-[calc(100dvh-1.5rem)] w-full max-w-[calc(100vw-1.5rem)] object-contain"
                />
              </div>
            </div>,
            document.body
          )
        : null}

      {activeModalIndex !== null && !isMobileModal && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed inset-0 z-[220] flex items-center justify-center bg-scrim-base/70 p-4"
              onClick={() => setActiveModalIndex(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={t('modalAriaLabel')}
                className="relative flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-sheet border border-ink/10 bg-bg-primary"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-ink/10 p-4 md:p-5">
                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-text-primary md:text-2xl">
                      {slides[activeModalIndex].title}
                    </h3>
                    <p className="max-w-2xl text-sm leading-6" style={{ color: BODY_TEXT }}>
                      {slides[activeModalIndex].description}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveModalIndex(null)}
                    aria-label={t('close')}
                    className="flex h-10 w-10 items-center justify-center rounded-control border border-ink/10 text-text-primary transition-colors hover:bg-ink/10"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)] lg:overflow-hidden">
                  <div className="relative flex min-h-0 flex-col bg-bg-card p-4 md:p-6">
                    <div className="flex items-center justify-between pb-4">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveModalIndex((currentIndex) =>
                            currentIndex === null
                              ? 0
                              : (currentIndex - 1 + slides.length) % slides.length
                          )
                        }
                        aria-label={t('previous')}
                        className="flex h-11 w-11 items-center justify-center rounded-control border border-ink/10 text-text-primary transition-colors hover:bg-ink/10"
                      >
                        <ArrowRight className="h-4 w-4 rotate-180" />
                      </button>

                      <div
                        className="text-sm font-semibold tabular-nums"
                        style={{ color: BODY_TEXT }}
                      >
                        {activeModalIndex + 1} / {slides.length}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setActiveModalIndex((currentIndex) =>
                            currentIndex === null ? 0 : (currentIndex + 1) % slides.length
                          )
                        }
                        aria-label={t('next')}
                        className="flex h-11 w-11 items-center justify-center rounded-control border border-ink/10 text-text-primary transition-colors hover:bg-ink/10"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-card border border-ink/10 bg-bg-primary">
                      <img
                        src={slides[activeModalIndex].src}
                        alt={slides[activeModalIndex].alt}
                        className="h-auto max-h-[72vh] w-full max-w-[32rem] object-contain"
                      />
                    </div>
                  </div>

                  <div className="border-t border-ink/10 bg-ink/[0.03] p-4 md:border-l md:border-t-0 md:p-6 lg:overflow-y-auto">
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">
                          {slides[activeModalIndex].title}
                        </p>
                        <p className="mt-2 text-sm leading-6" style={{ color: BODY_TEXT }}>
                          {slides[activeModalIndex].description}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {slides.map((slide, index) => {
                          const isActive = index === activeModalIndex;

                          return (
                            <button
                              key={slide.alt}
                              type="button"
                              onClick={() => setActiveModalIndex(index)}
                              aria-label={`${t('openSlide')} ${slide.title}`}
                              className="overflow-hidden rounded-inner border-2 transition-colors"
                              style={{
                                borderColor: isActive ? BRAND_GREEN_BRIGHT : 'transparent',
                              }}
                            >
                              <img
                                src={slide.src}
                                alt={slide.alt}
                                className="aspect-[537/1165] w-full object-cover object-top"
                              />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </section>
  );
}

export function Themes() {
  const { t } = useTranslation();
  const [activeThemeId, setActiveThemeId] = useState<ThemeShowcaseId>(THEME_SHOWCASE[0].id);

  const activeTheme =
    THEME_SHOWCASE.find((theme) => theme.id === activeThemeId) ?? THEME_SHOWCASE[0];

  return (
    <section id="themes" className="border-t py-16 md:py-20" style={{ borderColor: ink(0.08) }}>
      <div className="container mx-auto px-4">
        <div className="mb-10 max-w-2xl md:mb-12">
          <h2 className="text-balance text-3xl font-bold text-text-primary md:text-4xl">
            {t('website.themes.title')}
          </h2>
          <p className="mt-3 text-base md:text-lg" style={{ color: BODY_TEXT }}>
            {t('website.themes.description')}
          </p>
        </div>

        <div className="mb-10 flex flex-wrap gap-2">
          {THEME_SHOWCASE.map((theme) => {
            const isActive = theme.id === activeThemeId;

            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => setActiveThemeId(theme.id)}
                aria-pressed={isActive}
                className="flex items-center gap-2 rounded-control border px-4 py-2 text-sm font-semibold transition-colors"
                style={{
                  backgroundColor: isActive ? ink(0.08) : 'transparent',
                  borderColor: isActive ? theme.accent : ink(0.12),
                  color: isActive ? HEADING_TEXT : BODY_TEXT,
                }}
              >
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: theme.accent }}
                  aria-hidden="true"
                />
                {t(`settings.theme.options.${theme.id}.label`)}
              </button>
            );
          })}
        </div>

        <div className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex justify-center md:justify-start">
            <div
              className="w-full max-w-[16rem] overflow-hidden rounded-sheet border"
              style={{ borderColor: ink(0.12) }}
            >
              <img
                src={THEME_SCREENSHOT(activeTheme.id)}
                alt={t(`settings.theme.options.${activeTheme.id}.description`)}
                className="aspect-[1083/2340] w-full object-cover object-top"
              />
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <h3 className="text-xl font-bold text-text-primary">
                {t(`settings.theme.options.${activeTheme.id}.label`)}
              </h3>
              <p className="mt-3 text-lg leading-relaxed text-text-primary">
                {t(`settings.theme.options.${activeTheme.id}.description`)}
              </p>
            </div>

            <p className="text-sm leading-relaxed" style={{ color: BODY_TEXT }}>
              {t('website.themes.footnote')}
            </p>

            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 md:max-w-md">
              {THEME_SHOWCASE.map((theme) => {
                const isActive = theme.id === activeThemeId;

                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setActiveThemeId(theme.id)}
                    aria-label={t(`settings.theme.options.${theme.id}.label`)}
                    className="overflow-hidden rounded-inner border-2 transition-colors"
                    style={{
                      borderColor: isActive ? theme.accent : 'transparent',
                    }}
                  >
                    <img
                      src={THEME_SCREENSHOT(theme.id)}
                      alt=""
                      className="aspect-[1083/2340] w-full object-cover object-top"
                    />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Hero() {
  const themeId = useThemeId();
  const { t } = useTranslation(undefined, { keyPrefix: 'website.hero' });

  return (
    <section className="pb-16 pt-24 md:pb-20 md:pt-32">
      <div className="container mx-auto px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-6">
            <h1 className="text-balance text-4xl font-bold leading-tight text-text-primary md:text-6xl lg:text-[4.25rem]">
              {t('title1')} {t('title2')}
            </h1>

            <p className="max-w-lg text-lg leading-8" style={{ color: BODY_TEXT }}>
              {t('subheading')}
            </p>

            <p className="text-sm font-semibold" style={{ color: BODY_TEXT_SOFT }}>
              {t('badge1')}. {t('badge2')}.
            </p>

            <StoreButtons />

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm font-semibold">
              <Link
                href="/app"
                onPress={trackDemoStart}
                className="inline-flex items-center gap-2 text-text-primary underline underline-offset-4 hover:text-accent-bright"
              >
                {t('demoButton')}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href={GITHUB_REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 transition-colors hover:text-text-primary"
                style={{ color: BODY_TEXT }}
              >
                <Code2 className="h-4 w-4" />
                {t('github')}
              </a>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <div
              className="w-[280px] rounded-sheet border p-1.5 md:w-[320px]"
              style={{ borderColor: ink(0.2) }}
            >
              <div className="overflow-hidden rounded-card">
                <img
                  src={THEME_SCREENSHOT(themeId)}
                  alt={t('screenshotAlt')}
                  width={320}
                  height={640}
                  className="h-auto w-full"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { t } = useTranslation();

  return (
    <>
      <SoftwareApplicationJsonLd description={t('website.seo.routes.home.description')} />
      <main>
        <Hero />
        <ScreenshotShowcase />
        <FeatureGrid />
        <MeetLoggy />
        <Themes />
        <CTA />
      </main>
    </>
  );
}

export function generateMetadata() {
  return fixedPageMetadata('home');
}
