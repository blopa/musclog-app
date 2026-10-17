import { Image, Link, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import { type CameraWidgetSnapshot, INITIAL_CAMERA_SNAPSHOT } from './widgetSnapshot';

function SmartCameraWidget(props: CameraWidgetSnapshot) {
  'widget';
  return (
    <Link
      destination={props.url}
      modifiers={[containerBackground(props.palette.background, 'widget'), widgetURL(props.url)]}
    >
      <VStack spacing={8} modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity })]}>
        {props.imageUri ? (
          <Image uiImage={props.imageUri} modifiers={[frame({ width: 64, height: 64 })]} />
        ) : (
          <Image systemName="camera.fill" size={40} color={props.palette.accent} />
        )}
        <Text modifiers={[font({ size: 12 }), foregroundStyle(props.palette.text)]}>
          {props.label}
        </Text>
      </VStack>
    </Link>
  );
}

export default createWidget('SmartCamera', SmartCameraWidget, INITIAL_CAMERA_SNAPSHOT);
