/**
 * Optical transfer — the small card a camera screen floats over its feed to say something about
 * the transfer without taking the feed away.
 *
 * Shared by the two screens that need it for opposite reasons: the receive screen shows it when
 * nothing has decoded for a while, and the food barcode scanners show it when something HAS
 * decoded and it turned out to be a fountain frame rather than a barcode. Extracted so those two
 * cannot drift apart visually — a user who has seen one should recognise the other instantly.
 *
 * Positioning is deliberately the caller's: the receive screen floats this over a full-bleed
 * camera (`absolute inset-x-4 bottom-4`), while `SmartCameraShell` stacks it in flow above its
 * bottom controls, where an absolute card would sit on top of the shutter.
 */

import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

interface OpticalCameraHintCardProps {
  title: string;
  message: string;
  /** An extra line in the warning colour, under the message. */
  warning?: string;
  /** The action row. Buttons at `size="xs"` fit two across at this width. */
  children?: ReactNode;
  className?: string;
}

export function OpticalCameraHintCard({
  children,
  className,
  message,
  title,
  warning,
}: OpticalCameraHintCardProps) {
  const theme = useTheme();

  return (
    <View
      className={`gap-2 rounded-xl p-4 ${className ?? ''}`}
      style={{ backgroundColor: theme.colors.background.card }}
    >
      <Text className="font-bold text-text-primary">{title}</Text>
      <Text className="text-xs text-text-secondary">{message}</Text>
      {warning ? (
        <Text className="text-xs" style={{ color: theme.colors.status.warning }}>
          {warning}
        </Text>
      ) : null}
      {children}
    </View>
  );
}
