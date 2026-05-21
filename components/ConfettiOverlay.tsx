import React from 'react';
import { StyleSheet, View } from 'react-native';

const ConfettiOverlay = () => {
  try {
    const { Confetti } = require('react-native-fast-confetti');
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Confetti autoplay={true} />
      </View>
    );
  } catch (e) {
    console.error('Failed to load react-native-fast-confetti', e);
    return null;
  }
};

export default ConfettiOverlay;
