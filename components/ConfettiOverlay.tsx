import React from 'react';
import { StyleSheet, View } from 'react-native';

interface ConfettiOverlayProps {
  onAnimationEnd: () => void;
}

const ConfettiOverlay = ({ onAnimationEnd }: ConfettiOverlayProps) => {
  try {
    const { Confetti } = require('react-native-fast-confetti');
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Confetti autoplay={true} onAnimationEnd={onAnimationEnd} />
      </View>
    );
  } catch (e) {
    console.error('Failed to load react-native-fast-confetti', e);
    return null;
  }
};

export default ConfettiOverlay;
