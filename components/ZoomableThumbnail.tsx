import { ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { ZoomableImageModal } from './ZoomableImageModal';

type ZoomableThumbnailProps = {
  /** The full-size photo to open. When absent the children render as they are, with no press. */
  uri: string | null | undefined;
  /** The existing thumbnail. */
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * Wraps an existing thumbnail so tapping it opens the photo full screen. It owns the viewer's
 * visibility and renders the viewer INSIDE its own tree, so the viewer is always a child of
 * whichever modal or screen holds the thumbnail rather than a sibling of it (the iOS presentation
 * rule `local/no-sibling-modals` exists for), and a call site changes by one wrapper.
 */
export function ZoomableThumbnail({ uri, children, style }: ZoomableThumbnailProps) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);

  if (!uri) {
    return <>{children}</>;
  }

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        accessibilityRole="imagebutton"
        accessibilityLabel={t('imageViewer.open')}
        style={style}
      >
        {children}
      </Pressable>
      {isOpen ? (
        <ZoomableImageModal visible={isOpen} onClose={() => setIsOpen(false)} uri={uri} />
      ) : null}
    </>
  );
}
