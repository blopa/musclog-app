import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Confetti } from 'react-native-fast-confetti';

const ConfettiOverlay = () => {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* The library halves the particle count under reduced motion; a factor of 1 drops it. */}
      <Confetti autoplay={true} gravity={0.5} reduceMotion={{ mode: 'system', factor: 1 }} />
    </View>
  );
};

export default ConfettiOverlay;
