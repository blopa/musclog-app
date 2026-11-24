import { AISettingsModal } from '@/components/modals/AISettingsModal';
import { SETTINGS } from '@/constants/settingDefinitions';
import { SettingsService } from '@/database/services/SettingsService';
import { useSettings } from '@/hooks/useSettings';

type ConnectedAISettingsModalProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * `AISettingsModal` wired to the stored settings, so Settings and onboarding open the same
 * screen without each repeating the key and model handlers.
 */
export function ConnectedAISettingsModal({ visible, onClose }: ConnectedAISettingsModalProps) {
  const {
    googleGeminiApiKey,
    googleGeminiModel,
    openAiApiKey,
    openAiModel,
    claudeApiKey,
    claudeModel,
    localLlmApiKey,
    localLlmModel,
    localLlmBaseUrl,
  } = useSettings();

  return (
    <AISettingsModal
      visible={visible}
      onClose={onClose}
      googleGeminiApiKey={googleGeminiApiKey}
      onGoogleGeminiApiKeyChange={(value) => SettingsService.setGoogleGeminiApiKey(value)}
      geminiModel={googleGeminiModel}
      onGeminiModelPress={(value) => SettingsService.setGoogleGeminiModel(value)}
      openAiApiKey={openAiApiKey}
      onOpenAiApiKeyChange={(value) => SettingsService.setOpenAiApiKey(value)}
      openAiModel={openAiModel}
      onOpenAiModelPress={(value) => SettingsService.setOpenAiModel(value)}
      claudeApiKey={claudeApiKey}
      onClaudeApiKeyChange={(value) => SettingsService.setClaudeApiKey(value)}
      claudeModel={claudeModel}
      onClaudeModelPress={(value) => SettingsService.set(SETTINGS.claudeModel, value)}
      localLlmApiKey={localLlmApiKey}
      onLocalLlmApiKeyChange={(value) => SettingsService.setLocalLlmApiKey(value)}
      localLlmModel={localLlmModel}
      onLocalLlmModelChange={(value) => SettingsService.setLocalLlmModel(value)}
      localLlmBaseUrl={localLlmBaseUrl}
      onLocalLlmBaseUrlChange={(value) => SettingsService.setLocalLlmBaseUrl(value)}
    />
  );
}
