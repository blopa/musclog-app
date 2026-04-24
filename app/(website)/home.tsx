import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Calendar,
  Code2,
  Download,
  Dumbbell,
  Heart,
  Lock,
  ScanBarcode,
  Shield,
  Smartphone,
  Sparkles,
  TrendingUp,
} from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Linking, Platform, Pressable, Text, View } from 'react-native';

const GITHUB_URL = 'https://github.com/blopa/musclog-app';
const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.werules.logger';
const LICENSE_URL = 'https://github.com/blopa/musclog-app/blob/main/LICENSE';
const YOUTUBE_URL = 'https://youtube.com/@musclog';
const INSTAGRAM_URL = 'https://instagram.com/musclog.app';

function FeatureGrid() {
  const { t } = useTranslation();

  const features = [
    {
      Icon: Sparkles,
      title: t('website.featureGrid.items.aiCoach.title'),
      description: t('website.featureGrid.items.aiCoach.description'),
    },
    {
      Icon: ScanBarcode,
      title: t('website.featureGrid.items.barcode.title'),
      description: t('website.featureGrid.items.barcode.description'),
    },
    {
      Icon: Calendar,
      title: t('website.featureGrid.items.checkins.title'),
      description: t('website.featureGrid.items.checkins.description'),
    },
    {
      Icon: TrendingUp,
      title: t('website.featureGrid.items.analytics.title'),
      description: t('website.featureGrid.items.analytics.description'),
    },
    {
      Icon: Heart,
      title: t('website.featureGrid.items.cycle.title'),
      description: t('website.featureGrid.items.cycle.description'),
    },
    {
      Icon: Dumbbell,
      title: t('website.featureGrid.items.templates.title'),
      description: t('website.featureGrid.items.templates.description'),
    },
    {
      Icon: Smartphone,
      title: t('website.featureGrid.items.healthConnect.title'),
      description: t('website.featureGrid.items.healthConnect.description'),
    },
    {
      Icon: Lock,
      title: t('website.featureGrid.items.encryption.title'),
      description: t('website.featureGrid.items.encryption.description'),
    },
  ];

  return (
    <View className="overflow-hidden bg-bg-card/50 px-4 py-16 md:py-24">
      <View className="mx-auto w-full max-w-6xl">
        {/* Section header */}
        <View className="mb-12 items-center md:mb-16">
          <Text className="mb-4 text-center font-bold text-text-primary" style={{ fontSize: 32 }}>
            {t('website.featureGrid.title')}
          </Text>
          <Text className="max-w-2xl text-center text-text-secondary">
            {t('website.featureGrid.description')}
          </Text>
        </View>

        {/* Grid */}
        <View className="flex-row flex-wrap gap-6">
          {features.map(({ Icon, title, description }) => (
            <View
              key={title}
              className="rounded-2xl border border-border-default bg-bg-primary p-6"
              style={{ width: '47%', minWidth: 260 }}
            >
              <View className="mb-4 h-12 w-12 items-center justify-center rounded-xl bg-accent-primary/10">
                <Icon size={24} color="#29a577" />
              </View>
              <Text className="mb-2 text-lg font-semibold text-text-primary">{title}</Text>
              <Text className="text-sm leading-relaxed text-text-secondary">{description}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function CTA() {
  const { t } = useTranslation();

  return (
    <View className="px-4 py-16 md:py-24">
      <View className="mx-auto w-full max-w-6xl">
        <LinearGradient
          colors={['#1a7a55', '#0e6b8a', '#0891b2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: 24, overflow: 'hidden' }}
        >
          <View className="items-center px-8 py-16 md:px-16">
            <Text className="mb-4 text-center font-bold text-white" style={{ fontSize: 40 }}>
              {t('website.cta.title')}
            </Text>
            <Text className="mb-8 max-w-lg text-center text-lg text-white/90">
              {t('website.cta.description')}
            </Text>

            <View className="flex-row flex-wrap justify-center gap-4">
              {/* Download button */}
              <Pressable
                className="flex-row items-center gap-2 rounded-xl bg-white px-6 py-3"
                onPress={() => Linking.openURL(GOOGLE_PLAY_URL)}
              >
                <Download size={16} color="#091310" />
                <Text className="font-semibold text-bg-primary">{t('website.cta.download')}</Text>
              </Pressable>

              {/* Source code button */}
              <Pressable
                className="flex-row items-center gap-2 rounded-xl border border-white/30 px-6 py-3"
                onPress={() => Linking.openURL(GITHUB_URL)}
              >
                <Code2 size={16} color="#fff" />
                <Text className="font-semibold text-white">{t('website.cta.sourceCode')}</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

function Features() {
  const { t } = useTranslation();

  const features = [
    {
      Icon: Dumbbell,
      iconColor: '#29a577',
      title: t('website.features.strengthTracking.title'),
      description: t('website.features.strengthTracking.description'),
      linkText: t('website.features.strengthTracking.link'),
      onPress: () => {},
    },
    {
      Icon: Shield,
      iconColor: '#22d3ee',
      title: t('website.features.privacyFirst.title'),
      description: t('website.features.privacyFirst.description'),
      linkText: t('website.features.privacyFirst.link'),
      onPress: () => {},
    },
    {
      Icon: Code2,
      iconColor: '#f472b6',
      title: t('website.features.openSource.title'),
      description: t('website.features.openSource.description'),
      linkText: t('website.features.openSource.link'),
      onPress: () => Linking.openURL(GITHUB_URL),
    },
  ];

  return (
    <View className="overflow-hidden px-4 py-16 md:py-24">
      <View className="mx-auto w-full max-w-6xl">
        {/* Section header */}
        <View className="mb-12 items-center md:mb-16">
          <Text className="mb-4 text-center font-bold text-text-primary" style={{ fontSize: 32 }}>
            {t('website.features.title')}
          </Text>
          <Text className="max-w-xl text-center text-text-secondary">
            {t('website.features.description')}
          </Text>
        </View>

        {/* Feature cards */}
        <View className="flex-col gap-6 md:flex-row">
          {features.map((feature) => (
            <View
              key={feature.title}
              className="flex-1 gap-4 rounded-2xl border border-border-default bg-bg-card p-6"
            >
              <View className="h-10 w-10 items-center justify-center rounded-lg bg-bg-secondary">
                <feature.Icon size={20} color={feature.iconColor} />
              </View>
              <Text className="text-lg font-semibold text-text-primary">{feature.title}</Text>
              <Text className="text-sm leading-relaxed text-text-secondary">
                {feature.description}
              </Text>
              <Pressable className="flex-row items-center gap-1" onPress={feature.onPress}>
                <Text className="text-sm font-medium text-accent-primary">{feature.linkText}</Text>
                <ArrowRight size={14} color="#29a577" />
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function Footer() {
  const { t } = useTranslation();

  const footerLinks = [
    { text: t('website.footer.privacyPolicy'), url: '/privacy', external: false },
    { text: t('website.footer.terms'), url: '/terms', external: false },
    { text: t('website.footer.contact'), url: '/contact', external: false },
    { text: t('website.footer.license'), url: LICENSE_URL, external: true },
    { text: 'GitHub', url: GITHUB_URL, external: true },
  ];

  return (
    <View className="border-t border-border-default px-4 py-8">
      <View className="mx-auto w-full max-w-6xl">
        <View className="flex-col items-center gap-6 md:flex-row md:justify-between">
          {/* Logo */}
          <View className="flex-row items-center gap-2">
            <View className="h-7 w-7 items-center justify-center rounded-lg bg-accent-primary">
              <Dumbbell size={16} color="#fff" />
            </View>
            <Text className="font-semibold text-text-primary">Musclog</Text>
          </View>

          {/* Links */}
          <View className="flex-row flex-wrap justify-center gap-6">
            {footerLinks.map((link) => (
              <Pressable key={link.text} onPress={() => Linking.openURL(link.url)}>
                <Text className="text-sm text-text-secondary">{link.text}</Text>
              </Pressable>
            ))}
          </View>

          {/* Social icons */}
          <View className="flex-row items-center gap-4">
            <Pressable onPress={() => Linking.openURL(YOUTUBE_URL)}>
              <Text className="text-xl text-text-secondary">▶</Text>
            </Pressable>
            <Pressable onPress={() => Linking.openURL(INSTAGRAM_URL)}>
              <Text className="text-xl text-text-secondary">📷</Text>
            </Pressable>
          </View>
        </View>

        {/* Copyright */}
        <View className="mt-8 border-t border-border-default pt-6">
          <Text className="text-center text-sm text-text-secondary">
            {`© ${new Date().getFullYear()} Musclog. ${t('website.footer.copyright')}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

function Header() {
  const { t } = useTranslation();

  return (
    <View
      className="border-b border-border-default bg-bg-primary/90 px-4"
      style={{ position: 'sticky' as any, top: 0, zIndex: 50 }}
    >
      <View className="mx-auto w-full max-w-6xl flex-row items-center justify-between py-3">
        {/* Logo */}
        <View className="flex-row items-center gap-2">
          <View className="h-8 w-8 items-center justify-center rounded-lg bg-accent-primary">
            <Dumbbell size={18} color="#fff" />
          </View>
          <View>
            <Text className="text-base font-semibold text-text-primary">
              {t('website.navigation.appName')}
            </Text>
            <Text className="text-xs text-text-secondary">
              {t('website.navigation.appTagline')}
            </Text>
          </View>
        </View>

        {/* Nav links (desktop) */}
        <View className="hidden flex-row items-center gap-6 md:flex">
          <Pressable onPress={() => Linking.openURL(GITHUB_URL)}>
            <Text className="text-sm text-text-secondary hover:text-text-primary">
              {t('website.navigation.github')}
            </Text>
          </Pressable>
          <Pressable
            className="flex-row items-center gap-1.5 rounded-lg bg-accent-primary px-4 py-2"
            onPress={() => Linking.openURL(GOOGLE_PLAY_URL)}
          >
            <Download size={14} color="#fff" />
            <Text className="text-sm font-semibold text-text-on-colorful">
              {t('website.navigation.download')}
            </Text>
          </Pressable>
        </View>

        {/* Mobile download button */}
        <View className="flex-row items-center gap-2 md:hidden">
          <Pressable
            className="flex-row items-center gap-1.5 rounded-lg bg-accent-primary px-3 py-2"
            onPress={() => Linking.openURL(GOOGLE_PLAY_URL)}
          >
            <Download size={14} color="#fff" />
            <Text className="text-xs font-semibold text-text-on-colorful">
              {t('website.navigation.download')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function StoreButtons() {
  const { t } = useTranslation();

  return (
    <View className="flex-row flex-wrap gap-3">
      {/* Google Play */}
      <Pressable
        className="flex-row items-center gap-3 rounded-xl border-2 border-border-default bg-black px-4 py-2.5"
        onPress={() => Linking.openURL(GOOGLE_PLAY_URL)}
      >
        <View className="h-7 w-7 items-center justify-center">
          {/* Google Play coloured icon */}
          <Text style={{ fontSize: 20 }}>▶</Text>
        </View>
        <View>
          <Text className="text-[11px] leading-none text-text-secondary">
            {t('website.storeButtons.googleTitle')}
          </Text>
          <Text className="text-lg font-bold leading-tight text-text-primary">
            {t('website.storeButtons.googleStore')}
          </Text>
        </View>
      </Pressable>

      {/* App Store (coming soon) */}
      <Pressable
        className="flex-row items-center gap-3 rounded-xl border-2 border-border-default bg-black px-4 py-2.5 opacity-60"
        onPress={() => {}}
      >
        <View className="h-7 w-7 items-center justify-center">
          <Text style={{ fontSize: 20 }}>🍎</Text>
        </View>
        <View>
          <Text className="text-[11px] leading-none text-text-secondary">
            {t('website.storeButtons.appleTitle')}
          </Text>
          <Text className="text-lg font-bold leading-tight text-text-primary">
            {t('website.storeButtons.appleStore')}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

function Hero() {
  const { t } = useTranslation();

  return (
    <View className="overflow-hidden px-4 pb-16 pt-24 md:pb-24 md:pt-32">
      <View className="mx-auto w-full max-w-6xl flex-col items-center gap-12 lg:flex-row lg:gap-16">
        {/* Left content */}
        <View className="flex-1 gap-6">
          {/* Badges */}
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-row items-center gap-1.5 rounded-full border border-accent-primary/20 bg-accent-primary/10 px-3 py-1.5">
              <Text className="text-xs font-medium text-accent-primary">
                {t('website.hero.badge1')}
              </Text>
            </View>
            <View className="flex-row items-center gap-1.5 rounded-full border border-border-default bg-bg-card px-3 py-1.5">
              <Shield size={12} color="#9cb0a8" />
              <Text className="text-xs font-medium text-text-secondary">
                {t('website.hero.badge2')}
              </Text>
            </View>
          </View>

          {/* Heading */}
          <View>
            <Text
              className="font-bold leading-tight text-text-primary"
              style={{ fontSize: 48, lineHeight: 56 }}
            >
              {t('website.hero.title1')}
              {'\n'}
              <Text style={{ color: '#29a577' }}>{t('website.hero.title2')}</Text>
            </Text>
          </View>

          {/* Subheading */}
          <Text className="max-w-md text-lg text-text-secondary">
            {t('website.hero.subheading')}
          </Text>

          {/* Store buttons */}
          <StoreButtons />

          {/* GitHub link */}
          <Pressable
            className="flex-row items-center gap-2"
            onPress={() => Linking.openURL(GITHUB_URL)}
          >
            <Code2 size={16} color="#9cb0a8" />
            <Text className="text-sm text-text-secondary">{t('website.hero.github')}</Text>
          </Pressable>
        </View>

        {/* Right content — phone mockup */}
        <View className="items-center lg:items-end">
          <View
            className="rounded-[2.5rem] border-2 border-accent-primary/30 bg-bg-card p-2"
            style={{ width: 280, shadowColor: '#29a577', shadowOpacity: 0.1, shadowRadius: 40 }}
          >
            <View className="overflow-hidden rounded-[2rem]">
              <Image
                source={{ uri: '/images/app-screenshot.png' }}
                style={{ width: 260, height: 520 }}
                resizeMode="cover"
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function Stats() {
  const { t } = useTranslation();

  const stats = [
    {
      value: t('website.stats.vitamins.value'),
      label: t('website.stats.vitamins.label'),
      description: t('website.stats.vitamins.description'),
    },
    {
      value: t('website.stats.offline.value'),
      label: t('website.stats.offline.label'),
      description: t('website.stats.offline.description'),
    },
    {
      value: t('website.stats.cloud.value'),
      label: t('website.stats.cloud.label'),
      description: t('website.stats.cloud.description'),
    },
    {
      value: t('website.stats.encryption.value'),
      label: t('website.stats.encryption.label'),
      description: t('website.stats.encryption.description'),
    },
  ];

  return (
    <View className="border-y border-border-default px-4 py-16 md:py-20">
      <View className="mx-auto w-full max-w-6xl">
        <View className="flex-row flex-wrap justify-around gap-8">
          {stats.map((stat) => (
            <View key={stat.label} className="min-w-[140px] flex-1 items-center">
              <Text className="mb-2 font-bold text-accent-primary" style={{ fontSize: 48 }}>
                {stat.value}
              </Text>
              <Text className="mb-1 font-medium text-text-primary">{stat.label}</Text>
              <Text className="text-center text-sm text-text-secondary">{stat.description}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function HowItWorks() {
  const { t } = useTranslation();

  const steps = [
    {
      Icon: Download,
      step: '01',
      title: t('website.howItWorks.steps.step1.title'),
      description: t('website.howItWorks.steps.step1.description'),
    },
    {
      Icon: Dumbbell,
      step: '02',
      title: t('website.howItWorks.steps.step2.title'),
      description: t('website.howItWorks.steps.step2.description'),
    },
    {
      Icon: TrendingUp,
      step: '03',
      title: t('website.howItWorks.steps.step3.title'),
      description: t('website.howItWorks.steps.step3.description'),
    },
  ];

  return (
    <View className="overflow-hidden px-4 py-16 md:py-24">
      <View className="mx-auto w-full max-w-6xl">
        {/* Section header */}
        <View className="mb-12 items-center md:mb-16">
          <Text className="mb-4 text-center font-bold text-text-primary" style={{ fontSize: 32 }}>
            {t('website.howItWorks.title')}
          </Text>
          <Text className="max-w-xl text-center text-text-secondary">
            {t('website.howItWorks.description')}
          </Text>
        </View>

        {/* Steps */}
        <View className="flex-col gap-8 md:flex-row md:gap-12">
          {steps.map((item) => (
            <View key={item.step} className="flex-1 items-center">
              <View className="relative mb-6">
                <View className="h-24 w-24 items-center justify-center rounded-full bg-accent-primary/10">
                  <item.Icon size={40} color="#29a577" />
                </View>
                <View className="absolute -right-2 -top-2 h-8 w-8 items-center justify-center rounded-full bg-accent-primary">
                  <Text className="text-sm font-bold text-text-on-colorful">{item.step}</Text>
                </View>
              </View>
              <Text className="mb-3 text-center text-xl font-semibold text-text-primary">
                {item.title}
              </Text>
              <Text className="max-w-xs text-center leading-relaxed text-text-secondary">
                {item.description}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function Testimonial() {
  const { t } = useTranslation();

  return (
    <View className="px-4 py-16 md:py-24">
      <View className="mx-auto w-full max-w-3xl items-center gap-8">
        {/* Quote icon */}
        <View className="h-12 w-12 items-center justify-center rounded-full bg-accent-primary/10">
          <Text style={{ fontSize: 28, color: '#29a577', transform: [{ rotate: '180deg' }] }}>
            {'"'}
          </Text>
        </View>

        {/* Quote text */}
        <Text
          className="text-center font-medium leading-relaxed text-text-primary"
          style={{ fontSize: 24 }}
        >
          {t('website.testimonial.quote')}
        </Text>

        {/* Author */}
        <View className="items-center gap-3">
          <View className="h-14 w-14 overflow-hidden rounded-full border-2 border-accent-primary/30 bg-bg-secondary">
            <Image
              source={{ uri: '/images/user-avatar.jpg' }}
              style={{ width: 56, height: 56 }}
              resizeMode="cover"
            />
          </View>
          <View className="items-center">
            <Text className="font-semibold text-text-primary">
              {t('website.testimonial.author')}
            </Text>
            <Text className="text-sm text-text-secondary">{t('website.testimonial.role')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'web') {
      router.replace('/app');
    }
  }, [router]);

  if (Platform.OS !== 'web') {
    return null;
  }

  return (
    <View className="bg-bg-primary">
      <Header />
      <Hero />
      <Features />
      <FeatureGrid />
      <Stats />
      <HowItWorks />
      <Testimonial />
      <CTA />
      <Footer />
    </View>
  );
}
