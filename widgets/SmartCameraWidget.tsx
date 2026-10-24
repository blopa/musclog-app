import { Image, Link } from '@expo/ui/swift-ui';
import {
  accessibilityLabel,
  aspectRatio,
  containerBackground,
  frame,
  resizable,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

import { type CameraWidgetSnapshot, INITIAL_CAMERA_SNAPSHOT } from './widgetSnapshot';

// A shortcut, not a dashboard: like an app icon, the tile is the artwork and nothing else (the
// system already prints the app's name under it). The artwork is drawn for a white page, so the
// tile is white whatever the theme. Until the artwork has been copied to the shared container the
// tile falls back to the accent with a white SF Symbol, which still reads as the camera.
function SmartCameraWidget(props: CameraWidgetSnapshot) {
  'widget';
  const hasArtwork = props.imageUri !== '';
  const fill = frame({ maxWidth: Infinity, maxHeight: Infinity });

  return (
    <Link
      destination={props.url}
      modifiers={[
        containerBackground(hasArtwork ? '#FFFFFF' : props.palette.accent, 'widget'),
        widgetURL(props.url),
        accessibilityLabel(props.label),
      ]}
    >
      {hasArtwork ? (
        <Image
          uiImage={props.imageUri}
          modifiers={[resizable(), aspectRatio({ contentMode: 'fit' }), fill]}
        />
      ) : (
        <Image systemName="barcode.viewfinder" size={64} color="#FFFFFF" modifiers={[fill]} />
      )}
    </Link>
  );
}

export default createWidget('SmartCamera', SmartCameraWidget, INITIAL_CAMERA_SNAPSHOT);
