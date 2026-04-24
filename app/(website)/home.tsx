import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Calendar,
  Camera,
  Code2,
  Download,
  Dumbbell,
  Heart,
  Lock,
  Play,
  Quote,
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

function webStyle<T extends object>(style: T): T | undefined {
  return Platform.OS === 'web' ? style : undefined;
}

function openUrl(url: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (url.startsWith('#')) {
      const id = url.slice(1);
      const element = document.getElementById(id);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (url.startsWith('/')) {
      window.location.assign(url);
      return;
    }
  }

  void Linking.openURL(url);
}

function GridPattern({
  opacity = 0.16,
  size = 40,
  color = '33, 191, 115',
}: {
  opacity?: number;
  size?: number;
  color?: string;
}) {
  return (
    <View
      pointerEvents="none"
      className="absolute inset-0"
      style={webStyle({
        backgroundImage: `
          linear-gradient(rgba(${color}, ${opacity}) 1px, transparent 1px),
          linear-gradient(90deg, rgba(${color}, ${opacity}) 1px, transparent 1px)
        `,
        backgroundSize: `${size}px ${size}px`,
      } as any)}
    />
  );
}

function DotPattern({
  opacity = 0.35,
  size = 20,
  color = '21, 162, 112',
}: {
  opacity?: number;
  size?: number;
  color?: string;
}) {
  return (
    <View
      pointerEvents="none"
      className="absolute inset-0"
      style={webStyle({
        backgroundImage: `radial-gradient(circle, rgba(${color}, ${opacity}) 1.1px, transparent 1.2px)`,
        backgroundSize: `${size}px ${size}px`,
      } as any)}
    />
  );
}

function GlowOrb({ className, color }: { className?: string; color: string }) {
  return (
    <View
      pointerEvents="none"
      className={className}
      style={webStyle({
        background: `radial-gradient(circle, ${color} 0%, rgba(0,0,0,0) 72%)`,
        filter: 'blur(22px)',
      } as any)}
    />
  );
}

function HeroBackground() {
  return (
    <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
      <GridPattern opacity={0.1} size={48} color="29, 166, 117" />
      <View
        className="absolute inset-0"
        style={webStyle({
          background:
            'linear-gradient(180deg, rgba(8,18,15,0.92) 0%, rgba(6,17,14,0.84) 42%, rgba(6,17,14,0.97) 100%)',
        } as any)}
      />
      <View
        className="absolute inset-0"
        style={webStyle({
          background:
            'linear-gradient(90deg, rgba(6,17,14,1) 0%, rgba(6,17,14,0.78) 35%, rgba(6,17,14,0.42) 68%, rgba(6,17,14,0.88) 100%)',
        } as any)}
      />

      <GlowOrb
        className="absolute -left-24 top-52 h-72 w-72 rounded-full"
        color="rgba(20, 179, 119, 0.18)"
      />
      <GlowOrb
        className="absolute right-16 top-20 h-80 w-80 rounded-full"
        color="rgba(16, 185, 129, 0.14)"
      />
      <GlowOrb
        className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full"
        color="rgba(6, 182, 212, 0.08)"
      />

      <View className="absolute -left-12 top-80 h-44 w-44 rounded-[2rem] border border-accent-primary/10" />
      <View className="absolute right-8 top-8 h-48 w-48 rounded-full border border-accent-primary/10" />
      <View
        className="absolute bottom-14 right-[22%] h-64 w-64"
        style={webStyle({
          borderLeftWidth: 1,
          borderTopWidth: 1,
          borderColor: 'rgba(21, 162, 112, 0.1)',
          transform: 'rotate(45deg)',
        } as any)}
      />
    </View>
  );
}

function SectionBackground({ variant = 'dots' }: { variant?: 'dots' | 'grid' | 'minimal' }) {
  return (
    <View pointerEvents="none" className="absolute inset-0 overflow-hidden">
      {variant === 'dots' ? <DotPattern /> : null}
      {variant === 'grid' ? <GridPattern opacity={0.08} size={36} color="29, 166, 117" /> : null}
      <View
        className="absolute inset-0"
        style={webStyle({
          background:
            'linear-gradient(180deg, rgba(6,17,14,0.18) 0%, rgba(6,17,14,0) 20%, rgba(6,17,14,0) 78%, rgba(6,17,14,0.26) 100%)',
        } as any)}
      />
    </View>
  );
}

function SectionHeading({ title, description }: { title: string; description: string }) {
  return (
    <View className="mb-12 items-center md:mb-16">
      <Text className="mb-4 max-w-3xl text-center text-4xl font-bold leading-tight text-text-primary">
        {title}
      </Text>
      <Text className="max-w-2xl text-center text-base leading-7 text-text-secondary">
        {description}
      </Text>
    </View>
  );
}

function Header() {
  const { t } = useTranslation();

  return (
    <View
      className="px-4"
      style={[
        { position: 'sticky' as any, top: 0, zIndex: 50 },
        webStyle({
          backdropFilter: 'blur(16px)',
          backgroundColor: 'rgba(6, 15, 13, 0.82)',
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(90, 118, 107, 0.18)',
        } as any),
      ]}
    >
      <View className="mx-auto w-full max-w-7xl flex-row items-center justify-between py-3">
        <View className="flex-row items-center gap-3">
          <View className="h-9 w-9 items-center justify-center rounded-xl bg-accent-primary">
            <Dumbbell size={18} color="#04110d" />
          </View>
          <View>
            <Text className="text-lg font-semibold text-text-primary">
              {t('website.navigation.appName')}
            </Text>
            <Text className="text-xs text-text-secondary">
              {t('website.navigation.appTagline')}
            </Text>
          </View>
        </View>

        <View className="hidden flex-row items-center gap-7 md:flex">
          <Pressable onPress={() => openUrl('#features')}>
            <Text className="text-sm text-text-secondary">{t('website.navigation.features')}</Text>
          </Pressable>
          <Pressable onPress={() => openUrl(GITHUB_URL)}>
            <Text className="text-sm text-text-secondary">{t('website.navigation.github')}</Text>
          </Pressable>
          <Pressable
            className="flex-row items-center gap-2 rounded-xl bg-accent-primary px-5 py-3"
            style={webStyle({
              boxShadow: '0 12px 28px rgba(20, 179, 119, 0.22)',
            } as any)}
            onPress={() => openUrl(GOOGLE_PLAY_URL)}
          >
            <Download size={14} color="#03120d" />
            <Text className="text-sm font-semibold text-bg-primary">
              {t('website.navigation.download')}
            </Text>
          </Pressable>
        </View>

        <View className="flex-row items-center gap-2 md:hidden">
          <Pressable
            className="flex-row items-center gap-1.5 rounded-xl bg-accent-primary px-3 py-2.5"
            onPress={() => openUrl(GOOGLE_PLAY_URL)}
          >
            <Download size={14} color="#03120d" />
            <Text className="text-xs font-semibold text-bg-primary">
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
      <Pressable
        className="flex-row items-center gap-3 rounded-2xl border border-white/15 bg-black/90 px-5 py-3.5"
        style={webStyle({
          boxShadow: '0 18px 32px rgba(0, 0, 0, 0.18)',
        } as any)}
        onPress={() => openUrl(GOOGLE_PLAY_URL)}
      >
        <Text style={{ fontSize: 22 }}>▶</Text>
        <View>
          <Text className="text-[10px] font-medium tracking-[0.8px] text-text-secondary">
            {t('website.storeButtons.googleTitle')}
          </Text>
          <Text className="text-[30px] font-bold leading-8 text-white md:text-lg">
            {t('website.storeButtons.googleStore')}
          </Text>
        </View>
      </Pressable>

      <Pressable className="flex-row items-center gap-3 rounded-2xl border border-white/15 bg-black/70 px-5 py-3.5 opacity-70">
        <Text style={{ fontSize: 22 }}>🍎</Text>
        <View>
          <Text className="text-[10px] font-medium tracking-[0.8px] text-text-secondary">
            {t('website.storeButtons.appleTitle')}
          </Text>
          <Text className="text-[30px] font-bold leading-8 text-white md:text-lg">
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
    <View className="relative overflow-hidden px-4 pb-24 pt-24 md:pb-28 md:pt-28">
      <HeroBackground />

      <View className="mx-auto w-full max-w-7xl flex-col items-center gap-16 lg:flex-row lg:items-start lg:justify-between">
        <View className="z-10 w-full max-w-xl gap-7">
          <View className="flex-row flex-wrap gap-3">
            <View className="flex-row items-center gap-2 rounded-full border border-accent-primary/20 bg-accent-primary/10 px-4 py-2">
              <Text className="text-xs font-medium tracking-wide text-accent-primary">
                {t('website.hero.badge1')}
              </Text>
            </View>
            <View className="flex-row items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2">
              <Shield size={13} color="#93a59f" />
              <Text className="text-xs font-medium tracking-wide text-text-secondary">
                {t('website.hero.badge2')}
              </Text>
            </View>
          </View>

          <Text
            className="text-text-primary"
            style={{ fontSize: 62, lineHeight: 68, fontWeight: '800', letterSpacing: -1.4 }}
          >
            {t('website.hero.title1')}
            {'\n'}
            <Text style={{ color: '#19d08c' }}>{t('website.hero.title2')}</Text>
          </Text>

          <Text className="max-w-lg text-xl leading-10 text-text-secondary md:text-lg md:leading-8">
            {t('website.hero.subheading')}
          </Text>

          <StoreButtons />

          <Pressable
            className="flex-row items-center gap-2 self-start"
            onPress={() => openUrl(GITHUB_URL)}
          >
            <Code2 size={16} color="#95a5a0" />
            <Text className="text-base text-text-secondary md:text-sm">
              {t('website.hero.github')}
            </Text>
          </Pressable>
        </View>

        <View className="z-10 w-full items-center lg:max-w-xl lg:items-end">
          <View className="relative">
            <GlowOrb
              className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
              color="rgba(25, 208, 140, 0.18)"
            />
            <View
              className="rounded-[2.75rem] border border-accent-primary/25 bg-[#071a14]/90 p-2"
              style={[
                { width: 320 },
                webStyle({
                  boxShadow:
                    '0 24px 80px rgba(5, 17, 13, 0.75), 0 0 0 1px rgba(28, 170, 121, 0.12)',
                } as any),
              ]}
            >
              <View className="rounded-[2.25rem] border border-accent-primary/30 bg-[#08231b] p-3">
                <View className="overflow-hidden rounded-[1.9rem] border border-white/5 bg-[#09241c]">
                  <Image
                    source={{ uri: '/images/app-screenshot.png' }}
                    style={{ width: 296, height: 592 }}
                    resizeMode="cover"
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function Features() {
  const { t } = useTranslation();

  const features = [
    {
      Icon: Dumbbell,
      iconColor: '#20d489',
      title: t('website.features.strengthTracking.title'),
      description: t('website.features.strengthTracking.description'),
      linkText: t('website.features.strengthTracking.link'),
      url: '#feature-grid',
    },
    {
      Icon: Shield,
      iconColor: '#32c8ff',
      title: t('website.features.privacyFirst.title'),
      description: t('website.features.privacyFirst.description'),
      linkText: t('website.features.privacyFirst.link'),
      url: '/privacy',
    },
    {
      Icon: Code2,
      iconColor: '#ff6ec7',
      title: t('website.features.openSource.title'),
      description: t('website.features.openSource.description'),
      linkText: t('website.features.openSource.link'),
      url: GITHUB_URL,
    },
  ];

  return (
    <View nativeID="features" className="relative overflow-hidden px-4 py-20 md:py-28">
      <SectionBackground variant="dots" />

      <View className="mx-auto w-full max-w-7xl">
        <SectionHeading
          title={t('website.features.title')}
          description={t('website.features.description')}
        />

        <View className="flex-col gap-6 md:flex-row">
          {features.map((feature) => (
            <View
              key={feature.title}
              className="border-white/8 flex-1 rounded-[2rem] border bg-white/[0.02] p-7"
              style={webStyle({
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
              } as any)}
            >
              <View className="mb-5 h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
                <feature.Icon size={22} color={feature.iconColor} />
              </View>

              <Text className="mb-3 text-[30px] font-semibold leading-8 text-text-primary md:text-lg">
                {feature.title}
              </Text>
              <Text className="mb-6 text-base leading-8 text-text-secondary md:text-sm md:leading-7">
                {feature.description}
              </Text>

              <Pressable
                className="flex-row items-center gap-2 self-start"
                onPress={() => openUrl(feature.url)}
              >
                <Text className="text-sm font-medium tracking-[0.4px] text-accent-primary">
                  {feature.linkText}
                </Text>
                <ArrowRight size={14} color="#20d489" />
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

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
    <View
      nativeID="feature-grid"
      className="relative overflow-hidden bg-white/[0.02] px-4 py-20 md:py-28"
    >
      <SectionBackground variant="grid" />

      <View className="mx-auto w-full max-w-7xl">
        <SectionHeading
          title={t('website.featureGrid.title')}
          description={t('website.featureGrid.description')}
        />

        <View className="flex-row flex-wrap gap-6">
          {features.map(({ Icon, title, description }) => (
            <View
              key={title}
              className="border-white/8 rounded-[1.75rem] border bg-[#091712]/90 p-6"
              style={[
                { width: '100%' },
                webStyle({
                  width: 'calc(25% - 18px)',
                  minWidth: '240px',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
                } as any),
              ]}
            >
              <View className="mb-5 h-12 w-12 items-center justify-center rounded-2xl bg-accent-primary/10">
                <Icon size={22} color="#1cd28d" />
              </View>
              <Text className="mb-2 text-lg font-semibold text-text-primary">{title}</Text>
              <Text className="text-sm leading-7 text-text-secondary">{description}</Text>
            </View>
          ))}
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
    <View className="border-white/8 relative overflow-hidden border-y px-4 py-16 md:py-20">
      <SectionBackground variant="minimal" />

      <View className="mx-auto w-full max-w-7xl">
        <View className="flex-row flex-wrap justify-center gap-8 md:justify-between">
          {stats.map((stat) => (
            <View
              key={stat.label}
              className="min-w-[160px] flex-1 items-center px-3"
              style={webStyle({ maxWidth: '25%' } as any)}
            >
              <Text className="mb-2 text-5xl font-bold text-accent-primary">{stat.value}</Text>
              <Text className="mb-1 text-center text-base font-medium text-text-primary">
                {stat.label}
              </Text>
              <Text className="text-center text-sm leading-6 text-text-secondary">
                {stat.description}
              </Text>
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
    <View className="relative overflow-hidden px-4 py-20 md:py-28">
      <SectionBackground variant="grid" />

      <View className="mx-auto w-full max-w-7xl">
        <SectionHeading
          title={t('website.howItWorks.title')}
          description={t('website.howItWorks.description')}
        />

        <View className="flex-col gap-8 md:flex-row md:gap-10">
          {steps.map((item, index) => (
            <View key={item.step} className="relative flex-1 items-center">
              {index < steps.length - 1 ? (
                <View
                  pointerEvents="none"
                  className="absolute top-12 hidden h-px bg-white/10 md:block"
                  style={webStyle({ left: '62%', width: '76%' } as any)}
                />
              ) : null}

              <View className="relative mb-6 h-24 w-24 items-center justify-center rounded-full bg-accent-primary/10">
                <item.Icon size={36} color="#1cd28d" />
                <View className="absolute -right-1 -top-1 h-8 w-8 items-center justify-center rounded-full bg-accent-primary">
                  <Text className="text-sm font-bold text-bg-primary">{item.step}</Text>
                </View>
              </View>

              <Text className="mb-3 text-center text-xl font-semibold text-text-primary">
                {item.title}
              </Text>
              <Text className="max-w-xs text-center text-sm leading-7 text-text-secondary">
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
    <View className="relative overflow-hidden px-4 py-20 md:py-28">
      <SectionBackground variant="dots" />

      <View className="mx-auto w-full max-w-4xl items-center">
        <View className="mb-8 h-14 w-14 items-center justify-center rounded-full bg-accent-primary/10">
          <Quote size={28} color="#1cd28d" style={{ transform: [{ rotate: '180deg' }] }} />
        </View>

        <Text
          className="mb-8 text-center text-text-primary"
          style={{ fontSize: 34, lineHeight: 48, fontWeight: '500' }}
        >
          {t('website.testimonial.quote')}
        </Text>

        <View className="items-center gap-3">
          <View className="h-16 w-16 overflow-hidden rounded-full border-2 border-accent-primary/25 bg-white/5">
            <Image source={{ uri: '/images/user-avatar.jpg' }} style={{ width: 64, height: 64 }} />
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

function CTA() {
  const { t } = useTranslation();

  return (
    <View className="px-4 py-20 md:py-24">
      <View className="mx-auto w-full max-w-7xl">
        <LinearGradient
          colors={['#0f8a61', '#0f7a72', '#0a92b7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            { borderRadius: 30, overflow: 'hidden' },
            webStyle({
              boxShadow: '0 30px 80px rgba(10, 146, 183, 0.16)',
            } as any),
          ]}
        >
          <View
            className="absolute inset-0"
            pointerEvents="none"
            style={webStyle({
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 48%, rgba(4,13,10,0.16) 100%)',
            } as any)}
          />

          <View className="items-center px-8 py-16 md:px-16 md:py-20">
            <Text className="mb-4 max-w-3xl text-center text-5xl font-bold leading-tight text-white md:text-4xl">
              {t('website.cta.title')}
            </Text>
            <Text className="mb-8 max-w-2xl text-center text-lg leading-8 text-white/90">
              {t('website.cta.description')}
            </Text>

            <View className="flex-row flex-wrap justify-center gap-4">
              <Pressable
                className="flex-row items-center gap-2 rounded-2xl bg-white px-6 py-3.5"
                onPress={() => openUrl(GOOGLE_PLAY_URL)}
              >
                <Download size={16} color="#04120d" />
                <Text className="font-semibold text-bg-primary">{t('website.cta.download')}</Text>
              </Pressable>

              <Pressable
                className="flex-row items-center gap-2 rounded-2xl border border-white/30 px-6 py-3.5"
                onPress={() => openUrl(GITHUB_URL)}
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

function Footer() {
  const { t } = useTranslation();

  const footerLinks = [
    { text: t('website.footer.privacyPolicy'), url: '/privacy' },
    { text: t('website.footer.terms'), url: '/terms' },
    { text: t('website.footer.contact'), url: '/contact' },
    { text: t('website.footer.license'), url: LICENSE_URL },
    { text: 'GitHub', url: GITHUB_URL },
  ];

  return (
    <View className="border-white/8 border-t px-4 py-10">
      <View className="mx-auto w-full max-w-7xl">
        <View className="flex-col items-center gap-7 md:flex-row md:justify-between">
          <View className="flex-row items-center gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-xl bg-accent-primary">
              <Dumbbell size={18} color="#04110d" />
            </View>
            <Text className="text-base font-semibold text-text-primary">Musclog</Text>
          </View>

          <View className="flex-row flex-wrap justify-center gap-6">
            {footerLinks.map((link) => (
              <Pressable key={link.text} onPress={() => openUrl(link.url)}>
                <Text className="text-sm text-text-secondary">{link.text}</Text>
              </Pressable>
            ))}
          </View>

          <View className="flex-row items-center gap-4">
            <Pressable onPress={() => openUrl(YOUTUBE_URL)}>
              <Play size={18} color="#8ea39a" />
            </Pressable>
            <Pressable onPress={() => openUrl(INSTAGRAM_URL)}>
              <Camera size={18} color="#8ea39a" />
            </Pressable>
          </View>
        </View>

        <View className="border-white/8 mt-8 border-t pt-6">
          <Text className="text-center text-sm text-text-secondary">
            {`© ${new Date().getFullYear()} Musclog. ${t('website.footer.copyright')}`}
          </Text>
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
