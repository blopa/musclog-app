import { Pressable, Text, View } from 'react-native';

import { theme } from '../../theme';

type WeekdayPickerProps = {
  days: string[];
  selectedDays: number[];
  onToggleDay: (index: number) => void;
};

export function WeekdayPicker({ days, selectedDays, onToggleDay }: WeekdayPickerProps) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      {days.map((day, index) => {
        const isSelected = selectedDays.includes(index);
        return (
          <Pressable key={`${day}-${index}`} onPress={() => onToggleDay(index)}>
            {({ pressed }) => (
              <View
                style={{
                  width: theme.size['10'],
                  height: theme.size['10'],
                  borderRadius: theme.borderRadius.full,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isSelected
                    ? theme.colors.accent.primary
                    : theme.colors.background.secondary,
                  borderWidth: theme.borderWidth.thin,
                  borderColor: isSelected ? theme.colors.accent.primary : theme.colors.border.light,
                  transform: [{ scale: pressed ? 0.95 : 1 }],
                }}
              >
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.bold,
                    color: isSelected
                      ? theme.colors.background.primary
                      : theme.colors.text.secondary,
                  }}
                >
                  {day}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
