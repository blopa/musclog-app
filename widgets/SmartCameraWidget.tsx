import { Image, Link, RoundedRectangle, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  minimumScaleFactor,
  opacity,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import { type CameraWidgetSnapshot, INITIAL_CAMERA_SNAPSHOT } from './widgetSnapshot';

// iOS draws the shortcut from an SF Symbol rather than the bitmap Android uses, so it follows the
// theme accent and never depends on a file in the shared container being readable.
function SmartCameraWidget(props: CameraWidgetSnapshot) {
  'widget';
  const { palette } = props;
  return (
    <Link
      destination={props.url}
      modifiers={[containerBackground(palette.background, 'widget'), widgetURL(props.url)]}
    >
      <VStack
        alignment="leading"
        spacing={0}
        modifiers={[frame({ maxWidth: Infinity, maxHeight: Infinity, alignment: 'leading' })]}
      >
        <ZStack alignment="center" modifiers={[frame({ width: 52, height: 52 })]}>
          <RoundedRectangle
            cornerRadius={16}
            modifiers={[foregroundStyle(palette.accent), opacity(0.16)]}
          />
          <Image systemName="barcode.viewfinder" size={28} color={palette.accent} />
        </ZStack>
        <Spacer />
        <Text
          modifiers={[
            font({ size: 17, weight: 'bold', design: 'rounded' }),
            foregroundStyle(palette.text),
            lineLimit(2),
            minimumScaleFactor(0.8),
          ]}
        >
          {props.label}
        </Text>
      </VStack>
    </Link>
  );
}

export default createWidget('SmartCamera', SmartCameraWidget, INITIAL_CAMERA_SNAPSHOT);
