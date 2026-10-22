import {
  Button,
  Column,
  LinearProgressIndicator,
  Row,
  Spacer,
  Text,
} from '@expo/ui/jetpack-compose';
import {
  cornerRadius,
  fillMaxSize,
  height,
  paddingAll,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { INITIAL_NUTRITION_SNAPSHOT, type NutritionWidgetSnapshot } from './widgetSnapshot';

// The widget runtime has no weights, so the row is laid out in fixed dp widths that fit the 4x1
// footprint declared in app.json. The root must stay a Button: it is the interaction target the
// native provider turns into the deep link.
function NutritionWidget(props: NutritionWidgetSnapshot) {
  'widget';
  const { palette } = props;
  return (
    <Button
      colors={{ containerColor: palette.background, contentColor: palette.text }}
      modifiers={[fillMaxSize(), cornerRadius(24)]}
    >
      {props.message ? (
        <Column
          verticalArrangement="center"
          horizontalAlignment="start"
          modifiers={[fillMaxSize(), paddingAll(14)]}
        >
          <Text style={{ fontSize: 11, fontWeight: 'bold' }} color={palette.accent}>
            {props.dateLabel}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: 'bold' }} color={palette.text}>
            {props.message}
          </Text>
        </Column>
      ) : (
        <Row
          verticalAlignment="center"
          horizontalArrangement="start"
          modifiers={[fillMaxSize(), paddingAll(14)]}
        >
          <Column verticalArrangement="center" horizontalAlignment="start" modifiers={[width(88)]}>
            <Text style={{ fontSize: 11, fontWeight: 'bold' }} color={palette.secondary}>
              {props.dateLabel}
            </Text>
            <Text style={{ fontSize: 28, fontWeight: 'bold' }} color={palette.text}>
              {props.calories}
            </Text>
            <Text style={{ fontSize: 10 }} color={palette.secondary}>
              {props.calorieTarget}
            </Text>
            <Spacer modifiers={[height(4)]} />
            <LinearProgressIndicator
              progress={props.calorieProgress}
              color={palette.accent}
              modifiers={[width(80)]}
            />
          </Column>
          <Spacer modifiers={[width(14)]} />
          {props.macros.map((macro) => (
            <Row key={macro.label} verticalAlignment="center">
              <Column
                verticalArrangement="center"
                horizontalAlignment="start"
                modifiers={[width(50)]}
              >
                <Text style={{ fontSize: 10 }} color={palette.secondary}>
                  {macro.label}
                </Text>
                <Text style={{ fontSize: 14, fontWeight: 'bold' }} color={palette.text}>
                  {macro.value}
                </Text>
                <Spacer modifiers={[height(4)]} />
                <LinearProgressIndicator
                  progress={macro.progress}
                  color={macro.color}
                  modifiers={[width(44)]}
                />
              </Column>
              <Spacer modifiers={[width(8)]} />
            </Row>
          ))}
        </Row>
      )}
    </Button>
  );
}

export default createWidget('Nutrition', NutritionWidget, INITIAL_NUTRITION_SNAPSHOT);
