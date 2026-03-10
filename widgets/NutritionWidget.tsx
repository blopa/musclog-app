import {
  type ColorProp,
  FlexWidget,
  TextWidget,
} from 'react-native-android-widget';

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

  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        backgroundColor: theme.colors.background.primary as ColorProp,
        borderRadius: theme.borderRadius.xl,
        padding: 16,
        flexDirection: 'column',
        justifyContent: 'center',
      }}
      clickAction="OPEN_URI"
      clickActionData={{
        uri: 'com.werules.logger://?action=open-nutrition',
      }}
    >
      {/* Header Info */}
      <FlexWidget
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
        }}
      >
        {!isSmall && (
           <FlexWidget style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <TextWidget
              text={calories.toLocaleString()}
              style={{
                fontSize: 24,
                fontWeight: 'bold',
                color: theme.colors.text.primary as ColorProp,
              }}
            />
            <TextWidget
              text={` / ${targetCalories.toLocaleString()} kcal`}
              style={{
                fontSize: 14,
                color: theme.colors.text.secondary as ColorProp,
                marginLeft: 4,
              }}
            />
          </FlexWidget>
        )}
        {isSmall && (
          <TextWidget
            text="MUSCLOG"
            style={{
              fontSize: 14,
              fontWeight: 'bold',
              color: theme.colors.text.primary as ColorProp,
            }}
          />
        )}

        {isSmall && (
          <FlexWidget style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <TextWidget
              text={calories.toLocaleString()}
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: theme.colors.text.primary as ColorProp,
              }}
            />
            <TextWidget
              text={` / ${targetCalories.toLocaleString()} kcal`}
              style={{
                fontSize: 12,
                color: theme.colors.text.secondary as ColorProp,
                marginLeft: 2,
              }}
            />
          </FlexWidget>
        )}

        {!isSmall && (
          <TextWidget
            text={`${caloriePercentage}%`}
            style={{
              fontSize: 14,
              fontWeight: 'bold',
              color: theme.colors.accent.primary as ColorProp,
            }}
          />
        )}
      </FlexWidget>

      {/* Main Progress Bar */}
      <FlexWidget
        style={{
          height: 12,
          width: 'match_parent',
          backgroundColor: theme.colors.background.white10 as ColorProp,
          borderRadius: 6,
          marginBottom: isSmall ? 8 : 16,
        }}
      >
        <FlexWidget
          style={{
            height: 'match_parent',
            width: `${caloriePercentage}%`,
            backgroundColor: theme.colors.accent.primary as ColorProp,
            borderRadius: 6,
          }}
        />
      </FlexWidget>

      {/* Footer / Macros */}
      {isSmall ? (
        <FlexWidget
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
          }}
        >
          <TextWidget
            text="Daily Calorie Goal"
            style={{
              fontSize: 12,
              color: theme.colors.text.secondary as ColorProp,
            }}
          />
          <TextWidget
            text={`${caloriePercentage}%`}
            style={{
              fontSize: 12,
              fontWeight: 'bold',
              color: theme.colors.accent.primary as ColorProp,
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
            <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <TextWidget text="PROT" style={{ fontSize: 10, fontWeight: 'bold', color: theme.colors.text.secondary as ColorProp }} />
              <TextWidget text={`${Math.round(protein)}g`} style={{ fontSize: 10, color: theme.colors.text.primary as ColorProp }} />
            </FlexWidget>
            <FlexWidget style={{ height: 4, width: 'match_parent', backgroundColor: theme.colors.background.white10 as ColorProp, borderRadius: 2 }}>
              <FlexWidget style={{ height: 'match_parent', width: `${proteinPercentage}%`, backgroundColor: theme.colors.macros.protein.bg as ColorProp, borderRadius: 2 }} />
            </FlexWidget>
          </FlexWidget>

          {/* Carbs */}
          <FlexWidget style={{ flex: 1, marginHorizontal: 4 }}>
            <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <TextWidget text="CARB" style={{ fontSize: 10, fontWeight: 'bold', color: theme.colors.text.secondary as ColorProp }} />
              <TextWidget text={`${Math.round(carbs)}g`} style={{ fontSize: 10, color: theme.colors.text.primary as ColorProp }} />
            </FlexWidget>
            <FlexWidget style={{ height: 4, width: 'match_parent', backgroundColor: theme.colors.background.white10 as ColorProp, borderRadius: 2 }}>
              <FlexWidget style={{ height: 'match_parent', width: `${carbsPercentage}%`, backgroundColor: theme.colors.macros.carbs.bg as ColorProp, borderRadius: 2 }} />
            </FlexWidget>
          </FlexWidget>

          {/* Fat */}
          <FlexWidget style={{ flex: 1, marginLeft: 8 }}>
            <FlexWidget style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <TextWidget text="FAT" style={{ fontSize: 10, fontWeight: 'bold', color: theme.colors.text.secondary as ColorProp }} />
              <TextWidget text={`${Math.round(fat)}g`} style={{ fontSize: 10, color: theme.colors.text.primary as ColorProp }} />
            </FlexWidget>
            <FlexWidget style={{ height: 4, width: 'match_parent', backgroundColor: theme.colors.background.white10 as ColorProp, borderRadius: 2 }}>
              <FlexWidget style={{ height: 'match_parent', width: `${fatPercentage}%`, backgroundColor: theme.colors.macros.fat.bg as ColorProp, borderRadius: 2 }} />
            </FlexWidget>
          </FlexWidget>
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
