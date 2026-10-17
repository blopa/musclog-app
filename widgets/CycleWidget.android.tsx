import { Button, Column, Text } from '@expo/ui/jetpack-compose';
import { cornerRadius, fillMaxSize, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { type CycleWidgetSnapshot, INITIAL_CYCLE_SNAPSHOT } from './cycleWidgetSnapshot';

function CycleWidget(props: CycleWidgetSnapshot) {
  'widget';
  return (
    <Button
      colors={{ containerColor: props.palette.background, contentColor: props.palette.text }}
      modifiers={[fillMaxSize(), cornerRadius(16)]}
    >
      <Column modifiers={[fillMaxSize(), paddingAll(8)]}>
        <Text style={{ fontSize: 10 }} color={props.palette.secondary}>
          {props.title}
        </Text>
        {props.value ? (
          <Text style={{ fontSize: 24, fontWeight: 'bold' }} color={props.palette.text}>
            {props.value}
          </Text>
        ) : null}
        <Text style={{ fontSize: 11 }} color={props.palette.secondary}>
          {props.caption}
        </Text>
        {props.detail ? (
          <Text style={{ fontSize: 10 }} color={props.palette.accent}>
            {props.detail}
          </Text>
        ) : null}
      </Column>
    </Button>
  );
}

export default createWidget('Cycle', CycleWidget, INITIAL_CYCLE_SNAPSHOT);
