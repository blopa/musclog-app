import React from 'react';
import { FlexWidget, ImageWidget } from 'react-native-android-widget';

export function SmartCameraWidget() {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
        // TODO: use the color from theme
        backgroundColor: '#0a1f1a',
        borderRadius: 16,
      }}
      clickAction="OPEN_URI"
      clickActionData={{
        uri: 'com.werules.logger://?action=open-camera',
      }}
    >
      <ImageWidget image={require('../assets/icon-square.png')} imageWidth={384} imageHeight={384} />
    </FlexWidget>
  );
}
