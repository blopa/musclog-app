import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { SmartCameraWidget } from './SmartCameraWidget';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetInfo, widgetAction } = props;

  switch (widgetInfo.widgetName) {
    case 'SmartCamera':
      if (widgetAction === 'WIDGET_ADDED' || widgetAction === 'WIDGET_UPDATE') {
        props.renderWidget(SmartCameraWidget());
      }
      break;

    default:
      break;
  }
}
