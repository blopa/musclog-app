import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { SmartCameraWidget } from './SmartCameraWidget';

export const widgetTaskHandler = registerWidgetTaskHandler((props) => {
  const { widgetName, widgetAction } = props;

  switch (widgetName) {
    case 'SmartCamera':
      if (widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_UPDATE') {
        props.renderWidget(SmartCameraWidget());
      }
      break;

    default:
      break;
  }
});
