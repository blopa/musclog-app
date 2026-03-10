import React from 'react';
import { FlexWidget, IconWidget } from 'react-native-android-widget';

export function SmartCameraWidget() {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0a1f1a',
        borderRadius: 16,
      }}
      clickAction="OPEN_URI"
      clickActionData={{
        uri: 'com.werules.logger://?action=open-camera',
      }}
    >
      <IconWidget icon="ic_launcher" size={48} font="material"  />
    </FlexWidget>
  );
}
