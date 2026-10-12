import { Share2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSnackbar } from '@/context/SnackbarContext';
import { shareImage } from '@/utils/shareImage';

import {
  clampTranslation,
  doubleTapTargetScale,
  isAtRest,
  MIN_SCALE,
  shouldDismissOnSwipe,
  zoomAroundPoint,
} from './zoomableImageMath';

type ZoomableImageModalProps = {
  visible: boolean;
  onClose: () => void;
  uri: string;
};

const SPRING = { damping: 20, stiffness: 220 } as const;

/**
 * A full-screen photo viewer: pinch to zoom (1×–5×), drag to pan, double-tap to jump between fitted
 * and 2.5×, swipe down while fitted to close. The geometry is `zoomableImageMath.ts`; this file is
 * only gestures and layout. Sharing goes through the system share sheet (`shareImage`), which is
 * also how a photo gets saved to the device — see that file for why it is not a media-library write.
 */
export function ZoomableImageModal({ visible, onClose, uri }: ZoomableImageModalProps) {
  const { t } = useTranslation();
  const { showSnackbar } = useSnackbar();
  const insets = useSafeAreaInsets();
  const [isSharing, setIsSharing] = useState(false);

  const viewportW = useSharedValue(1);
  const viewportH = useSharedValue(1);
  const scale = useSharedValue(MIN_SCALE);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedScale = useSharedValue(MIN_SCALE);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const dismissProgress = useSharedValue(0);

  const reset = () => {
    scale.value = MIN_SCALE;
    tx.value = 0;
    ty.value = 0;
    dismissProgress.value = 0;
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleShare = async () => {
    setIsSharing(true);
    const result = await shareImage(uri);
    setIsSharing(false);
    if (result === 'failed') {
      showSnackbar('error', t('imageViewer.shareFailed'));
    } else if (result === 'unavailable') {
      showSnackbar('error', t('imageViewer.shareUnavailable'));
    }
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((event) => {
      const viewport = { width: viewportW.value, height: viewportH.value };
      const next = zoomAroundPoint(
        { scale: savedScale.value, translation: { x: savedTx.value, y: savedTy.value } },
        savedScale.value * event.scale,
        { x: event.focalX - viewport.width / 2, y: event.focalY - viewport.height / 2 },
        viewport,
        viewport
      );
      scale.value = next.scale;
      tx.value = next.translation.x;
      ty.value = next.translation.y;
    })
    .onEnd(() => {
      if (isAtRest(scale.value)) {
        scale.value = withSpring(MIN_SCALE, SPRING);
        tx.value = withSpring(0, SPRING);
        ty.value = withSpring(0, SPRING);
      }
    });

  const pan = Gesture.Pan()
    .maxPointers(1)
    .onStart(() => {
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    })
    .onUpdate((event) => {
      const viewport = { width: viewportW.value, height: viewportH.value };
      if (isAtRest(scale.value)) {
        // Fitted: a downward drag is the start of "swipe to close", sideways drags do nothing.
        ty.value = Math.max(0, event.translationY);
        dismissProgress.value = Math.min(1, ty.value / 400);
        return;
      }
      const next = clampTranslation(
        { x: savedTx.value + event.translationX, y: savedTy.value + event.translationY },
        scale.value,
        viewport,
        viewport
      );
      tx.value = next.x;
      ty.value = next.y;
    })
    .onEnd((event) => {
      if (shouldDismissOnSwipe(event.translationY, scale.value)) {
        runOnJS(handleClose)();
        return;
      }
      if (isAtRest(scale.value)) {
        ty.value = withSpring(0, SPRING);
        dismissProgress.value = withTiming(0);
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      const viewport = { width: viewportW.value, height: viewportH.value };
      const next = zoomAroundPoint(
        { scale: scale.value, translation: { x: tx.value, y: ty.value } },
        doubleTapTargetScale(scale.value),
        { x: event.x - viewport.width / 2, y: event.y - viewport.height / 2 },
        viewport,
        viewport
      );
      scale.value = withTiming(next.scale, { duration: 200 });
      tx.value = withTiming(next.translation.x, { duration: 200 });
      ty.value = withTiming(next.translation.y, { duration: 200 });
    });

  const gesture = Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan));

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: 1 - dismissProgress.value * 0.6 }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      onDismiss={reset}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]} />
        <GestureDetector gesture={gesture}>
          <Animated.View
            style={styles.stage}
            onLayout={(event) => {
              viewportW.value = event.nativeEvent.layout.width;
              viewportH.value = event.nativeEvent.layout.height;
            }}
          >
            <Animated.View style={[styles.imageBox, imageStyle]}>
              <Image source={{ uri }} style={styles.image} resizeMode="contain" />
            </Animated.View>
          </Animated.View>
        </GestureDetector>

        <View style={[styles.controls, { top: insets.top + 12 }]} pointerEvents="box-none">
          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t('imageViewer.close')}
            style={styles.control}
            hitSlop={8}
            testID="image-viewer-close"
          >
            <X size={22} color="#fff" />
          </Pressable>
          <Pressable
            onPress={handleShare}
            disabled={isSharing}
            accessibilityRole="button"
            accessibilityLabel={t('imageViewer.save')}
            style={[styles.control, isSharing ? styles.controlDisabled : null]}
            hitSlop={8}
            testID="image-viewer-save"
          >
            <Share2 size={20} color="#fff" />
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

// The viewer is black-on-white-controls whatever the theme: a photo is judged against black.
const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { backgroundColor: '#000' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageBox: { width: '100%', height: '100%' },
  image: { width: '100%', height: '100%' },
  controls: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  control: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  controlDisabled: { opacity: 0.5 },
});
