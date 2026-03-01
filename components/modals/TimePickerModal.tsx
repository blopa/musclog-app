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

import { useTheme } from '../../hooks/useTheme';
import { Button } from '../theme/Button';
import { FullScreenModal } from './FullScreenModal';

const ITEM_HEIGHT = 52;
const VISIBLE_ITEMS = 7;
const PICKER_VIEW_HEIGHT = VISIBLE_ITEMS * ITEM_HEIGHT;
const PADDING_TOP = Math.floor((VISIBLE_ITEMS - 1) / 2) * ITEM_HEIGHT;

type TimePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  selectedTime: Date;
  onTimeSelect: (time: Date) => void;
};

function getOpacityForDistance(distance: number): number {
  if (distance === 0) {
    return 1;
  }
  if (distance === 1) {
    return 0.6;
  }
  if (distance === 2) {
    return 0.4;
  }
  return 0.2;
}

export function TimePickerModal({
  visible,
  onClose,
  selectedTime,
  onTimeSelect,
}: TimePickerModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const hoursScrollRef = useRef<ScrollView>(null);
  const minutesScrollRef = useRef<ScrollView>(null);

  const hours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  }, []);

  const minutes = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));
  }, []);

  const selectedHour = selectedTime.getHours().toString().padStart(2, '0');
  const selectedMinute = selectedTime.getMinutes().toString().padStart(2, '0');
  const selectedHourIndex = parseInt(selectedHour, 10);
  const selectedMinuteIndex = parseInt(selectedMinute, 10);

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
      const { contentOffset } = e.nativeEvent;
      const index = Math.max(0, Math.min(23, getCenteredIndex(contentOffset.y)));
      const newTime = new Date(selectedTime);
      if (newTime.getHours() !== index) {
        newTime.setHours(index);
        onTimeSelect(newTime);
      }
    },
    [selectedTime, onTimeSelect, getCenteredIndex]
  );

  const handleMinutesScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = e.nativeEvent;
      const index = Math.max(0, Math.min(59, getCenteredIndex(contentOffset.y)));
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
      const { contentOffset } = e.nativeEvent;
      const index = Math.max(0, Math.min(23, getCenteredIndex(contentOffset.y)));
      scrollToHour(index, true);
    },
    [getCenteredIndex, scrollToHour]
  );

  const snapMinutes = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset } = e.nativeEvent;
      const index = Math.max(0, Math.min(59, getCenteredIndex(contentOffset.y)));
      scrollToMinute(index, true);
    },
    [getCenteredIndex, scrollToMinute]
  );

  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        scrollToHour(selectedHourIndex, false);
        scrollToMinute(selectedMinuteIndex, false);
      }, 100);
    }
  }, [visible, selectedHourIndex, selectedMinuteIndex, scrollToHour, scrollToMinute]);

  const handleHourPress = (hour: string) => {
    const index = parseInt(hour, 10);
    scrollToHour(index, true);
    const newTime = new Date(selectedTime);
    newTime.setHours(index);
    onTimeSelect(newTime);
  };

  const handleMinutePress = (minute: string) => {
    const index = parseInt(minute, 10);
    scrollToMinute(index, true);
    const newTime = new Date(selectedTime);
    newTime.setMinutes(index);
    onTimeSelect(newTime);
  };

  const displayTime = `${selectedHour}:${selectedMinute}`;

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title=""
      scrollable={false}
      showHeader={false}
      footer={
        <View className="flex-row items-stretch gap-3">
          <Button
            label={t('timePicker.cancel').toUpperCase()}
            variant="outline"
            size="sm"
            width="flex-1"
            onPress={onClose}
            style={{ borderColor: theme.colors.background.white20 }}
          />
          <Button
            label={t('timePicker.confirm').toUpperCase()}
            variant="gradientCta"
            size="sm"
            width="flex-1"
            onPress={() => {
              onTimeSelect(selectedTime);
              onClose();
            }}
          />
        </View>
      }
    >
      <View className="flex-1 flex-col items-center justify-between overflow-hidden bg-bg-primary py-10">
        {/* Header: large time display (24h) */}
        <View className="mb-16 flex w-full justify-center">
          <Text
            className="text-center font-bold tracking-tight text-white"
            style={{
              fontSize: 96,
              textShadowColor: 'rgba(0,0,0,0.3)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 8,
            }}
          >
            {displayTime}
          </Text>
        </View>

        {/* Picker section: two columns with highlight bar */}
        <View className="w-full max-w-sm flex-1 flex-col items-center justify-center">
          {/* Wrapper so the highlight bar is centered on the scroll area only (not labels) */}
          <View className="relative w-full" style={{ height: PICKER_VIEW_HEIGHT }}>
            {/* Highlight bar behind the numbers - centered in scroll area */}
            <View
              className="absolute left-1/2 top-1/2 z-0 w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-xl"
              style={{
                height: 64,
                backgroundColor: theme.colors.background.white10,
              }}
              pointerEvents="none"
            />

            <View className="z-10 flex h-full w-full flex-row items-center justify-center gap-16">
              {/* Hours column */}
              <View className="flex flex-col items-center">
                <ScrollView
                  ref={hoursScrollRef}
                  style={{ height: PICKER_VIEW_HEIGHT }}
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
                          className="font-semibold"
                          style={{
                            color: `rgba(255,255,255,${opacity})`,
                            fontSize: isSelected ? 36 : 24,
                            fontWeight: isSelected ? '700' : '600',
                          }}
                        >
                          {hour}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Minutes column */}
              <View className="flex flex-col items-center">
                <ScrollView
                  ref={minutesScrollRef}
                  style={{ height: PICKER_VIEW_HEIGHT }}
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
                          className="font-semibold"
                          style={{
                            color: `rgba(255,255,255,${opacity})`,
                            fontSize: isSelected ? 36 : 24,
                            fontWeight: isSelected ? '700' : '600',
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
          </View>

          {/* Labels below the scroll area */}
          <View className="mt-8 flex w-full flex-row justify-center gap-16">
            <Text
              className="font-semibold uppercase tracking-widest text-white/50"
              style={{ fontSize: 10 }}
            >
              {t('timePicker.hours')}
            </Text>
            <Text
              className="font-semibold uppercase tracking-widest text-white/50"
              style={{ fontSize: 10 }}
            >
              {t('timePicker.minutes')}
            </Text>
          </View>
        </View>
      </View>
    </FullScreenModal>
  );
}
