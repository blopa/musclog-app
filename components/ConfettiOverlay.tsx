import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';

interface ConfettiOverlayProps {
  onAnimationEnd: () => void;
}

const ConfettiOverlay = ({ onAnimationEnd }: ConfettiOverlayProps) => {
  try {
    const { Confetti } = require('react-native-fast-confetti');
    return (
      <Modal transparent animationType="none" visible statusBarTranslucent>
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Confetti autoplay={true} onAnimationEnd={onAnimationEnd} />
        </View>
      </Modal>
    );
  } catch (e) {
    console.error('Failed to load react-native-fast-confetti', e);
    return null;
  }
};

export default ConfettiOverlay;
