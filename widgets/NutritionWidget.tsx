import { type ColorProp, FlexWidget, TextWidget } from 'react-native-android-widget';

import i18n from '../lang/lang';
import { theme } from '../theme';

// This is a static widget component, using the default theme.
// It will not dynamically update if the theme is changed.
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
}: NutritionWidgetProps) {
  const caloriePercentage = Math.min(Math.round((calories / (targetCalories || 1)) * 100), 100);
  const proteinPercentage = Math.min(Math.round((protein / (targetProtein || 1)) * 100), 100);
  const carbsPercentage = Math.min(Math.round((carbs / (targetCarbs || 1)) * 100), 100);
  const fatPercentage = Math.min(Math.round((fat / (targetFat || 1)) * 100), 100);

  // padding: 12px each side = 24px total
  const availableWidth = width - 24;
  const calorieBarWidth = Math.round((availableWidth * caloriePercentage) / 100);
  // 3 macro containers with 2 gaps of 8px between them = 16px total gap
  const macroBarContainerWidth = Math.round((availableWidth - 16) / 3);
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
        padding: 12,
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
          marginBottom: 4,
        }}
      >
        <TextWidget
          text={i18n.t('common.appName')}
          style={{
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.text.primary as ColorProp,
          }}
        />
        <FlexWidget style={{ flex: 1 }} />
        <FlexWidget style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
          <TextWidget
            text={Math.round(calories).toLocaleString()}
            style={{
              fontSize: theme.typography.fontSize['2xl'],
              fontWeight: 'bold',
              color: theme.colors.text.primary as ColorProp,
            }}
          />
          <TextWidget
            text={` / ${targetCalories.toLocaleString()} ${i18n.t('common.kcal')}`}
            style={{
              fontSize: theme.typography.fontSize.xs,
              color: theme.colors.text.secondary as ColorProp,
              marginLeft: 4,
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* Main Progress Bar */}
      <FlexWidget
        style={{
          height: 6,
          width: 'match_parent',
          backgroundColor: theme.colors.background.white10 as ColorProp,
          borderRadius: 4,
          marginBottom: 6,
        }}
      >
        <FlexWidget
          style={{
            height: 'match_parent',
            width: calorieBarWidth,
            backgroundGradient: {
              from: theme.colors.status.violet500 as ColorProp,
              to: theme.colors.accent.tertiary as ColorProp,
              orientation: 'LEFT_RIGHT',
            },
            borderRadius: 4,
          }}
        />
      </FlexWidget>

      {/* Footer / Macros - left aligned */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-start',
          width: 'match_parent',
          height: 24,
        }}
      >
        {/* Protein */}
        <FlexWidget style={{ width: macroBarContainerWidth, marginRight: 8 }}>
          <FlexWidget
            style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 3 }}
          >
            <TextWidget
              text={i18n.t('nutrition.macros.protein').toUpperCase().slice(0, 4)}
              style={{
                fontSize: 9,
                fontWeight: 'bold',
                color: theme.colors.text.secondary as ColorProp,
              }}
            />
            <TextWidget
              text={`${Math.round(protein)}g`}
              style={{ fontSize: 9, color: theme.colors.text.primary as ColorProp, marginLeft: 2 }}
            />
          </FlexWidget>
          <FlexWidget
            style={{
              height: 3,
              width: 'match_parent',
              backgroundColor: theme.colors.background.white10 as ColorProp,
              borderRadius: 2,
            }}
          >
            <FlexWidget
              style={{
                height: 'match_parent',
                width: proteinBarWidth,
                backgroundColor: theme.colors.macros.protein.bg as ColorProp,
                borderRadius: 2,
              }}
            />
          </FlexWidget>
        </FlexWidget>

        {/* Carbs */}
        <FlexWidget style={{ width: macroBarContainerWidth, marginRight: 8 }}>
          <FlexWidget
            style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 3 }}
          >
            <TextWidget
              text={i18n.t('nutrition.carbs').toUpperCase().slice(0, 4)}
              style={{
                fontSize: 9,
                fontWeight: 'bold',
                color: theme.colors.text.secondary as ColorProp,
              }}
            />
            <TextWidget
              text={`${Math.round(carbs)}g`}
              style={{ fontSize: 9, color: theme.colors.text.primary as ColorProp, marginLeft: 2 }}
            />
          </FlexWidget>
          <FlexWidget
            style={{
              height: 3,
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
                borderRadius: 2,
              }}
            />
          </FlexWidget>
        </FlexWidget>

        {/* Fat */}
        <FlexWidget style={{ width: macroBarContainerWidth }}>
          <FlexWidget
            style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 3 }}
          >
            <TextWidget
              text={i18n.t('nutrition.fat').toUpperCase()}
              style={{
                fontSize: 9,
                fontWeight: 'bold',
                color: theme.colors.text.secondary as ColorProp,
              }}
            />
            <TextWidget
              text={`${Math.round(fat)}g`}
              style={{ fontSize: 9, color: theme.colors.text.primary as ColorProp, marginLeft: 2 }}
            />
          </FlexWidget>
          <FlexWidget
            style={{
              height: 3,
              width: 'match_parent',
              backgroundColor: theme.colors.background.white10 as ColorProp,
              borderRadius: 2,
            }}
          >
            <FlexWidget
              style={{
                height: 'match_parent',
                width: fatBarWidth,
                backgroundColor: theme.colors.macros.fat.bg as ColorProp,
                borderRadius: 2,
              }}
            />
          </FlexWidget>
        </FlexWidget>
      </FlexWidget>
    </FlexWidget>
  );
}
