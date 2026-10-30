import { ImagePlus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Text, View } from 'react-native';

import { BottomPopUp } from '@/components/BottomPopUp';
import { Button } from '@/components/theme/Button';
import { TextInput } from '@/components/theme/TextInput';
import {
  CUSTOM_PERSONA_NAME_MAX,
  CUSTOM_PERSONA_VOICE_MAX,
  type CustomCoachPersona,
} from '@/constants/coachPersonas';
import { useCoachPersonaPicker } from '@/hooks/useCoachPersonaPicker';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';
import { useTheme } from '@/hooks/useTheme';
import { coachAvatarSource } from '@/utils/coachPersonaAvatar';
import { validateInputSafety } from '@/utils/promptSanitizer';

type CustomCoachPersonaModalProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Where the user writes their own coach: a name, how it talks, and an avatar. Render it INSIDE the
 * screen or modal that opens it, never beside another modal (`local/no-sibling-modals`).
 */
export function CustomCoachPersonaModal({ visible, onClose }: CustomCoachPersonaModalProps) {
  const { t } = useTranslation();

  return (
    <BottomPopUp visible={visible} onClose={onClose} title={t('coach.personaPicker.custom.title')}>
      {/* Mounted only while open, so each opening starts from what is stored and typing never writes
          until Save — and a change to the stored persona cannot overwrite what is being typed. */}
      {visible ? <CustomCoachPersonaForm onClose={onClose} /> : null}
    </BottomPopUp>
  );
}

function CustomCoachPersonaForm({ onClose }: Pick<CustomCoachPersonaModalProps, 'onClose'>) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { formatInteger } = useFormatAppNumber();
  const { persona, saveCustomPersona, pickAvatar } = useCoachPersonaPicker();

  const [draft, setDraft] = useState<CustomCoachPersona>(persona.custom);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isIncomplete = !draft.name.trim() || !draft.voice.trim();

  const handlePickAvatar = async () => {
    const avatar = await pickAvatar();
    if (avatar) {
      setDraft((current) => ({ ...current, avatar }));
    }
  };

  const handleSave = async () => {
    // The voice and the name both end up in a system prompt, so they get the same injection check
    // as every other piece of user text sent to a model.
    if (!validateInputSafety(draft.name).isSafe || !validateInputSafety(draft.voice).isSafe) {
      setError(t('coach.personaPicker.custom.errorUnsafe'));
      return;
    }

    setError(null);
    setIsSaving(true);
    const saved = await saveCustomPersona(draft);
    setIsSaving(false);

    if (saved) {
      onClose();
    }
  };

  return (
    <View className="gap-6 p-6">
      <View className="flex-row items-center gap-4">
        <Image
          source={coachAvatarSource('custom', draft.avatar)}
          style={{
            width: theme.size['16'],
            height: theme.size['16'],
            borderRadius: theme.borderRadius.full,
          }}
          resizeMode="cover"
        />
        <View className="flex-1 gap-2">
          <Button
            label={
              draft.avatar
                ? t('coach.personaPicker.custom.avatarChange')
                : t('coach.personaPicker.custom.avatarPick')
            }
            onPress={handlePickAvatar}
            variant="outline"
            icon={ImagePlus}
          />
          {draft.avatar ? (
            <Button
              label={t('coach.personaPicker.custom.avatarRemove')}
              onPress={() => setDraft((current) => ({ ...current, avatar: '' }))}
              variant="outline"
              icon={Trash2}
            />
          ) : null}
        </View>
      </View>

      <TextInput
        label={t('coach.personaPicker.custom.nameLabel')}
        value={draft.name}
        onChangeText={(name) => setDraft((current) => ({ ...current, name }))}
        placeholder={t('coach.personaPicker.custom.namePlaceholder')}
        maxLength={CUSTOM_PERSONA_NAME_MAX}
        required
      />

      <View className="gap-2">
        <TextInput
          label={t('coach.personaPicker.custom.voiceLabel')}
          value={draft.voice}
          onChangeText={(voice) => setDraft((current) => ({ ...current, voice }))}
          placeholder={t('coach.personaPicker.custom.voicePlaceholder')}
          multiline
          numberOfLines={5}
          maxLength={CUSTOM_PERSONA_VOICE_MAX}
          required
        />
        <Text className="text-xs tabular-nums" style={{ color: theme.colors.text.tertiary }}>
          {t('coach.personaPicker.custom.voiceCount', {
            count: formatInteger(draft.voice.length),
            max: formatInteger(CUSTOM_PERSONA_VOICE_MAX),
          })}
        </Text>
      </View>

      <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
        {t('coach.personaPicker.custom.hint')}
      </Text>

      {error ? (
        <Text className="text-sm" style={{ color: theme.colors.status.error }}>
          {error}
        </Text>
      ) : null}

      <View className="mb-4 mt-2 flex-row gap-4">
        <Button label={t('common.cancel')} onPress={onClose} variant="outline" width="flex-1" />
        <Button
          label={t('common.save')}
          onPress={handleSave}
          disabled={isIncomplete || isSaving}
          variant="accent"
          width="flex-1"
        />
      </View>
    </View>
  );
}
