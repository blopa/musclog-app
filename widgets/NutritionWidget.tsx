import { type ColorProp, FlexWidget, TextWidget } from 'react-native-android-widget';

import { theme } from '../theme';

interface NutritionWidgetProps {
  calories: number;
  targetCalories: number;
  protein: number;
  targetProtein: number;
  carbs: number;
  targetCarbs: number;
  fat: number;
  targetFat: number;
  width: number;
  height: number;
}

export function NutritionWidget({
  calories,
  targetCalories,
  protein,
  targetProtein,
  carbs,
  targetCarbs,
  fat,
  targetFat,
  width,
  height,
}: NutritionWidgetProps) {
  const caloriePercentage = Math.min(Math.round((calories / (targetCalories || 1)) * 100), 100);
  const proteinPercentage = Math.min(Math.round((protein / (targetProtein || 1)) * 100), 100);
  const carbsPercentage = Math.min(Math.round((carbs / (targetCarbs || 1)) * 100), 100);
  const fatPercentage = Math.min(Math.round((fat / (targetFat || 1)) * 100), 100);

  const isSmall = height < 100;

  // Calculate pixel widths for progress bars (accounting for padding: 16px on each side = 32px total)
  const availableWidth = width - 32;
  const calorieBarWidth = Math.round((availableWidth * caloriePercentage) / 100);
  // For macro bars, each flex container gets approximately 1/3 of available width minus margins
  // Each macro bar container has marginRight/marginLeft of 8px, so total horizontal margins ~24px
  const macroBarContainerWidth = Math.round((availableWidth - 24) / 3);
  const proteinBarWidth = Math.round((macroBarContainerWidth * proteinPercentage) / 100);
  const carbsBarWidth = Math.round((macroBarContainerWidth * carbsPercentage) / 100);
  const fatBarWidth = Math.round((macroBarContainerWidth * fatPercentage) / 100);

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: theme.colors.background.primary as ColorProp,
        borderRadius: theme.borderRadius.xl,
        padding: theme.spacing.padding.base,
        flexDirection: 'column',
        justifyContent: 'center',
      }}
      clickAction="OPEN_URI"
      clickActionData={{
        uri: 'com.werules.logger://?action=open-nutrition',
      }}
    >
      {/* Header Info - MUSCLOG label on left, calories on right */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          width: 'match_parent',
          marginBottom: theme.spacing.margin.sm,
        }}
      >
        <TextWidget
          text="MUSCLOG"
          style={{
            fontSize: theme.typography.fontSize.sm,
            color: theme.colors.text.primary as ColorProp,
          }}
        />
        <FlexWidget style={{ flex: 1 }} />
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <TextWidget
            text={calories.toLocaleString()}
            style={{
              fontSize: isSmall ? theme.typography.fontSize.lg : theme.typography.fontSize['2xl'],
              fontWeight: 'bold',
              color: theme.colors.text.primary as ColorProp,
            }}
          />
          <TextWidget
            text={` / ${targetCalories.toLocaleString()} kcal`}
            style={{
              fontSize: isSmall ? theme.typography.fontSize.xs : theme.typography.fontSize.sm,
              color: theme.colors.text.secondary as ColorProp,
              marginLeft: isSmall ? theme.spacing.margin['2'] : theme.spacing.margin.xs,
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Main Progress Bar */}
      <FlexWidget
        style={{
          height: theme.size.md,
          width: 'match_parent',
          backgroundColor: theme.colors.background.white10 as ColorProp,
          borderRadius: 6,
          marginBottom: isSmall ? theme.spacing.margin.sm : theme.spacing.margin.base,
        }}
      >
        <FlexWidget
          style={{
            height: 'match_parent',
            width: calorieBarWidth,
            backgroundGradient: {
              from: theme.colors.status.violet500 as ColorProp, // Blue-purple start (#8b5cf6)
              to: theme.colors.accent.tertiary as ColorProp, // Teal-green end (#14b8a6)
              orientation: 'LEFT_RIGHT',
            },
            borderRadius: 6,
          }}
        />
      </FlexWidget>

      {/* Footer / Macros */}
      {isSmall ? (
        <FlexWidget
          style={{
            flexDirection: 'row',
            width: 'match_parent',
          }}
        >
          <TextWidget
            text="Daily Calorie Goal"
            style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.secondary as ColorProp,
            }}
          />
          <FlexWidget style={{ flex: 1 }} />
          <TextWidget
            text={`${caloriePercentage}%`}
            style={{
              fontSize: theme.typography.fontSize.xs,
              fontWeight: 'bold',
              color: theme.colors.status.emeraldLight as ColorProp, // Vibrant green matching progress bar
            }}
          />
        </FlexWidget>
      ) : (
        <FlexWidget
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          {/* Protein */}
          <FlexWidget style={{ flex: 1, marginRight: 8 }}>
            <FlexWidget
              style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}
            >
              <TextWidget
                text="PROT"
                style={{
                  fontSize: theme.typography.fontSize.xxs,
                  fontWeight: 'bold',
                  color: theme.colors.text.secondary as ColorProp,
                }}
              />
              <TextWidget
                text={`${Math.round(protein)}g`}
                style={{ fontSize: 10, color: theme.colors.text.primary as ColorProp }}
              />
            </FlexWidget>
            <FlexWidget
              style={{
                height: 4,
                width: 'match_parent',
                backgroundColor: theme.colors.background.white10 as ColorProp,
                borderRadius: theme.borderRadius['2'],
              }}
            >
              <FlexWidget
                style={{
                  height: 'match_parent',
                  width: proteinBarWidth,
                  backgroundColor: theme.colors.macros.protein.bg as ColorProp,
                  borderRadius: theme.borderRadius['2'],
                }}
              />
            </FlexWidget>
          </FlexWidget>

          {/* Carbs */}
          <FlexWidget style={{ flex: 1, marginHorizontal: 4 }}>
            <FlexWidget
              style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}
            >
              <TextWidget
                text="CARB"
                style={{
                  fontSize: theme.typography.fontSize.xxs,
                  fontWeight: 'bold',
                  color: theme.colors.text.secondary as ColorProp,
                }}
              />
              <TextWidget
                text={`${Math.round(carbs)}g`}
                style={{ fontSize: 10, color: theme.colors.text.primary as ColorProp }}
              />
            </FlexWidget>
            <FlexWidget
              style={{
                height: theme.size.xs,
                width: 'match_parent',
                backgroundColor: theme.colors.background.white10 as ColorProp,
                borderRadius: 2,
              }}
            >
              <FlexWidget
                style={{
                  height: 'match_parent',
                  width: carbsBarWidth,
                  backgroundColor: theme.colors.macros.carbs.bg as ColorProp,
                  borderRadius: theme.borderRadius['2'],
                }}
              />
            </FlexWidget>
          </FlexWidget>

          {/* Fat */}
          <FlexWidget style={{ flex: 1, marginLeft: 8 }}>
            <FlexWidget
              style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}
            >
              <TextWidget
                text="FAT"
                style={{
                  fontSize: theme.typography.fontSize.xxs,
                  fontWeight: 'bold',
                  color: theme.colors.text.secondary as ColorProp,
                }}
              />
              <TextWidget
                text={`${Math.round(fat)}g`}
                style={{ fontSize: 10, color: theme.colors.text.primary as ColorProp }}
              />
            </FlexWidget>
            <FlexWidget
              style={{
                height: theme.size.xs,
                width: 'match_parent',
                backgroundColor: theme.colors.background.white10 as ColorProp,
                borderRadius: theme.borderRadius['2'],
              }}
            >
              <FlexWidget
                style={{
                  height: 'match_parent',
                  width: fatBarWidth,
                  backgroundColor: theme.colors.macros.fat.bg as ColorProp,
                  borderRadius: theme.borderRadius['2'],
                }}
              />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
