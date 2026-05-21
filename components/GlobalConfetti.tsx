import React from 'react';
import { Platform } from 'react-native';

import { useConfettiTrigger } from '@/hooks/useConfettiTrigger';

import ConfettiOverlay from './ConfettiOverlay';

type GlobalConfettiProps = {
  nativeOnly?: boolean;
};

export default function GlobalConfetti({ nativeOnly = false }: GlobalConfettiProps) {
  const { showConfetti } = useConfettiTrigger();

  if (nativeOnly && Platform.OS === 'web') {
    return null;
  }

  return showConfetti ? <ConfettiOverlay /> : null;
}
