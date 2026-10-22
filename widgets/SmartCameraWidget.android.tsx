import { Button, Column, Image, Text } from '@expo/ui/jetpack-compose';
import { cornerRadius, fillMaxSize, size } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { type CameraWidgetSnapshot, INITIAL_CAMERA_SNAPSHOT } from './widgetSnapshot';

// The root must stay a Button: it is the interaction target the native provider turns into the
// deep link. The artwork sits on the theme background; the label is the fallback without it.
function SmartCameraWidget(props: CameraWidgetSnapshot) {
  'widget';
  const { palette } = props;
  return (
    <Button
      colors={{ containerColor: palette.background, contentColor: palette.text }}
      modifiers={[fillMaxSize(), cornerRadius(24)]}
    >
      <Column verticalArrangement="center" horizontalAlignment="center" modifiers={[fillMaxSize()]}>
        {props.imageUri ? (
          <Image
            source={{ uri: props.imageUri }}
            contentDescription={props.label}
            modifiers={[size(52, 52)]}
          />
        ) : (
          <Text style={{ fontSize: 12, fontWeight: 'bold' }} color={palette.accent}>
            {props.label}
          </Text>
        )}
      </Column>
    </Button>
  );
}

export default createWidget('SmartCamera', SmartCameraWidget, INITIAL_CAMERA_SNAPSHOT);
