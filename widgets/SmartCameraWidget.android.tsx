import { Button, Image, Text } from '@expo/ui/jetpack-compose';
import { cornerRadius, fillMaxSize, size } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget } from 'expo-widgets';

import { type CameraWidgetSnapshot, INITIAL_CAMERA_SNAPSHOT } from './widgetSnapshot';

function SmartCameraWidget(props: CameraWidgetSnapshot) {
  'widget';
  return (
    <Button
      colors={{ containerColor: props.palette.background, contentColor: props.palette.text }}
      modifiers={[fillMaxSize(), cornerRadius(16)]}
    >
      {props.imageUri ? (
        <Image
          source={{ uri: props.imageUri }}
          contentDescription={props.label}
          modifiers={[size(48, 48)]}
        />
      ) : (
        <Text style={{ fontSize: 12 }} color={props.palette.text}>
          {props.label}
        </Text>
      )}
    </Button>
  );
}

export default createWidget('SmartCamera', SmartCameraWidget, INITIAL_CAMERA_SNAPSHOT);
