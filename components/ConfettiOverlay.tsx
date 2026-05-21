import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Confetti } from 'react-native-fast-confetti';

const ConfettiOverlay = () => {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Confetti autoplay={true} />
    </View>
  );
};

export default ConfettiOverlay;
