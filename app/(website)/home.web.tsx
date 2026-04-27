import { Link } from 'expo-router';
import Head from 'expo-router/head';
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
import { useTranslation } from 'react-i18next';

import { StoreButtons } from '@/components/website/StoreButtons';
import {
  DotPattern,
  HeroBackground,
  SectionBackground,
} from '@/components/website/WebsiteBackgrounds';
import { DownloadModal } from '@/components/website/WebsiteChrome';

const BRAND_GREEN = '#22C55E';
const BRAND_GREEN_BRIGHT = '#00FFA3';
const BODY_TEXT = '#D1D5DB';
const BODY_TEXT_SOFT = '#9CA3AF';

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

export function CTA() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.cta' });
  return (
    <section className="relative overflow-hidden px-4 py-16 md:py-20">
      <SectionBackground variant="grid" />
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 h-[440px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]"
        style={{
          background:
            'radial-gradient(circle, rgba(0,255,163,0.12) 0%, rgba(34,197,94,0.08) 34%, rgba(0,0,0,0) 72%)',
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 container mx-auto">
        <div
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r p-10 md:p-16"
          style={{
            backgroundImage: `linear-gradient(90deg, #0f766ecc 0%, #0891b2dd 42%, ${BRAND_GREEN}ee 100%)`,
          }}
        >
          {/* Background Glow */}
          <div className="from-background/20 absolute inset-0 bg-gradient-to-t to-transparent" />

          <div className="relative z-10 mx-auto max-w-2xl space-y-6 text-center">
            <h2 className="text-3xl font-extrabold text-balance text-white md:text-4xl lg:text-5xl">
              {t('title')}
            </h2>
            <p className="text-lg font-medium text-balance text-white/90">{t('description')}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <DownloadModal variant="white">
                <Download className="h-4 w-4" />
                {t('download')}
              </DownloadModal>
              <a
                href="https://github.com/blopa/musclog-app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/40 bg-black/15 px-4 py-3 font-semibold text-white transition-colors hover:border-white hover:text-white"
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

export function FeatureGrid() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.featureGrid' });

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
    <section className="bg-card/50 relative overflow-hidden py-16 md:py-20">
      <SectionBackground variant="grid" />
      <div
        className="pointer-events-none absolute top-[54%] left-1/2 h-[640px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[150px]"
        style={{
          background:
            'radial-gradient(circle, rgba(0,255,163,0.15) 0%, rgba(34,197,94,0.11) 32%, rgba(0,0,0,0) 74%)',
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 container mx-auto px-4">
        <div className="mb-12 text-center md:mb-16">
          <h2 className="mb-4 text-3xl font-extrabold text-balance text-white md:text-4xl">
            {t('title')}
          </h2>
          <p
            className="mx-auto max-w-2xl text-base text-balance md:text-lg"
            style={{ color: BODY_TEXT_SOFT }}
          >
            {t('description')}
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border p-6 transition-colors hover:border-white/20"
              style={{
                borderColor: 'rgba(255, 255, 255, 0.1)',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors group-hover:bg-white/10"
                style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)' }}
              >
                <feature.icon className="h-6 w-6" color={BRAND_GREEN_BRIGHT} />
              </div>
              <h3 className="mb-2 text-lg font-bold text-white">{feature.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: '#9CA3AF' }}>
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Features() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.features' });

  const features = [
    {
      icon: Dumbbell,
      iconColor: BRAND_GREEN_BRIGHT,
      iconBg: 'rgba(34, 197, 94, 0.13)',
      title: t('strengthTracking.title'),
      description: t('strengthTracking.description'),
      link: { text: t('strengthTracking.link'), href: '#features' },
    },
    {
      icon: Shield,
      iconColor: '#38BDF8',
      iconBg: 'rgba(56, 189, 248, 0.12)',
      title: t('privacyFirst.title'),
      description: t('privacyFirst.description'),
      link: { text: t('privacyFirst.link'), href: '/privacy' },
    },
    {
      icon: Code2,
      iconColor: '#A855F7',
      iconBg: 'rgba(168, 85, 247, 0.12)',
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
    <section id="features" className="relative overflow-hidden py-16 md:py-20">
      <SectionBackground variant="dots" />
      <div className="relative z-10 container mx-auto px-4">
        {/* Section Header */}
        <div className="mb-12 text-center md:mb-16">
          <h2 className="mb-4 text-3xl font-extrabold text-balance text-white md:text-4xl">
            {t('title')}
          </h2>
          <p
            className="mx-auto max-w-xl text-base text-balance md:text-lg"
            style={{ color: BODY_TEXT }}
          >
            {t('description')}
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="space-y-4 rounded-2xl border bg-black/32 p-7 transition-colors hover:border-white/20"
              style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}
            >
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl"
                style={{ backgroundColor: feature.iconBg }}
              >
                <feature.icon className="h-7 w-7" color={feature.iconColor} />
              </div>
              <h3 className="text-xl font-bold text-white">{feature.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: BODY_TEXT }}>
                {feature.description}
              </p>
              {feature.link.external ? (
                <a
                  href={feature.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                  style={{ color: feature.iconColor }}
                >
                  {feature.link.text}
                  <ArrowRight className="h-4 w-4" />
                </a>
              ) : (
                <Link
                  href={feature.link.href}
                  className="inline-flex items-center gap-1 text-sm font-semibold hover:underline"
                  style={{ color: feature.iconColor }}
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

export function Testimonial() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.testimonial' });

  return (
    <section className="relative overflow-hidden py-16 md:py-20">
      <DotPattern className="text-primary/50" />
      <div className="from-background/50 to-background/50 absolute inset-0 bg-gradient-to-b via-transparent" />
      <div className="relative z-10 container mx-auto px-4">
        <div className="mx-auto max-w-3xl space-y-8 text-center">
          {/* Quote Icon */}
          <div className="flex justify-center">
            <Quote className="h-12 w-12 rotate-180" color={BRAND_GREEN_BRIGHT} />
          </div>

          {/* Quote Text */}
          <blockquote className="text-2xl leading-relaxed font-bold text-balance text-white md:text-3xl lg:text-4xl">
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
              <p className="font-bold text-white">{t('author')}</p>
              <p className="text-sm" style={{ color: BODY_TEXT_SOFT }}>
                {t('role')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Stats() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.stats' });

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
    <section
      className="relative overflow-hidden border-y py-20 md:py-24"
      style={{ borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <DotPattern className="text-primary/40" />
      <div className="from-background/80 to-background/80 absolute inset-0 bg-gradient-to-r via-transparent" />
      <div className="relative z-10 container mx-auto px-4">
        <div className="grid grid-cols-2 gap-8 md:gap-12 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div
                className="mb-2 text-4xl font-extrabold md:text-5xl"
                style={{ color: BRAND_GREEN_BRIGHT }}
              >
                {stat.value}
              </div>
              <div className="mb-1 font-bold text-white">{stat.label}</div>
              <div className="text-sm" style={{ color: '#D1D5DB' }}>
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HowItWorks() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.howItWorks' });

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
    <section className="relative overflow-hidden py-20 md:py-24">
      <SectionBackground variant="grid" />
      <div className="from-background to-background absolute inset-0 bg-gradient-to-b via-transparent" />
      <div
        className="pointer-events-none absolute top-[48%] left-1/2 h-[420px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[140px]"
        style={{
          background:
            'radial-gradient(circle, rgba(0,255,163,0.10) 0%, rgba(34,197,94,0.07) 34%, rgba(0,0,0,0) 72%)',
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 container mx-auto px-4">
        <div className="mb-12 text-center md:mb-16">
          <h2 className="mb-4 text-3xl font-extrabold text-balance text-white md:text-4xl">
            {t('title')}
          </h2>
          <p
            className="mx-auto max-w-xl text-base text-balance md:text-lg"
            style={{ color: '#D1D5DB' }}
          >
            {t('description')}
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3 md:gap-12">
          {steps.map((item, index) => (
            <div key={item.step} className="relative flex justify-center">
              {/* Connector line for desktop */}
              {index < steps.length - 1 ? (
                <div
                  className="absolute top-12 left-[62%] hidden h-px w-[76%] md:block"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(34,197,94,0.24) 0%, rgba(209,213,219,0.18) 100%)',
                  }}
                />
              ) : null}

              <div className="flex max-w-sm flex-col items-center text-center">
                <div className="relative mb-6">
                  <div
                    className="flex h-24 w-24 items-center justify-center rounded-full border"
                    style={{
                      backgroundColor: 'rgba(34, 197, 94, 0.12)',
                      borderColor: 'rgba(255,255,255,0.08)',
                      boxShadow: '0 0 0 10px rgba(34,197,94,0.03), 0 0 40px rgba(0,255,163,0.12)',
                    }}
                  >
                    <item.icon className="h-10 w-10" color={BRAND_GREEN_BRIGHT} />
                  </div>
                  <span
                    className="absolute top-0 right-0 flex h-8 w-8 translate-x-1/4 -translate-y-1/4 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{ backgroundColor: BRAND_GREEN_BRIGHT, color: '#000000' }}
                  >
                    {item.step}
                  </span>
                </div>
                <h3 className="mb-3 text-xl font-bold text-white">{item.title}</h3>
                <p className="max-w-xs leading-relaxed" style={{ color: '#9CA3AF' }}>
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Hero() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.hero' });
  return (
    <section className="relative overflow-hidden pt-24 pb-16 md:pt-32 md:pb-20">
      <HeroBackground />
      <div className="relative z-10 container mx-auto px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left Content */}
          <div className="space-y-6">
            {/* Badges */}
            <div className="flex flex-wrap gap-3">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold"
                style={{ backgroundColor: BRAND_GREEN, color: '#ffffff' }}
              >
                <span className="text-white">★</span> {t('badge1')}
              </span>
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{
                  borderColor: 'rgba(255,255,255,0.1)',
                  color: BODY_TEXT,
                  backgroundColor: 'rgba(255,255,255,0.04)',
                }}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z" />
                </svg>
                {t('badge2')}
              </span>
            </div>

            {/* Heading */}
            <h1 className="text-4xl leading-tight font-extrabold text-balance text-white md:text-6xl lg:text-[4.6rem]">
              {t('title1')}
              <br />
              <span style={{ color: BRAND_GREEN_BRIGHT }}>{t('title2')}</span>
            </h1>

            {/* Subheading */}
            <p className="max-w-md text-lg leading-9" style={{ color: BODY_TEXT }}>
              {t('subheading')}
            </p>

            {/* CTA Buttons */}
            <StoreButtons />

            {/* GitHub Link */}
            <a
              href="https://github.com/blopa/musclog-app"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold transition-colors hover:text-white"
              style={{ color: '#D1D5DB' }}
            >
              <Code2 className="h-4 w-4" />
              {t('github')}
            </a>
          </div>

          {/* Right Content - Phone Mockup with Screenshot */}
          <div className="flex justify-center lg:justify-end">
            <div className="relative w-full max-w-[420px]">
              <div
                className="absolute inset-0 rounded-full blur-[110px]"
                style={{
                  background:
                    'radial-gradient(circle, rgba(0,255,163,0.16) 0%, rgba(34,197,94,0.11) 38%, rgba(0,0,0,0) 74%)',
                  transform: 'translate(6%, 10%) scale(1.12)',
                }}
                aria-hidden="true"
              />
              <div className="flex justify-center">
                {/* Phone Frame */}
                <div
                  className="relative w-[280px] rounded-[2.5rem] border-2 bg-black/40 p-2 shadow-2xl md:w-[320px]"
                  style={{
                    borderColor: 'rgba(255,255,255,0.65)',
                    boxShadow: '0 0 0 1px rgba(34,197,94,0.22), 0 30px 80px rgba(0,0,0,0.55)',
                  }}
                >
                  <div className="overflow-hidden rounded-[2rem]">
                    <img
                      src="/images/app-screenshot.png"
                      alt="Musclog app screenshot"
                      width={320}
                      height={640}
                      className="h-auto w-full"
                      style={{ filter: 'saturate(1.22) contrast(1.08) brightness(1.04)' }}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <Link
                  href="/app"
                  className="inline-flex min-w-44 items-center justify-center gap-2 rounded-full border border-[#00ffa34d] bg-[#071813] px-5 py-3 text-sm font-bold text-white shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition-all duration-200 hover:-translate-y-0.5"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: BRAND_GREEN_BRIGHT,
                      boxShadow: '0 0 14px rgba(0,255,163,0.8)',
                    }}
                  />
                  <span>{t('demoButton')}</span>
                  <ArrowRight className="h-4 w-4" color={BRAND_GREEN_BRIGHT} />
                </Link>
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
    <>
      <Head>
        <title>Musclog - Lift, Log, Repeat</title>
      </Head>
      <main>
        <Hero />
        <Features />
        <FeatureGrid />
        <Stats />
        <HowItWorks />
        <Testimonial />
        <CTA />
      </main>
    </>
  );
}
