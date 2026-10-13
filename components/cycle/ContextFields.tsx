import {
  Activity,
  Baby,
  CheckCircle2,
  CircleSlash,
  HelpCircle,
  type LucideIcon,
  Pill,
  ShieldOff,
  Syringe,
  Zap,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { BottomPopUpMenu, type BottomPopUpMenuItem } from '@/components/BottomPopUpMenu';
import { PickerButton } from '@/components/theme/PickerButton';
import { useTheme } from '@/hooks/useTheme';
import type { ContraceptionMethod, CycleLifeStage } from '@/utils/cycle/types';

type ContextFieldsProps = {
  lifeStage: CycleLifeStage;
  contraception: ContraceptionMethod;
  onLifeStageChange: (value: CycleLifeStage) => void;
  onContraceptionChange: (value: ContraceptionMethod) => void;
};

// One translation-key pair per value, as whole keys (a `t(`...${x}`)` here is invisible to
// `npm run check-translations`).
const CONTRACEPTION: Record<
  ContraceptionMethod,
  { title: string; description: string; icon: LucideIcon }
> = {
  none: {
    title: 'onboarding.cycleSetup.birthControl.none',
    description: 'onboarding.cycleSetup.birthControl.noneDescription',
    icon: CheckCircle2,
  },
  combined_pill: {
    title: 'onboarding.cycleSetup.birthControl.combinedPill',
    description: 'onboarding.cycleSetup.birthControl.combinedPillDescription',
    icon: Pill,
  },
  progestin_pill: {
    title: 'onboarding.cycleSetup.birthControl.progestinPill',
    description: 'onboarding.cycleSetup.birthControl.progestinPillDescription',
    icon: Pill,
  },
  pill_unspecified: {
    title: 'onboarding.cycleSetup.birthControl.pill',
    description: 'onboarding.cycleSetup.birthControl.pillDescription',
    icon: Pill,
  },
  hormonal_iud: {
    title: 'onboarding.cycleSetup.birthControl.hormonalIud',
    description: 'onboarding.cycleSetup.birthControl.hormonalIudDescription',
    icon: ShieldOff,
  },
  copper_iud: {
    title: 'onboarding.cycleSetup.birthControl.copperIud',
    description: 'onboarding.cycleSetup.birthControl.copperIudDescription',
    icon: ShieldOff,
  },
  iud_unspecified: {
    title: 'onboarding.cycleSetup.birthControl.iud',
    description: 'onboarding.cycleSetup.birthControl.iudDescription',
    icon: ShieldOff,
  },
  implant: {
    title: 'onboarding.cycleSetup.birthControl.implant',
    description: 'onboarding.cycleSetup.birthControl.implantDescription',
    icon: Syringe,
  },
  patch: {
    title: 'onboarding.cycleSetup.birthControl.patch',
    description: 'onboarding.cycleSetup.birthControl.patchDescription',
    icon: Pill,
  },
  ring: {
    title: 'onboarding.cycleSetup.birthControl.ring',
    description: 'onboarding.cycleSetup.birthControl.ringDescription',
    icon: Pill,
  },
  injection: {
    title: 'onboarding.cycleSetup.birthControl.shot',
    description: 'onboarding.cycleSetup.birthControl.shotDescription',
    icon: Syringe,
  },
  other: {
    title: 'onboarding.cycleSetup.birthControl.other',
    description: 'onboarding.cycleSetup.birthControl.otherDescription',
    icon: HelpCircle,
  },
};

const LIFE_STAGE: Record<CycleLifeStage, { title: string; description: string; icon: LucideIcon }> =
  {
    regular: {
      title: 'onboarding.cycleSetup.lifeStage.regular',
      description: 'onboarding.cycleSetup.lifeStage.regularDescription',
      icon: CheckCircle2,
    },
    pcos: {
      title: 'onboarding.cycleSetup.lifeStage.pcos',
      description: 'onboarding.cycleSetup.lifeStage.pcosDescription',
      icon: Activity,
    },
    perimenopause: {
      title: 'onboarding.cycleSetup.lifeStage.perimenopause',
      description: 'onboarding.cycleSetup.lifeStage.perimenopauseDescription',
      icon: Zap,
    },
    postpartum: {
      title: 'onboarding.cycleSetup.lifeStage.postpartum',
      description: 'onboarding.cycleSetup.lifeStage.postpartumDescription',
      icon: Baby,
    },
    post_pill: {
      title: 'onboarding.cycleSetup.lifeStage.postPill',
      description: 'onboarding.cycleSetup.lifeStage.postPillDescription',
      icon: Pill,
    },
    no_bleeding: {
      title: 'onboarding.cycleSetup.lifeStage.noBleeding',
      description: 'onboarding.cycleSetup.lifeStage.noBleedingDescription',
      icon: CircleSlash,
    },
  };

export const contraceptionTitleKey = (method: ContraceptionMethod) => CONTRACEPTION[method].title;
export const lifeStageTitleKey = (stage: CycleLifeStage) => LIFE_STAGE[stage].title;

const LIFE_STAGE_ORDER: CycleLifeStage[] = [
  'regular',
  'pcos',
  'perimenopause',
  'postpartum',
  'post_pill',
  'no_bleeding',
];
const CONTRACEPTION_ORDER: ContraceptionMethod[] = [
  'none',
  'combined_pill',
  'progestin_pill',
  'hormonal_iud',
  'copper_iud',
  'implant',
  'patch',
  'ring',
  'injection',
  'other',
];

/**
 * Life stage and contraception. These decide which predictions exist (see `contextGuidance`),
 * not just which warning is shown. A value saved before the app could tell them apart (an
 * unspecified pill or IUD) stays selectable while it is the current one, so it never disappears
 * from the picker.
 */
export function ContextFields({
  lifeStage,
  contraception,
  onLifeStageChange,
  onContraceptionChange,
}: ContextFieldsProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [stageOpen, setStageOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);

  const methods: ContraceptionMethod[] = CONTRACEPTION_ORDER.includes(contraception)
    ? CONTRACEPTION_ORDER
    : [contraception, ...CONTRACEPTION_ORDER];

  const stageColors = (stage: CycleLifeStage) =>
    stage === 'regular'
      ? { color: theme.colors.status.success, bg: theme.colors.status.success20 }
      : { color: theme.colors.accent.primary, bg: theme.colors.accent.primary10 };

  const stageItems: BottomPopUpMenuItem[] = LIFE_STAGE_ORDER.map((stage) => ({
    title: t(LIFE_STAGE[stage].title),
    description: t(LIFE_STAGE[stage].description),
    icon: LIFE_STAGE[stage].icon,
    iconColor: stageColors(stage).color,
    iconBgColor: stageColors(stage).bg,
    onPress: () => {
      onLifeStageChange(stage);
      setStageOpen(false);
    },
  }));
  const methodItems: BottomPopUpMenuItem[] = methods.map((method) => ({
    title: t(CONTRACEPTION[method].title),
    description: t(CONTRACEPTION[method].description),
    icon: CONTRACEPTION[method].icon,
    iconColor: theme.colors.accent.primary,
    iconBgColor: theme.colors.accent.primary10,
    onPress: () => {
      onContraceptionChange(method);
      setMethodOpen(false);
    },
  }));

  const StageIcon = LIFE_STAGE[lifeStage].icon;
  const MethodIcon = CONTRACEPTION[contraception].icon;

  return (
    <>
      <View className="gap-6">
        <View>
          <Text className="mb-3 text-base font-semibold text-text-secondary">
            {t('onboarding.cycleSetup.lifeStage.title')}
          </Text>
          <PickerButton
            label={t(LIFE_STAGE[lifeStage].title)}
            icon={<StageIcon size={theme.iconSize.lg} color={stageColors(lifeStage).color} />}
            onPress={() => setStageOpen(true)}
          />
        </View>
        <View>
          <Text className="mb-3 text-base font-semibold text-text-secondary">
            {t('onboarding.cycleSetup.birthControl.title')}
          </Text>
          <PickerButton
            label={t(CONTRACEPTION[contraception].title)}
            icon={<MethodIcon size={theme.iconSize.lg} color={theme.colors.accent.primary} />}
            onPress={() => setMethodOpen(true)}
          />
        </View>
      </View>

      <BottomPopUpMenu
        visible={stageOpen}
        onClose={() => setStageOpen(false)}
        title={t('onboarding.cycleSetup.lifeStage.title')}
        items={stageItems}
      />
      <BottomPopUpMenu
        visible={methodOpen}
        onClose={() => setMethodOpen(false)}
        title={t('onboarding.cycleSetup.birthControl.title')}
        items={methodItems}
      />
    </>
  );
}
