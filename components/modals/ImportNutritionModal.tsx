import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../hooks/useTheme';
import { showSnackbar } from '../../utils/snackbarService';
import { FullScreenModal } from './FullScreenModal';

type ImportNutritionModalProps = {
  visible: boolean;
  onClose: () => void;
  onNutritionImported?: (entries: any[]) => void;
};

// TODO: improve UI, remove mocked data and implement usage of this component
export function ImportNutritionModal({
  visible,
  onClose,
  onNutritionImported,
}: ImportNutritionModalProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [rawText, setRawText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleProcessText = useCallback(async () => {
    if (!rawText.trim()) {
      showSnackbar('error', t('nutrition.emptyData'));
      return;
    }

    setIsProcessing(true);
    try {
      // TODO: Implement full flow with AI
      // 1. Get AI config from settings
      // 2. Call parsePastNutrition(config, rawText)
      // 3. Show confirmation modal with parsed entries
      // 4. On confirm, save entries via NutritionService

      console.log('[ImportNutrition] Processing raw nutrition data...');
      console.log('[ImportNutrition] Raw text:', rawText);

      showSnackbar('success', t('nutrition.processingData'));
    } catch (error) {
      console.error('[ImportNutrition] Error:', error);
      showSnackbar('error', t('nutrition.processingFailed'));
    } finally {
      setIsProcessing(false);
    }
  }, [rawText, t]);

  const handleClose = useCallback(() => {
    setRawText('');
    onClose();
  }, [onClose]);

  return (
    <FullScreenModal
      visible={visible}
      onClose={handleClose}
      title={t('nutrition.importNutrition')}
      scrollable={false}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        style={{ paddingBottom: insets.bottom }}
      >
        <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1 }}>
          <View className="flex-1 px-4 py-6">
            {/* Instructions */}
            <Text className="mb-4 text-sm text-text-secondary">
              {t('nutrition.importInstructions')}
            </Text>

            {/* Text Input */}
            <TextInput
              value={rawText}
              onChangeText={setRawText}
              placeholder={t('nutrition.pasteNutritionDataPlaceholder')}
              placeholderTextColor={theme.colors.text.tertiary}
              multiline
              numberOfLines={8}
              className="mb-4 rounded-lg p-4 text-base text-text-primary"
              style={{
                backgroundColor: theme.colors.background.card,
                borderWidth: theme.borderWidth.thin,
                borderColor: theme.colors.border.light,
                textAlignVertical: 'top',
              }}
              editable={!isProcessing}
            />

            {/* Format Info */}
            <View className="mb-6 rounded-lg bg-amber-500/10 p-4">
              <Text className="mb-2 text-xs font-semibold text-amber-600">
                {t('nutrition.supportedFormats')}
              </Text>
              <Text className="text-xs text-text-secondary">{t('nutrition.importFormatInfo')}</Text>
            </View>

            {/* Character Count */}
            <Text className="mb-4 text-xs text-text-tertiary">
              {t('nutrition.characters')}: {rawText.length}
            </Text>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View className="border-t px-4 py-4" style={{ borderColor: theme.colors.border.light }}>
          <Pressable
            onPress={handleProcessText}
            disabled={!rawText.trim() || isProcessing}
            className="mb-2 rounded-lg px-4 py-3"
            style={{
              backgroundColor: theme.colors.accent.primary,
              opacity: !rawText.trim() || isProcessing ? 0.5 : 1,
            }}
          >
            {isProcessing ? (
              <View className="flex-row items-center justify-center gap-2">
                <ActivityIndicator color={theme.colors.text.black} size="small" />
                <Text className="font-semibold" style={{ color: theme.colors.text.black }}>
                  {t('nutrition.processing')}
                </Text>
              </View>
            ) : (
              <Text
                className="text-center font-semibold"
                style={{ color: theme.colors.text.black }}
              >
                {t('nutrition.import')}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleClose}
            disabled={isProcessing}
            className="rounded-lg border px-4 py-3"
            style={{
              borderColor: theme.colors.border.light,
              opacity: isProcessing ? 0.5 : 1,
            }}
          >
            <Text className="text-center font-semibold text-text-primary">
              {t('common.cancel')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </FullScreenModal>
  );
}
