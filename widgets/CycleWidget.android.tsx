import { Button, Column, Row, Spacer, Text } from '@expo/ui/jetpack-compose';
import {
  cornerRadius,
  fillMaxSize,
  height,
  paddingAll,
  width,
} from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { type CycleWidgetSnapshot, INITIAL_CYCLE_SNAPSHOT } from './cycleWidgetSnapshot';

// Outside the `day` state this is only a quiet brand shortcut. The root must stay a Button: it is the interaction target behind the deep link.
function CycleWidget(props: CycleWidgetSnapshot) {
  'widget';
  const { palette } = props;
  return (
    <Button
      colors={{ containerColor: palette.background, contentColor: palette.text }}
      modifiers={[fillMaxSize(), cornerRadius(24)]}
    >
      <Column
        verticalArrangement="center"
        horizontalAlignment="start"
        modifiers={[fillMaxSize(), paddingAll(14)]}
      >
        <Text style={{ fontSize: 11, fontWeight: 'bold' }} color={palette.accent}>
          {props.title}
        </Text>
        <Spacer modifiers={[height(2)]} />
        {props.state === 'day' ? (
          <Row verticalAlignment="bottom">
            <Text style={{ fontSize: 30, fontWeight: 'bold' }} color={palette.text}>
              {props.value}
            </Text>
            <Spacer modifiers={[width(6)]} />
            <Text style={{ fontSize: 12 }} color={palette.secondary}>
              {props.caption}
            </Text>
          </Row>
        ) : (
          <Text style={{ fontSize: 13, fontWeight: 'bold' }} color={palette.text}>
            {props.caption}
          </Text>
        )}
      </Column>
    </Button>
  );
}

export default createWidget('Cycle', CycleWidget, INITIAL_CYCLE_SNAPSHOT);
