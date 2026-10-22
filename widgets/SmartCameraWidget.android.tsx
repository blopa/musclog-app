import { Box, Button, Column, Image, Text } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, size } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { type CameraWidgetSnapshot, INITIAL_CAMERA_SNAPSHOT } from './widgetSnapshot';

// The artwork is drawn for a white page, so it sits on a white rounded tile instead of the theme
// background: it stays legible in every palette. The root must stay a Button: it is the interaction
// target the native provider turns into the deep link.
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
          <Box
            contentAlignment="center"
            modifiers={[size(54, 54), cornerRadius(16), background('#FFFFFF')]}
          >
            <Image
              source={{ uri: props.imageUri }}
              contentDescription={props.label}
              modifiers={[size(44, 44)]}
            />
          </Box>
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
