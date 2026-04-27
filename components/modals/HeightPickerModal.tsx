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

import { Button } from '@/components/theme/Button';
import { useTheme } from '@/hooks/useTheme';

import { FullScreenModal } from './FullScreenModal';

const ITEM_HEIGHT = 64;
const PICKER_HEIGHT = ITEM_HEIGHT * 3;

// 1 ft to 8 ft — covers all realistic human heights
const FEET_ITEMS = Array.from({ length: 8 }, (_, i) => String(i + 1));
const INCHES_ITEMS = Array.from({ length: 12 }, (_, i) => String(i).padStart(2, '0'));

type ScrollPickerProps = {
  highlightBgColor: string;
  initialIndex: number;
  items: string[];
  onSelect: (index: number) => void;
  textMutedColor: string;
  textPrimaryColor: string;
  suffix?: string;
};

function ScrollPicker({
  items,
  initialIndex,
  onSelect,
  textPrimaryColor,
  textMutedColor,
  highlightBgColor,
  suffix,
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
                {suffix ? <Text style={{ fontSize: 16, fontWeight: '400' }}>{suffix}</Text> : null}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Convert total inches to { feetIndex, inchesIndex } for the pickers. */
function totalInchesToPickerIndices(totalInches: number): {
  feetIndex: number;
  inchesIndex: number;
} {
  const totalRounded = Math.round(totalInches);
  const feet = Math.max(1, Math.min(8, Math.floor(totalRounded / 12)));
  const inches = Math.max(0, Math.min(11, totalRounded % 12));
  return { feetIndex: feet - 1, inchesIndex: inches };
}

/** Convert picker indices back to total inches. */
function pickerIndicesToTotalInches(feetIndex: number, inchesIndex: number): number {
  return (feetIndex + 1) * 12 + inchesIndex;
}

type HeightPickerModalProps = {
  onClose: () => void;
  onHeightSelect: (totalInches: number) => void;
  totalInches: number;
  title: string;
  visible: boolean;
};

export function HeightPickerModal({
  visible,
  onClose,
  totalInches,
  onHeightSelect,
  title,
}: HeightPickerModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const initial = totalInchesToPickerIndices(totalInches || 67); // default ~5'7"
  const [feetIndex, setFeetIndex] = useState(initial.feetIndex);
  const [inchesIndex, setInchesIndex] = useState(initial.inchesIndex);
  const [pickerKey, setPickerKey] = useState(0);

  useEffect(() => {
    if (visible) {
      const idx = totalInchesToPickerIndices(totalInches || 67);
      setFeetIndex(idx.feetIndex);
      setInchesIndex(idx.inchesIndex);
      setPickerKey((k) => k + 1);
    }
  }, [visible, totalInches]);

  const displayFeet = feetIndex + 1;
  const displayInches = inchesIndex;

  const handleConfirm = useCallback(() => {
    onHeightSelect(pickerIndicesToTotalInches(feetIndex, inchesIndex));
    onClose();
  }, [feetIndex, inchesIndex, onHeightSelect, onClose]);

  const cardBg = theme.colors.background.card;
  const highlightBg = theme.colors.background.white12;
  const textPrimary = theme.colors.text.primary;
  const textMuted = theme.colors.text.secondary;

  return (
    <FullScreenModal
      footer={
        <View className="w-full items-center gap-4">
          <Button
            label={t('heightPicker.confirmHeight')}
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
              {t('heightPicker.cancel')}
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
      <View className="bg-bg-primary flex-1 items-center px-5 pt-8">
        {/* Height display */}
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
              {displayFeet}
            </Text>
            <Text
              style={{
                color: theme.colors.accent.primary,
                fontSize: 26,
                fontWeight: '700',
                lineHeight: 36,
                marginBottom: 10,
                marginLeft: 4,
                marginRight: 12,
              }}
            >
              ft
            </Text>
            <Text
              style={{
                color: textPrimary,
                fontSize: 80,
                fontWeight: '300',
                letterSpacing: -2,
                lineHeight: 88,
              }}
            >
              {String(displayInches).padStart(2, '0')}
            </Text>
            <Text
              style={{
                color: theme.colors.accent.primary,
                fontSize: 26,
                fontWeight: '700',
                lineHeight: 36,
                marginBottom: 10,
                marginLeft: 4,
              }}
            >
              in
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
            {t('heightPicker.selectedHeight')}
          </Text>
        </View>

        {/* Picker card */}
        <View
          className="w-full"
          style={{ backgroundColor: cardBg, borderRadius: 24, overflow: 'hidden' }}
        >
          {/* Column labels */}
          <View className="flex-row px-6 pt-5 pb-1">
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
              {t('heightPicker.feet')}
            </Text>
            <View style={{ width: 24 }} />
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
              {t('heightPicker.inches')}
            </Text>
          </View>

          {/* Scroll pickers */}
          <View className="flex-row items-center px-4 pb-2">
            <ScrollPicker
              key={`feet-${pickerKey}`}
              highlightBgColor={highlightBg}
              initialIndex={feetIndex}
              items={FEET_ITEMS}
              onSelect={setFeetIndex}
              textMutedColor={textMuted}
              textPrimaryColor={textPrimary}
              suffix=" ft"
            />
            <View style={{ width: 24 }} />
            <ScrollPicker
              key={`inches-${pickerKey}`}
              highlightBgColor={highlightBg}
              initialIndex={inchesIndex}
              items={INCHES_ITEMS}
              onSelect={setInchesIndex}
              textMutedColor={textMuted}
              textPrimaryColor={textPrimary}
              suffix=" in"
            />
          </View>
        </View>
      </View>
    </FullScreenModal>
  );
}
