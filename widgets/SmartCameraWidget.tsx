import { type ColorProp, FlexWidget, ImageWidget } from 'react-native-android-widget';

import { theme } from '../theme';

export function SmartCameraWidget() {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: theme.colors.background.primary as ColorProp,
        borderRadius: theme.borderRadius.xl,
      }}
      clickAction="OPEN_URI"
      clickActionData={{
        uri: 'com.werules.logger://?action=open-camera',
      }}
    >
      <ImageWidget image={require('../assets/logo.png')} imageWidth={256} imageHeight={256} />
    </FlexWidget>
  );
}
