import React, { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { ThumbsUp, ArrowRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { theme } from '../theme';
import { BottomPopUpMenu } from './BottomPopUpMenu';

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
  const sliderWidthRef = React.useRef(0);

  const handleSliderPress = (event: any) => {
    const { locationX } = event.nativeEvent;
    if (sliderWidthRef.current > 0) {
      const percentage = Math.max(0, Math.min(100, (locationX / sliderWidthRef.current) * 100));
      const newValue = Math.round(1 + (percentage / 100) * 9);
      onChange(Math.max(1, Math.min(10, newValue)));
    }
  };

  const percentage = ((value - 1) / 9) * 100;

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
      <View className="relative h-6 flex-row items-center">
        <Pressable
          className="h-1 w-full rounded-full"
          style={{ backgroundColor: theme.colors.overlay.white20 }}
          onPress={handleSliderPress}
          onLayout={(event) => {
            sliderWidthRef.current = event.nativeEvent.layout.width;
          }}>
          {/* Filled portion */}
          <View
            className="absolute left-0 top-0 h-full rounded-full"
            style={{
              width: `${percentage}%`,
              backgroundColor: theme.colors.accent.primary,
            }}
          />
          {/* Thumb */}
          <View
            className="absolute top-1/2 h-6 w-6 -translate-y-3 rounded-full border-2"
            style={{
              left: `${percentage}%`,
              marginLeft: -12,
              backgroundColor: theme.colors.background.white,
              borderColor: theme.colors.accent.primary,
              borderWidth: 2,
              shadowColor: theme.shadows.md.shadowColor,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.4,
              shadowRadius: 6,
              elevation: 5,
            }}
          />
        </Pressable>
      </View>

      {/* Labels */}
      <View className="flex-row justify-between">
        <Text className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
          {leftLabel}
        </Text>
        <Text className="text-[10px] font-medium uppercase tracking-wider text-text-secondary">
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

  const footer = (
    <View className="gap-3">
      <Pressable
        className="relative w-full overflow-hidden rounded-xl bg-accent-primary px-6 py-4 active:scale-[0.98]"
        style={{
          shadowColor: theme.colors.accent.primary,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.3,
          shadowRadius: 15,
          elevation: 5,
        }}
        onPress={handleSubmit}>
        <View className="flex-row items-center justify-center gap-2">
          <Text className="text-text-black text-base font-bold uppercase tracking-tight">
            {t('sessionFeedback.submit')}
          </Text>
          <ArrowRight size={theme.iconSize.sm} color={theme.colors.text.black} />
        </View>
      </Pressable>
    </View>
  );

  const headerIcon = (
    <View
      className="h-10 w-10 items-center justify-center rounded-full"
      style={{ backgroundColor: `${theme.colors.accent.primary}1A` }}>
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
      footer={footer}>
      <View className="-mt-2 gap-8">
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
    </BottomPopUpMenu>
  );
}
