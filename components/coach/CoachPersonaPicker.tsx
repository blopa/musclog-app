import { Pencil } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, type ImageSourcePropType, Text, View } from 'react-native';

import { CustomCoachPersonaModal } from '@/components/modals/CustomCoachPersonaModal';
import { ListGroup } from '@/components/theme/ListGroup';
import { ListRow } from '@/components/theme/ListRow';
import {
  COACH_PERSONA_IDS,
  COACH_PRESETS,
  type CoachPersonaId,
  isCustomPersonaComplete,
} from '@/constants/coachPersonas';
import { useCoachPersonaPicker } from '@/hooks/useCoachPersonaPicker';
import { useTheme } from '@/hooks/useTheme';
import { coachAvatarSource } from '@/utils/coachPersonaAvatar';

const AVATAR_PX = 36;

/** A coach's picture as the row's leading element. */
function Avatar({ source }: { source: ImageSourcePropType }) {
  return (
    <Image
      source={source}
      style={{ width: AVATAR_PX, height: AVATAR_PX, borderRadius: AVATAR_PX / 2 }}
      resizeMode="cover"
    />
  );
}

/**
 * Who the coach is: Loggy, a character, or a persona the user wrote. One list for Settings and the
 * onboarding step. It owns its custom-persona editor so the sheet is a child of whatever screen
 * shows the picker, never a sibling modal.
 */
export function CoachPersonaPicker() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { persona, selectPersona } = useCoachPersonaPicker();
  const [isEditorVisible, setIsEditorVisible] = useState(false);

  const customComplete = isCustomPersonaComplete(persona.custom);

  const handlePress = (id: CoachPersonaId) => {
    // A custom coach with no name or voice yet cannot be used, so choosing it opens the editor.
    if (id === 'custom' && !customComplete) {
      setIsEditorVisible(true);
      return;
    }

    void selectPersona(id);
  };

  const titleFor = (id: CoachPersonaId) => {
    if (id !== 'custom') {
      return t(COACH_PRESETS[id].nameKey);
    }

    return customComplete ? persona.custom.name : t('coach.personas.custom.name');
  };

  const subtitleFor = (id: CoachPersonaId) =>
    id === 'custom' ? t('coach.personas.custom.description') : t(COACH_PRESETS[id].descriptionKey);

  return (
    <View className="gap-3">
      <ListGroup>
        {COACH_PERSONA_IDS.map((id) => (
          <ListRow
            key={id}
            variant="grouped"
            title={titleFor(id)}
            subtitle={subtitleFor(id)}
            leading={<Avatar source={coachAvatarSource(id, persona.custom.avatar)} />}
            selected={persona.selectedId === id}
            disabled={!persona.canChoose}
            onPress={() => handlePress(id)}
            testID={`coach-persona-${id}`}
          />
        ))}
        <ListRow
          variant="grouped"
          title={t('coach.personaPicker.editCustom')}
          icon={Pencil}
          disabled={!persona.canChoose}
          onPress={() => setIsEditorVisible(true)}
          testID="coach-persona-edit-custom"
        />
      </ListGroup>

      {!persona.canChoose ? (
        <Text className="text-xs" style={{ color: theme.colors.text.secondary }}>
          {t('coach.personaPicker.onDeviceNote')}
        </Text>
      ) : null}

      <CustomCoachPersonaModal
        visible={isEditorVisible}
        onClose={() => setIsEditorVisible(false)}
      />
    </View>
  );
}
