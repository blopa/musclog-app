import { useRouter } from 'expo-router';
import { Calendar as CalendarIcon } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { BottomButtonWrapper } from '../../components/BottomButtonWrapper';
import { MasterLayout } from '../../components/MasterLayout';
import { DatePickerModal } from '../../components/modals/DatePickerModal';
import { Button } from '../../components/theme/Button';
import { theme } from '../../theme';

export default function CycleAnchor() {
  const { t } = useTranslation();
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isDatePickerVisible, setIsDatePickerVisible] = useState(false);

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleNext = () => {
    router.push({
      pathname: '/onboarding/cycle-birth-control',
      params: { lastPeriodStartDate: selectedDate.getTime() },
    });
  };

  return (
    <MasterLayout showNavigationMenu={false}>
      <View className="flex-1 px-6 pt-8">
        <Text
          className="mb-2 text-3xl font-bold tracking-tight"
          style={{ color: theme.colors.text.white }}
        >
          {t('onboarding.cycleSetup.anchor.title')}
        </Text>
        <Text className="mb-8 text-lg text-text-secondary">
          {t('onboarding.cycleSetup.anchor.description')}
        </Text>

        <Pressable
          className="flex-row items-center rounded-2xl border-2 border-white/10 bg-bg-card p-6 active:opacity-80"
          onPress={() => setIsDatePickerVisible(true)}
        >
          <View
            className="mr-4 h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.colors.accent.primary20 }}
          >
            <CalendarIcon size={24} color={theme.colors.accent.primary} />
          </View>
          <View className="flex-1">
            <Text className="text-sm text-text-secondary">{t('editPersonalInfo.dateOfBirth')}</Text>
            <Text className="text-xl font-bold text-text-primary">{formatDate(selectedDate)}</Text>
          </View>
        </Pressable>

        <DatePickerModal
          visible={isDatePickerVisible}
          onClose={() => setIsDatePickerVisible(false)}
          selectedDate={selectedDate}
          onDateSelect={(date) => {
            setSelectedDate(date);
            setIsDatePickerVisible(false);
          }}
          maxYear={new Date().getFullYear()}
        />
      </View>

      <BottomButtonWrapper>
        <Button
          label={t('onboarding.next')}
          onPress={handleNext}
          variant="accent"
          size="md"
          width="full"
        />
      </BottomButtonWrapper>
    </MasterLayout>
  );
}
