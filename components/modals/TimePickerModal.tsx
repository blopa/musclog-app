import DateTimePicker from '@react-native-community/datetimepicker';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, View } from 'react-native';
import { Text } from 'react-native';

import { useTheme } from '../../hooks/useTheme';
import { Button } from '../theme/Button';
import { FullScreenModal } from './FullScreenModal';

type TimePickerModalProps = {
  visible: boolean;
  onClose: () => void;
  selectedTime: Date;
  title: string;
  onTimeSelect: (time: Date) => void;
};

export function TimePickerModal({
  visible,
  onClose,
  selectedTime,
  onTimeSelect,
  title,
}: TimePickerModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const selectedHour = selectedTime.getHours().toString().padStart(2, '0');
  const selectedMinute = selectedTime.getMinutes().toString().padStart(2, '0');
  const displayTime = `${selectedHour}:${selectedMinute}`;

  const handleNativeChange = useCallback(
    (_event: unknown, date?: Date) => {
      if (date) {
        onTimeSelect(date);
      }
    },
    [onTimeSelect]
  );

  return (
    <FullScreenModal
      visible={visible}
      onClose={onClose}
      title={title}
      scrollable={false}
      showHeader={true}
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
        <View className="mb-16 flex w-full justify-center">
          <Text
            className="text-center font-bold tracking-tight text-white"
            style={{
              fontSize: theme.typography.fontSize['8xl'],
              textShadowColor: theme.colors.background.black30,
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 8,
            }}
          >
            {displayTime}
          </Text>
        </View>

        <View className="flex-1 items-center justify-center">
          <DateTimePicker
            value={selectedTime}
            mode="time"
            display="spinner"
            onChange={handleNativeChange}
            is24Hour={true}
            {...(Platform.OS === 'ios' && {
              themeVariant: 'dark' as const,
              accentColor: theme.colors.accent.primary,
              textColor: theme.colors.text.primary,
            })}
            {...(Platform.OS === 'android' && { style: { height: 180 } })}
          />
        </View>
      </View>
    </FullScreenModal>
  );
}
