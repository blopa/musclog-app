import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';
import { addOpacityToHex } from '@/theme';

import { FullScreenModal } from './FullScreenModal';

const ITEM_HEIGHT = 52;
const VISIBLE_ITEMS = 5;
const PICKER_VIEW_HEIGHT = VISIBLE_ITEMS * ITEM_HEIGHT;
const PADDING_TOP = Math.floor((VISIBLE_ITEMS - 1) / 2) * ITEM_HEIGHT;

type TimePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  selectedTime: Date;
  title: string;
  onTimeSelect: (time: Date) => void;
};

function getOpacityForDistance(distance: number): number {
  if (distance === 0) {
    return 1;
  }
  if (distance === 1) {
    return 0.55;
  }
  if (distance === 2) {
    return 0.3;
  }
  return 0.15;
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
  const hoursScrollRef = useRef<ScrollView>(null);
  const minutesScrollRef = useRef<ScrollView>(null);

  const h24 = selectedTime.getHours();
  const isPm = h24 >= 12;
  const h12 = h24 % 12 || 12;
  const selectedHourIndex = h12 - 1;
  const selectedMinuteIndex = selectedTime.getMinutes();

  const hours = useMemo(
    () => Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(2, '0')),
    []
  );
  const minutes = useMemo(
    () => Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0')),
    []
  );

  const scrollToHour = useCallback((index: number, animated = true) => {
    const y = Math.max(
      0,
      PADDING_TOP + index * ITEM_HEIGHT - (PICKER_VIEW_HEIGHT - ITEM_HEIGHT) / 2
    );
    hoursScrollRef.current?.scrollTo({ y, animated });
  }, []);

  const scrollToMinute = useCallback((index: number, animated = true) => {
    const y = Math.max(
      0,
      PADDING_TOP + index * ITEM_HEIGHT - (PICKER_VIEW_HEIGHT - ITEM_HEIGHT) / 2
    );
    minutesScrollRef.current?.scrollTo({ y, animated });
  }, []);

  const getCenteredIndex = useCallback((contentOffsetY: number) => {
    const centerY = contentOffsetY + PICKER_VIEW_HEIGHT / 2;
    return Math.round((centerY - PADDING_TOP - ITEM_HEIGHT / 2) / ITEM_HEIGHT);
  }, []);

  const handleHoursScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.max(0, Math.min(11, getCenteredIndex(e.nativeEvent.contentOffset.y)));
      const newHour12 = index + 1;
      const newHour24 = (newHour12 % 12) + (isPm ? 12 : 0);
      const newTime = new Date(selectedTime);
      if (newTime.getHours() !== newHour24) {
        newTime.setHours(newHour24);
        onTimeSelect(newTime);
      }
    },
    [selectedTime, onTimeSelect, getCenteredIndex, isPm]
  );

  const handleMinutesScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.max(0, Math.min(59, getCenteredIndex(e.nativeEvent.contentOffset.y)));
      const newTime = new Date(selectedTime);
      if (newTime.getMinutes() !== index) {
        newTime.setMinutes(index);
        onTimeSelect(newTime);
      }
    },
    [selectedTime, onTimeSelect, getCenteredIndex]
  );

  const snapHours = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.max(0, Math.min(11, getCenteredIndex(e.nativeEvent.contentOffset.y)));
      scrollToHour(index, true);
    },
    [getCenteredIndex, scrollToHour]
  );

  const snapMinutes = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.max(0, Math.min(59, getCenteredIndex(e.nativeEvent.contentOffset.y)));
      scrollToMinute(index, true);
    },
    [getCenteredIndex, scrollToMinute]
  );

  useEffect(() => {
    if (visible) {
      const id = setTimeout(() => {
        scrollToHour(selectedHourIndex, false);
        scrollToMinute(selectedMinuteIndex, false);
      }, 100);
      return () => clearTimeout(id);
    }
  }, [visible, selectedHourIndex, selectedMinuteIndex, scrollToHour, scrollToMinute]);

  const handleHourPress = (hour: string) => {
    const index = parseInt(hour, 10) - 1;
    scrollToHour(index, true);
    const newHour12 = index + 1;
    const newHour24 = (newHour12 % 12) + (isPm ? 12 : 0);
    const newTime = new Date(selectedTime);
    newTime.setHours(newHour24);
    onTimeSelect(newTime);
  };

  const handleMinutePress = (minute: string) => {
    const index = parseInt(minute, 10);
    scrollToMinute(index, true);
    const newTime = new Date(selectedTime);
    newTime.setMinutes(index);
    onTimeSelect(newTime);
  };

  const handleAmPmToggle = (pm: boolean) => {
    const newTime = new Date(selectedTime);
    const curH12 = newTime.getHours() % 12 || 12;
    newTime.setHours((curH12 % 12) + (pm ? 12 : 0));
    onTimeSelect(newTime);
  };

  const displayHour = h12.toString().padStart(2, '0');
  const displayMinute = selectedMinuteIndex.toString().padStart(2, '0');
  const amPmLabel = isPm ? 'PM' : 'AM';

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={title}
      scrollable={false}
      showHeader={true}
      footer={
        <View className="items-center gap-3">
          <Button
            label={t('timePicker.confirmTime')}
            variant="gradientCta"
            size="md"
            width="full"
            onPress={() => {
              onTimeSelect(selectedTime);
              onClose();
            }}
          />
          <Pressable onPress={onClose} className="py-2">
            <Text
              className="font-semibold tracking-widest uppercase"
              style={{
                fontSize: theme.typography.fontSize.xxs,
                color: addOpacityToHex(theme.colors.text.white, 0.4),
                letterSpacing: 2,
              }}
            >
              {t('timePicker.clearSelection')}
            </Text>
          </Pressable>
        </View>
      }
    >
      <View className="bg-bg-primary flex-1 flex-col items-center justify-start gap-8 pt-4 pb-8">
        {/* Time display */}
        <View className="items-center gap-2">
          <View className="flex-row items-end">
            <Text
              className="font-bold tracking-tight text-white"
              style={{
                fontSize: theme.typography.fontSize['8xl'],
                textShadowColor: theme.colors.background.black30,
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 8,
                lineHeight: theme.typography.fontSize['8xl'] * 1.05,
              }}
            >
              {displayHour}:{displayMinute}
            </Text>
            <Text
              className="mb-2 ml-2 font-bold"
              style={{
                fontSize: theme.typography.fontSize['2xl'],
                color: theme.colors.accent.primary,
              }}
            >
              {amPmLabel}
            </Text>
          </View>
          <Text
            className="font-semibold uppercase"
            style={{
              fontSize: theme.typography.fontSize.xxs,
              color: addOpacityToHex(theme.colors.text.white, 0.4),
              letterSpacing: 2,
            }}
          >
            {t('timePicker.selectedStartTime')}
          </Text>
        </View>

        {/* Picker card */}
        <View
          className="w-full max-w-sm rounded-3xl px-5 py-5"
          style={{ backgroundColor: theme.colors.background.white5 }}
        >
          {/* Column labels */}
          <View className="mb-3 flex-row justify-around">
            <Text
              className="font-semibold uppercase"
              style={{
                fontSize: theme.typography.fontSize.xxs,
                color: addOpacityToHex(theme.colors.text.white, 0.4),
                letterSpacing: 2,
              }}
            >
              {t('timePicker.hours')}
            </Text>
            <Text
              className="font-semibold uppercase"
              style={{
                fontSize: theme.typography.fontSize.xxs,
                color: addOpacityToHex(theme.colors.text.white, 0.4),
                letterSpacing: 2,
              }}
            >
              {t('timePicker.minutes')}
            </Text>
          </View>

          {/* Scroll pickers */}
          <View className="relative" style={{ height: PICKER_VIEW_HEIGHT }}>
            {/* Selection highlight */}
            <View
              className="absolute right-0 left-0 rounded-xl"
              style={{
                top: PICKER_VIEW_HEIGHT / 2 - ITEM_HEIGHT / 2,
                height: ITEM_HEIGHT,
                backgroundColor: theme.colors.background.white10,
              }}
              pointerEvents="none"
            />

            {/* Scroll columns */}
            <View className="z-10 h-full w-full flex-row items-center justify-around">
              {/* Hours */}
              <ScrollView
                ref={hoursScrollRef}
                style={{ height: PICKER_VIEW_HEIGHT, width: 80 }}
                contentContainerStyle={{
                  paddingTop: PADDING_TOP,
                  paddingBottom: PADDING_TOP,
                }}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={handleHoursScroll}
                onMomentumScrollEnd={snapHours}
                onScrollEndDrag={snapHours}
                nestedScrollEnabled
              >
                {hours.map((hour, i) => {
                  const distance = Math.abs(i - selectedHourIndex);
                  const opacity = getOpacityForDistance(distance);
                  const isSelected = distance === 0;
                  return (
                    <Pressable
                      key={hour}
                      onPress={() => handleHourPress(hour)}
                      className="items-center justify-center"
                      style={{ height: ITEM_HEIGHT }}
                    >
                      <Text
                        style={{
                          color: addOpacityToHex(theme.colors.text.white, opacity),
                          fontSize: isSelected ? 36 : 24,
                          fontWeight: isSelected ? '700' : '400',
                        }}
                      >
                        {hour}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {/* Colon separator — vertically centered at selected row */}
              <View
                className="items-center justify-center"
                style={{ height: ITEM_HEIGHT, width: 20 }}
              >
                <Text
                  style={{
                    color: theme.colors.accent.primary,
                    fontSize: 28,
                    fontWeight: '700',
                  }}
                >
                  :
                </Text>
              </View>

              {/* Minutes */}
              <ScrollView
                ref={minutesScrollRef}
                style={{ height: PICKER_VIEW_HEIGHT, width: 80 }}
                contentContainerStyle={{
                  paddingTop: PADDING_TOP,
                  paddingBottom: PADDING_TOP,
                }}
                showsVerticalScrollIndicator={false}
                scrollEventThrottle={16}
                onScroll={handleMinutesScroll}
                onMomentumScrollEnd={snapMinutes}
                onScrollEndDrag={snapMinutes}
                nestedScrollEnabled
              >
                {minutes.map((minute, i) => {
                  const distance = Math.abs(i - selectedMinuteIndex);
                  const opacity = getOpacityForDistance(distance);
                  const isSelected = distance === 0;
                  return (
                    <Pressable
                      key={minute}
                      onPress={() => handleMinutePress(minute)}
                      className="items-center justify-center"
                      style={{ height: ITEM_HEIGHT }}
                    >
                      <Text
                        style={{
                          color: addOpacityToHex(theme.colors.text.white, opacity),
                          fontSize: isSelected ? 36 : 24,
                          fontWeight: isSelected ? '700' : '400',
                        }}
                      >
                        {minute}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>

          {/* AM / PM toggle */}
          <View
            className="mt-5 flex-row overflow-hidden rounded-full p-1"
            style={{ backgroundColor: theme.colors.background.white10 }}
          >
            <Pressable
              onPress={() => handleAmPmToggle(false)}
              className="flex-1 items-center justify-center rounded-full py-3"
              style={!isPm ? { backgroundColor: theme.colors.accent.primary } : undefined}
            >
              <Text
                style={{
                  color: !isPm
                    ? theme.colors.background.primary
                    : addOpacityToHex(theme.colors.text.white, 0.5),
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: '700',
                }}
              >
                AM
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleAmPmToggle(true)}
              className="flex-1 items-center justify-center rounded-full py-3"
              style={isPm ? { backgroundColor: theme.colors.accent.primary } : undefined}
            >
              <Text
                style={{
                  color: isPm
                    ? theme.colors.background.primary
                    : addOpacityToHex(theme.colors.text.white, 0.5),
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: '700',
                }}
              >
                PM
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </FullScreenModal>
  );
}
