import { FlexWidget, ImageWidget } from 'react-native-android-widget';

import { type Theme } from '@/theme';

interface SmartCameraWidgetProps {
  theme: Theme;
}

export function SmartCameraWidget({ theme }: SmartCameraWidgetProps) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
        // backgroundColor: theme.colors.background.primary as ColorProp,
        borderRadius: theme.borderRadius.xl,
      }}
      clickAction="OPEN_URI"
      clickActionData={{
        uri: 'com.werules.logger://?action=open-camera',
      }}
    >
      <ImageWidget
        image={require('../assets/camera-widget.png')}
        imageWidth={256}
        imageHeight={256}
      />
    </FlexWidget>
  );
}
