import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { Button } from '../theme/Button';
import { FullScreenModal } from './FullScreenModal';

type TimePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  selectedTime: Date;
  onTimeSelect: (time: Date) => void;
};

export function TimePickerModal({
  visible,
  onClose,
  selectedTime,
  onTimeSelect,
}: TimePickerModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [tempHours, setTempHours] = useState(selectedTime.getHours());
  const [tempMinutes, setTempMinutes] = useState(selectedTime.getMinutes());

  const handleHourIncrement = () => {
    setTempHours((prev) => (prev + 1) % 24);
  };

  const handleHourDecrement = () => {
    setTempHours((prev) => (prev - 1 + 24) % 24);
  };

  const handleMinuteIncrement = () => {
    setTempMinutes((prev) => (prev + 1) % 60);
  };

  const handleMinuteDecrement = () => {
    setTempMinutes((prev) => (prev - 1 + 60) % 60);
  };

  const handleConfirm = () => {
    const newTime = new Date();
    newTime.setHours(tempHours, tempMinutes, 0, 0);
    onTimeSelect(newTime);
    onClose();
  };

  const formatTime = (hours: number, minutes: number) => {
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  return (
    <FullScreenModal visible={visible} onClose={onClose} title="" scrollable={false}>
      <View className="flex-1">
        {/* Title Section */}
        <View className="px-6 pb-6 pt-2">
          <Text className="mb-1 text-sm font-semibold uppercase tracking-wider text-accent-primary">
            {t('timePicker.selectTime')}
          </Text>
          <Text
            className="font-bold leading-tight tracking-tight text-text-primary"
            style={{ fontSize: theme.typography.fontSize['4xl'] }}
          >
            {formatTime(tempHours, tempMinutes)}
          </Text>
        </View>

        {/* Time Picker */}
        <View className="flex-1 px-4">
          <View
            className="rounded-2xl border bg-bg-cardDark p-8"
            style={{ borderColor: theme.colors.background.white5 }}
          >
            <View
              className="flex-row items-center justify-center"
              style={{ gap: theme.spacing.gap.xl }}
            >
              {/* Hours */}
              <View className="items-center">
                <Text className="mb-4 text-center text-xs font-bold uppercase tracking-wider text-text-secondary">
                  {t('timePicker.hours')}
                </Text>
                <View className="items-center" style={{ gap: theme.spacing.gap.sm }}>
                  <Pressable
                    className="h-12 w-12 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: theme.colors.background.cardElevated,
                      borderColor: theme.colors.background.white10,
                      borderWidth: theme.borderWidth.thin,
                    }}
                    onPress={handleHourIncrement}
                  >
                    <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.primary} />
                  </Pressable>
                  <View
                    className="h-20 w-20 items-center justify-center rounded-xl border"
                    style={{
                      borderColor: theme.colors.background.white10,
                      backgroundColor: theme.colors.background.white5,
                    }}
                  >
                    <Text className="text-3xl font-bold text-text-primary">
                      {tempHours.toString().padStart(2, '0')}
                    </Text>
                  </View>
                  <Pressable
                    className="h-12 w-12 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: theme.colors.background.cardElevated,
                      borderColor: theme.colors.background.white10,
                      borderWidth: theme.borderWidth.thin,
                    }}
                    onPress={handleHourDecrement}
                  >
                    <ChevronLeft size={theme.iconSize.lg} color={theme.colors.text.primary} />
                  </Pressable>
                </View>
              </View>

              {/* Separator */}
              <Text className="text-4xl font-bold text-text-primary">:</Text>

              {/* Minutes */}
              <View className="items-center">
                <Text className="mb-4 text-center text-xs font-bold uppercase tracking-wider text-text-secondary">
                  {t('timePicker.minutes')}
                </Text>
                <View className="items-center" style={{ gap: theme.spacing.gap.sm }}>
                  <Pressable
                    className="h-12 w-12 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: theme.colors.background.cardElevated,
                      borderColor: theme.colors.background.white10,
                      borderWidth: theme.borderWidth.thin,
                    }}
                    onPress={handleMinuteIncrement}
                  >
                    <ChevronRight size={theme.iconSize.lg} color={theme.colors.text.primary} />
                  </Pressable>
                  <View
                    className="h-20 w-20 items-center justify-center rounded-xl border"
                    style={{
                      borderColor: theme.colors.background.white10,
                      backgroundColor: theme.colors.background.white5,
                    }}
                  >
                    <Text className="text-3xl font-bold text-text-primary">
                      {tempMinutes.toString().padStart(2, '0')}
                    </Text>
                  </View>
                  <Pressable
                    className="h-12 w-12 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: theme.colors.background.cardElevated,
                      borderColor: theme.colors.background.white10,
                      borderWidth: theme.borderWidth.thin,
                    }}
                    onPress={handleMinuteDecrement}
                  >
                    <ChevronLeft size={theme.iconSize.lg} color={theme.colors.text.primary} />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>

          {/* Quick Time Buttons */}
          <View className="mt-6 flex-row justify-center" style={{ gap: theme.spacing.gap.md }}>
            <Button
              label={t('timePicker.now')}
              variant="secondary"
              size="sm"
              width="auto"
              onPress={() => {
                const now = new Date();
                setTempHours(now.getHours());
                setTempMinutes(now.getMinutes());
              }}
            />
            <Button
              label={t('timePicker.noon')}
              variant="secondary"
              size="sm"
              width="auto"
              onPress={() => {
                setTempHours(12);
                setTempMinutes(0);
              }}
            />
            <Button
              label={t('timePicker.midnight')}
              variant="secondary"
              size="sm"
              width="auto"
              onPress={() => {
                setTempHours(0);
                setTempMinutes(0);
              }}
            />
          </View>
        </View>

        {/* Footer */}
        <View className="p-6 pt-4" pointerEvents="auto">
          <View
            className="mb-6 h-px"
            style={{
              backgroundColor: theme.colors.background.white10,
            }}
          />
          <View className="flex-row items-center gap-4" pointerEvents="auto">
            <Button
              label={t('timePicker.cancel')}
              variant="outline"
              size="sm"
              width="flex-1"
              onPress={onClose}
            />
            <Button
              label={t('timePicker.confirm')}
              variant="gradientCta"
              size="sm"
              width="flex-1"
              onPress={handleConfirm}
            />
          </View>
        </View>
      </View>
    </FullScreenModal>
  );
}
