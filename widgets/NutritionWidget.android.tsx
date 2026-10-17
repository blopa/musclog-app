import { Button, Column, LinearProgressIndicator, Row, Text } from '@expo/ui/jetpack-compose';
import {
  cornerRadius,
  fillMaxSize,
  fillMaxWidth,
  paddingAll,
  weight,
} from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { INITIAL_NUTRITION_SNAPSHOT, type NutritionWidgetSnapshot } from './widgetSnapshot';

function NutritionWidget(props: NutritionWidgetSnapshot) {
  'widget';
  return (
    <Button
      colors={{ containerColor: props.palette.background, contentColor: props.palette.text }}
      modifiers={[fillMaxSize(), cornerRadius(16)]}
    >
      <Column modifiers={[fillMaxSize(), paddingAll(8)]}>
        <Row modifiers={[fillMaxWidth()]}>
          <Text style={{ fontSize: 10 }} color={props.palette.secondary} modifiers={[weight(1)]}>
            {props.dateLabel}
          </Text>
          <Text style={{ fontSize: 20, fontWeight: 'bold' }} color={props.palette.text}>
            {props.calories}
          </Text>
          <Text style={{ fontSize: 10 }} color={props.palette.secondary}>
            {props.calorieTarget}
          </Text>
        </Row>
        {props.message ? (
          <Text style={{ fontSize: 11 }} color={props.palette.secondary}>
            {props.message}
          </Text>
        ) : (
          <Column modifiers={[fillMaxWidth()]}>
            <LinearProgressIndicator
              progress={props.calorieProgress}
              color={props.palette.accent}
              modifiers={[fillMaxWidth()]}
            />
            <Row modifiers={[fillMaxWidth()]}>
              {props.macros.map((macro) => (
                <Column key={macro.label} modifiers={[weight(1)]}>
                  <Text
                    style={{ fontSize: 9 }}
                    color={props.palette.secondary}
                  >{`${macro.label} ${macro.value}`}</Text>
                  <LinearProgressIndicator
                    progress={macro.progress}
                    color={macro.color}
                    modifiers={[fillMaxWidth()]}
                  />
                </Column>
              ))}
            </Row>
          </Column>
        )}
      </Column>
    </Button>
  );
}

export default createWidget('Nutrition', NutritionWidget, INITIAL_NUTRITION_SNAPSHOT);
