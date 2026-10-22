import {
  Box,
  Button,
  CircularProgressIndicator,
  Column,
  LinearProgressIndicator,
  Row,
  Spacer,
  Text,
} from '@expo/ui/jetpack-compose';
import {
  cornerRadius,
  fillMaxSize,
  fillMaxWidth,
  height,
  paddingAll,
  size,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { INITIAL_NUTRITION_SNAPSHOT, type NutritionWidgetSnapshot } from './widgetSnapshot';

// The Android counterpart of the iOS medium layout: the date over a calorie ring, then a labelled
// bar per macro. The widget runtime has no weights, so the ring column has a fixed width and the
// macro column, as the Row's last child, fills what is left (MATCH_PARENT in a LinearLayout). A
// label and its value share a Box: the value sits in a full-width, end-aligned Row stacked over
// the label, which is the only way to push it to the far edge without a weight. The ring's stroke
// and its 12 o'clock start come from plugins/withWidgetProgressRing.js, because the runtime
// ignores `strokeWidth`. The root must stay a Button: it is the interaction target the native
// provider turns into the deep link.
function NutritionWidget(props: NutritionWidgetSnapshot) {
  'widget';
  const { palette } = props;
  const ringSize = 80;

  return (
    <Button
      colors={{ containerColor: palette.background, contentColor: palette.text }}
      modifiers={[fillMaxSize(), cornerRadius(24)]}
    >
      {props.state === 'stale' ? (
        <Column
          verticalArrangement="center"
          horizontalAlignment="start"
          modifiers={[fillMaxSize(), paddingAll(16)]}
        >
          <Text style={{ fontSize: 12, fontWeight: 'bold' }} color={palette.accent}>
            {props.dateLabel}
          </Text>
          <Spacer modifiers={[height(6)]} />
          <Text style={{ fontSize: 15, fontWeight: 'bold' }} color={palette.text}>
            {props.refreshMessage}
          </Text>
        </Column>
      ) : (
        <Row
          verticalAlignment="center"
          horizontalArrangement="start"
          modifiers={[fillMaxSize(), paddingAll(14)]}
        >
          <Column
            verticalArrangement="center"
            horizontalAlignment="start"
            modifiers={[width(ringSize)]}
          >
            <Text style={{ fontSize: 12, fontWeight: 'bold' }} color={palette.secondary}>
              {props.dateLabel}
            </Text>
            <Spacer modifiers={[height(6)]} />
            <Box contentAlignment="center" modifiers={[size(ringSize, ringSize)]}>
              <CircularProgressIndicator
                progress={props.calorieProgress}
                color={palette.accent}
                trackColor={palette.track}
                modifiers={[size(ringSize, ringSize)]}
              />
              <Column verticalArrangement="center" horizontalAlignment="center">
                <Text
                  style={{ fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}
                  color={palette.text}
                  maxLines={1}
                >
                  {props.calories}
                </Text>
                <Text
                  style={{ fontSize: 9, textAlign: 'center' }}
                  color={palette.secondary}
                  maxLines={1}
                >
                  {props.calorieTarget}
                </Text>
              </Column>
            </Box>
          </Column>
          <Spacer modifiers={[width(18)]} />
          <Column
            verticalArrangement="center"
            horizontalAlignment="start"
            modifiers={[fillMaxWidth()]}
          >
            {props.macros.map((macro, index) => (
              <Column key={macro.label} modifiers={[fillMaxWidth()]}>
                {index > 0 ? <Spacer modifiers={[height(8)]} /> : null}
                <Box contentAlignment="centerStart" modifiers={[fillMaxWidth()]}>
                  <Text style={{ fontSize: 12 }} color={palette.secondary} maxLines={1}>
                    {macro.label}
                  </Text>
                  <Row horizontalArrangement="end" modifiers={[fillMaxWidth()]}>
                    <Text style={{ fontSize: 14, fontWeight: 'bold' }} color={palette.text}>
                      {macro.value}
                    </Text>
                  </Row>
                </Box>
                <Spacer modifiers={[height(4)]} />
                <LinearProgressIndicator
                  progress={macro.progress}
                  color={macro.color}
                  trackColor={palette.track}
                  modifiers={[fillMaxWidth(), height(5)]}
                />
              </Column>
            ))}
          </Column>
        </Row>
      )}
    </Button>
  );
}

export default createWidget('Nutrition', NutritionWidget, INITIAL_NUTRITION_SNAPSHOT);
