import { useState } from 'react';
import { View, Text, Platform, ScrollView } from 'react-native';
import { ThumbsUp, ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../../theme';
import { BottomPopUpMenu } from '../BottomPopUpMenu';
import { Slider } from '../theme/Slider';
import { Button } from '../theme/Button';

type SessionFeedbackModalProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit?: (data: { difficulty: number; exhaustion: number; enjoyment: number }) => void;
};

type RatingSliderProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  leftLabel: string;
  rightLabel: string;
};

function RatingSlider({ label, value, onChange, leftLabel, rightLabel }: RatingSliderProps) {
  // Web-specific styles to allow horizontal gestures on slider area
  const webSliderContainerStyle =
    Platform.OS === 'web'
      ? ({
          // Allow horizontal panning for slider, preventing browser swipe gesture
          touchAction: 'pan-x pan-y',
        } as any)
      : {};

  return (
    <View className="gap-3">
      <View className="flex-row items-end justify-between">
        <Text className="text-sm font-semibold text-text-primary">{label}</Text>
        <View className="flex-row items-baseline">
          <Text className="text-lg font-bold" style={{ color: theme.colors.accent.primary }}>
            {value}
          </Text>
          <Text className="ml-1 text-xs font-normal text-text-secondary">/10</Text>
        </View>
      </View>

      {/* Slider */}
      <View className="mb-2" style={webSliderContainerStyle}>
        <Slider
          value={value}
          min={1}
          max={10}
          onChange={onChange}
          trackColor={theme.colors.overlay.white20}
          thumbColor={theme.colors.background.white}
        />
      </View>

      {/* Labels */}
      <View className="flex-row justify-between">
        <Text
          className="font-medium uppercase tracking-wider text-text-secondary"
          style={{ fontSize: theme.typography.fontSize.xs }}
        >
          {leftLabel}
        </Text>
        <Text
          className="font-medium uppercase tracking-wider text-text-secondary"
          style={{ fontSize: theme.typography.fontSize.xs }}
        >
          {rightLabel}
        </Text>
      </View>
    </View>
  );
}

export function SessionFeedbackModal({ visible, onClose, onSubmit }: SessionFeedbackModalProps) {
  const { t } = useTranslation();
  const [difficulty, setDifficulty] = useState(7);
  const [exhaustion, setExhaustion] = useState(5);
  const [enjoyment, setEnjoyment] = useState(9);

  const handleSubmit = () => {
    onSubmit?.({ difficulty, exhaustion, enjoyment });
    onClose();
  };

  // Web-specific ScrollView styles to prevent browser gestures
  const webScrollViewStyle =
    Platform.OS === 'web'
      ? ({
          // Allow vertical scrolling but prevent horizontal browser gestures
          touchAction: 'pan-y',
        } as any)
      : {};

  const footer = (
    <View className="gap-3">
      <Button
        label={t('sessionFeedback.submit')}
        icon={ArrowRight}
        iconPosition="right"
        variant="accent"
        size="md"
        width="full"
        onPress={handleSubmit}
      />
    </View>
  );

  const headerIcon = (
    <View
      className="h-10 w-10 items-center justify-center rounded-full"
      style={{ backgroundColor: theme.colors.accent.primary10 }}
    >
      <ThumbsUp size={theme.iconSize.md} color={theme.colors.accent.primary} />
    </View>
  );

  return (
    <BottomPopUpMenu
      visible={visible}
      onClose={onClose}
      title={t('sessionFeedback.title')}
      subtitle={t('sessionFeedback.subtitle')}
      headerIcon={headerIcon}
      footer={footer}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={webScrollViewStyle}
        contentContainerStyle={{
          paddingBottom: theme.spacing.padding.xl,
        }}
      >
        <View className="gap-8">
          {/* Rating Sliders */}
          <RatingSlider
            label={t('sessionFeedback.difficulty')}
            value={difficulty}
            onChange={setDifficulty}
            leftLabel={t('sessionFeedback.easy')}
            rightLabel={t('sessionFeedback.extreme')}
          />

          <RatingSlider
            label={t('sessionFeedback.exhaustion')}
            value={exhaustion}
            onChange={setExhaustion}
            leftLabel={t('sessionFeedback.fresh')}
            rightLabel={t('sessionFeedback.drained')}
          />

          <RatingSlider
            label={t('sessionFeedback.enjoyment')}
            value={enjoyment}
            onChange={setEnjoyment}
            leftLabel={t('sessionFeedback.disliked')}
            rightLabel={t('sessionFeedback.loved')}
          />
        </View>
      </ScrollView>
    </BottomPopUpMenu>
  );
}
