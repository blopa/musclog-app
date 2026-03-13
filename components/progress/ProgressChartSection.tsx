import { Download, Share2 } from 'lucide-react-native';
import React, { ReactNode } from 'react';
import { Platform, Text, View } from 'react-native';

import { useChartCapture } from '../../hooks/useChartCapture';
import { useTheme } from '../../hooks/useTheme';
import { GenericCard } from '../cards/GenericCard';
import { MenuButton } from '../theme/MenuButton';

interface ProgressChartSectionProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  rightElement?: ReactNode;
}

export function ProgressChartSection({
  title,
  subtitle,
  children,
  rightElement,
}: ProgressChartSectionProps) {
  const theme = useTheme();
  const { captureRef, isCapturing, captureAndShare } = useChartCapture();

  return (
    <>
      <View ref={captureRef} collapsable={false}>
        <GenericCard variant="card">
          <View style={{ padding: 16 }}>
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-lg font-bold text-text-primary">{title}</Text>
                {subtitle ? <Text className="text-xs text-text-tertiary">{subtitle}</Text> : null}
              </View>
              {!isCapturing ? (
                <MenuButton
                  icon={Platform.OS === 'web' ? Download : Share2}
                  size="sm"
                  color={theme.colors.text.tertiary}
                  onPress={() => captureAndShare(title)}
                />
              ) : null}
              {rightElement}
            </View>
            {children}
          </View>
        </GenericCard>
      </View>
      <View style={{ height: 16 }} />
    </>
  );
}
