import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { Button } from '../theme/Button';
import { FullScreenModal } from './FullScreenModal';

const ITEM_HEIGHT = 64;
const PICKER_HEIGHT = ITEM_HEIGHT * 3;

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

type ScrollPickerProps = {
  highlightBgColor: string;
  initialIndex: number;
  items: string[];
  onSelect: (index: number) => void;
  textMutedColor: string;
  textPrimaryColor: string;
};

function ScrollPicker({
  items,
  initialIndex,
  onSelect,
  textPrimaryColor,
  textMutedColor,
  highlightBgColor,
}: ScrollPickerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [displayIndex, setDisplayIndex] = useState(initialIndex);

  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: initialIndex * ITEM_HEIGHT, animated: false });
      setDisplayIndex(initialIndex);
    }, 50);
    return () => clearTimeout(timer);
  }, [initialIndex]);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(index, items.length - 1));
      setDisplayIndex(clamped);
      onSelect(clamped);
    },
    [items.length, onSelect]
  );

  return (
    <View style={{ flex: 1, height: PICKER_HEIGHT, overflow: 'hidden', position: 'relative' }}>
      <View
        pointerEvents="none"
        style={{
          backgroundColor: highlightBgColor,
          borderRadius: 12,
          bottom: ITEM_HEIGHT,
          left: 0,
          position: 'absolute',
          right: 0,
          top: ITEM_HEIGHT,
          zIndex: 0,
        }}
      />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT }}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
      >
        {items.map((item, index) => {
          const isSelected = index === displayIndex;
          const distance = Math.abs(index - displayIndex);
          return (
            <Pressable
              key={item}
              onPress={() => {
                scrollRef.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
                setDisplayIndex(index);
                onSelect(index);
              }}
              style={{ alignItems: 'center', height: ITEM_HEIGHT, justifyContent: 'center' }}
            >
              <Text
                style={{
                  color: isSelected ? textPrimaryColor : textMutedColor,
                  fontSize: 30,
                  fontWeight: '600',
                  opacity: distance === 0 ? 1 : distance === 1 ? 0.4 : 0.15,
                }}
              >
                {item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

type TimePickerModalProps = {
  onClose: () => void;
  onTimeSelect: (time: Date) => void;
  selectedTime: Date;
  title: string;
  visible: boolean;
};

function toHour12(d: Date): number {
  return d.getHours() % 12 || 12;
}

function toPeriod(d: Date): 'AM' | 'PM' {
  return d.getHours() >= 12 ? 'PM' : 'AM';
}

export function TimePickerModal({
  visible,
  onClose,
  selectedTime,
  onTimeSelect,
  title,
}: TimePickerModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const [hourIndex, setHourIndex] = useState(() => toHour12(selectedTime) - 1);
  const [minuteIndex, setMinuteIndex] = useState(() => selectedTime.getMinutes());
  const [amPm, setAmPm] = useState<'AM' | 'PM'>(() => toPeriod(selectedTime));
  const [pickerKey, setPickerKey] = useState(0);

  useEffect(() => {
    if (visible) {
      setHourIndex(toHour12(selectedTime) - 1);
      setMinuteIndex(selectedTime.getMinutes());
      setAmPm(toPeriod(selectedTime));
      setPickerKey((k) => k + 1);
    }
  }, [visible, selectedTime]);

  const displayHour = String(hourIndex + 1).padStart(2, '0');
  const displayMinute = String(minuteIndex).padStart(2, '0');

  const buildDate = useCallback(
    (hIdx: number, mIdx: number, period: 'AM' | 'PM'): Date => {
      const h12 = hIdx + 1;
      const h24 = (h12 % 12) + (period === 'PM' ? 12 : 0);
      const d = new Date(selectedTime);
      d.setHours(h24, mIdx, 0, 0);
      return d;
    },
    [selectedTime]
  );

  const handleConfirm = useCallback(() => {
    onTimeSelect(buildDate(hourIndex, minuteIndex, amPm));
    onClose();
  }, [hourIndex, minuteIndex, amPm, buildDate, onTimeSelect, onClose]);

  const accentColor = theme.colors.accent.primary;
  const cardBg = theme.colors.background.card;
  const highlightBg = theme.colors.background.white12;
  const textPrimary = theme.colors.text.primary;
  const textMuted = theme.colors.text.secondary;
  const toggleBg = theme.colors.background.gray800;

  return (
    <FullScreenModal
      footer={
        <View className="w-full items-center gap-4">
          <Button
            label={t('timePicker.confirmTime')}
            onPress={handleConfirm}
            size="md"
            variant="gradientCta"
            width="full"
          />
          <Pressable hitSlop={16} onPress={onClose}>
            <Text
              style={{
                color: textMuted,
                fontSize: 11,
                fontWeight: '600',
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              {t('timePicker.clearSelection')}
            </Text>
          </Pressable>
        </View>
      }
      onClose={onClose}
      scrollable={false}
      showHeader
      title={title}
      visible={visible}
    >
      <View className="flex-1 items-center bg-bg-primary px-5 pt-8">
        {/* Time display */}
        <View className="mb-8 items-center">
          <View className="flex-row items-end">
            <Text
              style={{
                color: textPrimary,
                fontSize: 80,
                fontWeight: '300',
                letterSpacing: -2,
                lineHeight: 88,
              }}
            >
              {displayHour}:{displayMinute}
            </Text>
            <Text
              style={{
                color: accentColor,
                fontSize: 26,
                fontWeight: '700',
                lineHeight: 36,
                marginBottom: 10,
                marginLeft: 6,
              }}
            >
              {amPm}
            </Text>
          </View>
          <Text
            style={{
              color: textMuted,
              fontSize: 10,
              fontWeight: '600',
              letterSpacing: 2.5,
              marginTop: 4,
              textTransform: 'uppercase',
            }}
          >
            {t('timePicker.selectedStartTime')}
          </Text>
        </View>

        {/* Picker card */}
        <View
          className="w-full"
          style={{ backgroundColor: cardBg, borderRadius: 24, overflow: 'hidden' }}
        >
          {/* Column labels */}
          <View className="flex-row px-6 pb-1 pt-5">
            <Text
              className="flex-1 text-center"
              style={{
                color: textMuted,
                fontSize: 10,
                fontWeight: '600',
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              {t('timePicker.hours')}
            </Text>
            <View style={{ width: 36 }} />
            <Text
              className="flex-1 text-center"
              style={{
                color: textMuted,
                fontSize: 10,
                fontWeight: '600',
                letterSpacing: 2,
                textTransform: 'uppercase',
              }}
            >
              {t('timePicker.minutes')}
            </Text>
          </View>

          {/* Scroll pickers + colon */}
          <View className="flex-row items-center px-4 pb-2">
            <ScrollPicker
              key={`hours-${pickerKey}`}
              highlightBgColor={highlightBg}
              initialIndex={hourIndex}
              items={HOURS}
              onSelect={setHourIndex}
              textMutedColor={textMuted}
              textPrimaryColor={textPrimary}
            />
            <Text
              style={{
                color: accentColor,
                fontSize: 30,
                fontWeight: '700',
                textAlign: 'center',
                width: 36,
              }}
            >
              :
            </Text>
            <ScrollPicker
              key={`minutes-${pickerKey}`}
              highlightBgColor={highlightBg}
              initialIndex={minuteIndex}
              items={MINUTES}
              onSelect={setMinuteIndex}
              textMutedColor={textMuted}
              textPrimaryColor={textPrimary}
            />
          </View>

          {/* AM / PM toggle */}
          <View
            className="mx-4 mb-5 flex-row overflow-hidden"
            style={{ backgroundColor: toggleBg, borderRadius: 9999 }}
          >
            {(['AM', 'PM'] as const).map((period) => {
              const isActive = amPm === period;
              const periodLabel = period === 'AM' ? t('timePicker.am') : t('timePicker.pm');
              return (
                <Pressable key={period} onPress={() => setAmPm(period)} style={{ flex: 1 }}>
                  {isActive ? (
                    <LinearGradient
                      colors={[theme.colors.accent.secondary, theme.colors.accent.tertiary]}
                      end={{ x: 1, y: 0 }}
                      start={{ x: 0, y: 0 }}
                      style={{
                        alignItems: 'center',
                        borderRadius: 9999,
                        height: 44,
                        justifyContent: 'center',
                      }}
                    >
                      <Text
                        style={{
                          color: theme.colors.text.onColorful,
                          fontSize: 15,
                          fontWeight: '700',
                        }}
                      >
                        {periodLabel}
                      </Text>
                    </LinearGradient>
                  ) : (
                    <View style={{ alignItems: 'center', height: 44, justifyContent: 'center' }}>
                      <Text style={{ color: textMuted, fontSize: 15, fontWeight: '600' }}>
                        {periodLabel}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </FullScreenModal>
  );
}
