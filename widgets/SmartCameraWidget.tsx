import { FlexWidget, ImageWidget } from 'react-native-android-widget';

import { darkTheme } from '../theme';

export function SmartCameraWidget() {
  // Use dark theme colors for widget as per requirements.
  // this will not dynamically update if the theme is changed.
  const theme = darkTheme;

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
