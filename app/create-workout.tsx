import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Sparkles, PlusSquare } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../theme';
import { Button } from '../components/theme/Button';
import { SegmentedControl } from '../components/theme/SegmentedControl';
import { LinearGradient } from 'expo-linear-gradient';

type WeekdayPickerProps = {
  days: string[];
  selectedDays: number[];
  onToggleDay: (index: number) => void;
};

function WeekdayPicker({ days, selectedDays, onToggleDay }: WeekdayPickerProps) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {days.map((day, index) => {
        const isSelected = selectedDays.includes(index);
        return (
          <Pressable
            key={`${day}-${index}`}
            onPress={() => onToggleDay(index)}
            style={({ pressed }) => [
              {
                width: theme.size['10'],
                height: theme.size['10'],
                borderRadius: theme.borderRadius.full,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isSelected ? theme.colors.accent.primary : 'transparent',
                borderWidth: isSelected ? 0 : theme.borderWidth.thin,
                borderColor: theme.colors.border.light,
                transform: [{ scale: pressed ? 0.95 : 1 }],
              },
            ]}>
            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                fontWeight: theme.typography.fontWeight.bold,
                color: isSelected ? theme.colors.background.primary : theme.colors.text.secondary,
              }}>
              {day}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function CreateWorkoutScreen() {
  const router = useRouter();
  const [workoutTitle, setWorkoutTitle] = useState('');
  const [description, setDescription] = useState('');
  const [volumeCalc, setVolumeCalc] = useState('none');
  const [selectedDays, setSelectedDays] = useState<number[]>([4]); // Friday selected by default in mockup
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

  const toggleDay = (index: number) => {
    if (selectedDays.includes(index)) {
      setSelectedDays(selectedDays.filter((d) => d !== index));
    } else {
      setSelectedDays([...selectedDays, index]);
    }
  };

  const volumeOptions = [
    { label: 'None', value: 'none' },
    { label: 'Algorithm', value: 'algorithm' },
    {
      label: 'AI',
      value: 'ai',
      icon: (
        <Sparkles
          size={14}
          color={volumeCalc === 'ai' ? theme.colors.text.white : theme.colors.text.tertiary}
        />
      ),
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={['top', 'bottom']}>
      {/* Background Glows */}
      <View style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <View
          style={{
            position: 'absolute',
            top: -100,
            right: -100,
            width: 300,
            height: 300,
            borderRadius: 150,
            backgroundColor: theme.colors.accent.primary20,
            opacity: 0.15,
          }}
        />
        <View
          style={{
            position: 'absolute',
            bottom: -100,
            left: -100,
            width: 250,
            height: 250,
            borderRadius: 125,
            backgroundColor: theme.colors.status.indigo10,
            opacity: 0.1,
          }}
        />
      </View>

      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.spacing.padding.base,
          paddingVertical: theme.spacing.padding.sm,
          zIndex: 10,
        }}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            {
              width: theme.size['10'],
              height: theme.size['10'],
              borderRadius: theme.borderRadius.full,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          <ArrowLeft size={24} color={theme.colors.text.secondary} />
        </Pressable>
        <Text
          style={{
            fontSize: theme.typography.fontSize.lg,
            fontWeight: theme.typography.fontWeight.bold,
            color: theme.colors.text.primary,
          }}>
          Create New Workout
        </Text>
        <Pressable
          onPress={() => {
            /* Save logic */
          }}
          style={({ pressed }) => [
            {
              paddingHorizontal: theme.spacing.padding.sm,
              paddingVertical: theme.spacing.padding.xs,
              opacity: pressed ? 0.7 : 1,
            },
          ]}>
          <Text
            style={{
              fontSize: theme.typography.fontSize.base,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.accent.primary,
            }}>
            Save
          </Text>
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: theme.spacing.padding.base,
          paddingBottom: 120,
        }}>
        {/* Essentials Section */}
        <View style={{ marginBottom: theme.spacing.gap.xl }}>
          <Text
            style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              marginBottom: theme.spacing.padding.md,
              marginLeft: 4,
            }}>
            Essentials
          </Text>

          <View style={{ gap: theme.spacing.gap.base }}>
            {/* Title Input */}
            <View
              style={{
                position: 'relative',
                borderRadius: theme.borderRadius.lg,
                overflow: 'hidden',
              }}>
              <View
                style={{
                  backgroundColor: theme.colors.background.card,
                  borderRadius: theme.borderRadius.lg,
                  padding: theme.spacing.padding.md,
                  borderWidth: theme.borderWidth.thin,
                  borderColor:
                    focusedField === 'title'
                      ? theme.colors.accent.primary
                      : theme.colors.border.light,
                  ...(focusedField === 'title' ? theme.shadows.accentGlow : {}),
                }}>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.medium,
                    color: theme.colors.text.secondary,
                    marginBottom: 4,
                  }}>
                  Workout Title
                </Text>
                <TextInput
                  value={workoutTitle}
                  onChangeText={setWorkoutTitle}
                  onFocus={() => setFocusedField('title')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="e.g., Leg Day Destruction"
                  placeholderTextColor={theme.colors.text.tertiary}
                  style={{
                    fontSize: theme.typography.fontSize.lg,
                    fontWeight: theme.typography.fontWeight.medium,
                    color: theme.colors.text.primary,
                    padding: 0,
                  }}
                />
              </View>
            </View>

            {/* Description Input */}
            <View
              style={{
                position: 'relative',
                borderRadius: theme.borderRadius.lg,
                overflow: 'hidden',
              }}>
              <View
                style={{
                  backgroundColor: theme.colors.background.card,
                  borderRadius: theme.borderRadius.lg,
                  padding: theme.spacing.padding.md,
                  borderWidth: theme.borderWidth.thin,
                  borderColor:
                    focusedField === 'description'
                      ? theme.colors.accent.primary
                      : theme.colors.border.light,
                  ...(focusedField === 'description' ? theme.shadows.accentGlow : {}),
                }}>
                <Text
                  style={{
                    fontSize: theme.typography.fontSize.xs,
                    fontWeight: theme.typography.fontWeight.medium,
                    color: theme.colors.text.secondary,
                    marginBottom: 4,
                  }}>
                  Description
                </Text>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  onFocus={() => setFocusedField('description')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Focus on quads and calves..."
                  placeholderTextColor={theme.colors.text.tertiary}
                  multiline
                  numberOfLines={3}
                  style={{
                    fontSize: theme.typography.fontSize.base,
                    color: theme.colors.text.primary,
                    padding: 0,
                    minHeight: 80,
                    textAlignVertical: 'top',
                  }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Intelligence Section */}
        <View style={{ marginBottom: theme.spacing.gap.xl }}>
          <Text
            style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              marginBottom: theme.spacing.padding.md,
              marginLeft: 4,
            }}>
            Intelligence
          </Text>

          <View
            style={{
              backgroundColor: theme.colors.background.card,
              borderRadius: theme.borderRadius.lg,
              padding: theme.spacing.padding.base,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.border.light,
            }}>
            <Text
              style={{
                fontSize: theme.typography.fontSize.sm,
                fontWeight: theme.typography.fontWeight.medium,
                color: theme.colors.text.primary,
                marginBottom: theme.spacing.padding.base,
              }}>
              Volume Calculation
            </Text>

            <SegmentedControl
              options={volumeOptions}
              value={volumeCalc}
              onValueChange={setVolumeCalc}
            />

            <Text
              style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.secondary,
                marginTop: theme.spacing.padding.md,
                lineHeight: 18,
              }}>
              Choose how Musclog calculates optimal volume for your next session. AI adapts based on
              recovery data.
            </Text>
          </View>
        </View>

        {/* Routine Section */}
        <View style={{ marginBottom: theme.spacing.gap.xl }}>
          <Text
            style={{
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.bold,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: 1.2,
              marginBottom: theme.spacing.padding.md,
              marginLeft: 4,
            }}>
            Routine
          </Text>

          <View
            style={{
              backgroundColor: theme.colors.background.card,
              borderRadius: theme.borderRadius.lg,
              padding: theme.spacing.padding.base,
              borderWidth: theme.borderWidth.thin,
              borderColor: theme.colors.border.light,
            }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: theme.spacing.padding.base,
              }}>
              <Text
                style={{
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.text.primary,
                }}>
                Repeat on days
              </Text>
              <Text
                style={{
                  fontSize: theme.typography.fontSize.xs,
                  fontWeight: theme.typography.fontWeight.medium,
                  color: theme.colors.accent.primary,
                }}>
                Weekly
              </Text>
            </View>

            <WeekdayPicker
              days={days}
              selectedDays={selectedDays}
              onToggleDay={toggleDay}
            />
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: theme.spacing.padding.base,
          paddingBottom: Platform.OS === 'ios' ? 40 : 20,
          backgroundColor: 'transparent',
        }}>
        <LinearGradient
          colors={['transparent', theme.colors.background.primary]}
          style={{
            position: 'absolute',
            top: -40,
            left: 0,
            right: 0,
            height: 40,
          }}
        />
        <View style={{ backgroundColor: theme.colors.background.primary }}>
          <Button
            label="Add Exercise"
            variant="gradientCta"
            size="md"
            width="full"
            icon={PlusSquare}
            onPress={() => {
              /* Add exercise logic */
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
