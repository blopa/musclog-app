import { LinearGradient } from 'expo-linear-gradient';
import { FileText, type LucideIcon, ScanBarcode, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import type { CameraMode } from '@/constants/camera';
import { useTheme } from '@/hooks/useTheme';

type ModePickerTabProps = {
  mode: CameraMode;
  activeMode: CameraMode;
  icon: LucideIcon;
  label: string;
  disabled: boolean;
  isSmallScreen: boolean;
  onSelect: (mode: CameraMode) => void;
};

function ModePickerTab({
  mode,
  activeMode,
  icon: Icon,
  label,
  disabled,
  isSmallScreen,
  onSelect,
}: ModePickerTabProps) {
  const theme = useTheme();
  const isActive = mode === activeMode;
  const color = isActive ? theme.colors.text.primary : theme.colors.text.secondary;

  return (
    <Pressable
      onPress={() => onSelect(mode)}
      disabled={disabled}
      className="flex-1 rounded-xl px-2"
      style={[
        {
          overflow: 'hidden',
          paddingVertical: isSmallScreen ? 8 : 10,
          opacity: disabled ? theme.colors.opacity.medium : 1,
        },
        isActive ? { backgroundColor: 'transparent' } : {},
      ]}
    >
      {isActive ? (
        <LinearGradient
          colors={theme.colors.gradients.cta}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: theme.borderRadius.md,
            overflow: 'hidden',
          }}
        />
      ) : null}
      <View className="flex-row items-center justify-center gap-1.5">
        <Icon size={theme.iconSize.md} color={color} />
        {!isSmallScreen ? (
          <Text
            className="font-bold uppercase tracking-wide"
            style={{ fontSize: theme.typography.fontSize.xs, color }}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

type SmartCameraModePickerProps = {
  cameraMode: CameraMode;
  disabled: boolean;
  isSmallScreen: boolean;
  /** Meal photo is a vision-model capability, so its tab only exists when vision is available. */
  isAIVisionEnabled: boolean;
  onModeChange: (mode: CameraMode) => void;
};

/** The three-tab capture-mode selector above the shutter row. */
export function SmartCameraModePicker({
  cameraMode,
  disabled,
  isSmallScreen,
  isAIVisionEnabled,
  onModeChange,
}: SmartCameraModePickerProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const tabs: { mode: CameraMode; icon: LucideIcon; label: string }[] = [
    { icon: ScanBarcode, label: t('food.aiCamera.modes.barcodeScan'), mode: 'barcode-scan' },
    { icon: FileText, label: t('food.aiCamera.modes.labelScan'), mode: 'ai-label-scan' },
    ...(isAIVisionEnabled
      ? [
          {
            icon: Sparkles,
            label: t('food.aiCamera.modes.mealPhoto'),
            mode: 'ai-meal-photo' as const,
          },
        ]
      : []),
  ];

  return (
    <View className={isSmallScreen ? 'mb-3 w-full items-center' : 'mb-6 w-full items-center'}>
      <View
        className="w-full max-w-sm flex-row items-stretch justify-between rounded-2xl p-1.5"
        style={{
          backgroundColor: theme.colors.background.neutralWash,
          borderWidth: theme.borderWidth.thin,
          borderColor: theme.colors.background.ink10,
        }}
      >
        {tabs.map((tab) => (
          <ModePickerTab
            activeMode={cameraMode}
            disabled={disabled}
            icon={tab.icon}
            isSmallScreen={isSmallScreen}
            key={tab.mode}
            label={tab.label}
            mode={tab.mode}
            onSelect={onModeChange}
          />
        ))}
      </View>
    </View>
  );
}
