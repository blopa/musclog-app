import {
  Copy,
  History,
  Pencil,
  Sparkles,
  StickyNote,
  Trash2,
  UtensilsCrossed,
} from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { BottomPopUpMenu, type BottomPopUpMenuItem } from '@/components/BottomPopUpMenu';
import { NoteCard } from '@/components/cards/NoteCard';
import { NoteRow } from '@/components/cards/NoteRow';
import { useCoach } from '@/components/CoachContext';
import { GradientText } from '@/components/GradientText';
import { MasterLayout } from '@/components/MasterLayout';
import { ConfirmationModal } from '@/components/modals/ConfirmationModal';
import { GenericEditModal } from '@/components/modals/GenericEditModal';
import type { EditFieldConfig, EditFormValues } from '@/components/modals/GenericEditModal/types';
import { AnimatedContent } from '@/components/theme/AnimatedContent';
import { Button } from '@/components/theme/Button';
import { EmptyStateCard } from '@/components/theme/EmptyStateCard';
import { MenuButton } from '@/components/theme/MenuButton';
import { TRACK_MEAL } from '@/constants/chat';
import type Note from '@/database/models/Note';
import { NoteService } from '@/database/services/NoteService';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { LATEST_NOTE_COUNT, useNotes } from '@/hooks/useNotes';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from '@/hooks/useTheme';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import { handleError } from '@/utils/handleError';
import { showSnackbar } from '@/utils/snackbarService';

const NOTE_FIELDS: EditFieldConfig[] = [
  {
    key: 'title',
    type: 'text',
    label: 'notes.form.titleLabel',
    placeholder: 'notes.form.titlePlaceholder',
  },
  {
    key: 'body',
    type: 'text',
    label: 'notes.form.bodyLabel',
    placeholder: 'notes.form.bodyPlaceholder',
    required: true,
    multiline: true,
    validate: (value) =>
      typeof value === 'string' && value.trim().length > 0 ? null : 'notes.form.bodyRequired',
  },
];

export default function NotesScreen() {
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { openCoach } = useCoach();
  const { isAiConfigured } = useSettings();
  const dateFnsLocale = useDateFnsLocale();
  const { notes, isLoading, hasMore, loadMore } = useNotes();

  const [isScreenMenuVisible, setIsScreenMenuVisible] = useState(false);
  const [activeMenuNote, setActiveMenuNote] = useState<Note | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isCreateVisible, setIsCreateVisible] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  const latest = notes.slice(0, LATEST_NOTE_COUNT);
  const earlier = notes.slice(LATEST_NOTE_COUNT);

  const relativeTimeFor = useCallback(
    (timestamp: number) =>
      formatRelativeTime(timestamp, {
        t,
        locale: i18n.resolvedLanguage ?? i18n.language,
        dateFnsLocale,
      }),
    [t, i18n.resolvedLanguage, i18n.language, dateFnsLocale]
  );

  const handleTrackNote = useCallback(
    (note: Note) => {
      const composerText = note.title ? `${note.title}\n${note.body}` : note.body;
      openCoach({ composerText, intention: TRACK_MEAL });
    },
    [openCoach]
  );

  const handleDuplicateNote = useCallback(
    async (note: Note) => {
      try {
        await NoteService.duplicateNote(note.id);
        showSnackbar('success', t('notes.duplicateSuccess'));
      } catch (error) {
        await handleError(error, 'NotesScreen.handleDuplicateNote', {
          snackbarMessage: t('notes.duplicateError'),
        });
      }
    },
    [t]
  );

  // ConfirmationModal closes itself once this resolves — do not clear noteToDelete here.
  const handleConfirmDelete = useCallback(async () => {
    if (!noteToDelete) {
      return;
    }

    try {
      await NoteService.deleteNote(noteToDelete.id);
      showSnackbar('success', t('notes.deleteSuccess'));
    } catch (error) {
      await handleError(error, 'NotesScreen.handleConfirmDelete', {
        snackbarMessage: t('notes.deleteError'),
      });
    }
  }, [noteToDelete, t]);

  const handleSaveNote = useCallback(
    async (values: EditFormValues) => {
      const title = typeof values.title === 'string' ? values.title : '';
      const body = typeof values.body === 'string' ? values.body : '';

      try {
        if (editingNote) {
          await NoteService.updateNote(editingNote.id, { title, body });
          showSnackbar('success', t('notes.updateSuccess'));
        } else {
          await NoteService.createNote({ title, body });
          showSnackbar('success', t('notes.createSuccess'));
        }

        setEditingNote(null);
        setIsCreateVisible(false);
      } catch (error) {
        await handleError(error, 'NotesScreen.handleSaveNote', {
          snackbarMessage: editingNote ? t('notes.updateError') : t('notes.createError'),
        });
      }
    },
    [editingNote, t]
  );

  const closeEditModal = useCallback(() => {
    setEditingNote(null);
    setIsCreateVisible(false);
  }, []);

  // Memoized: GenericEditModal resets its form from initialValues in a [visible, initialValues]
  // effect, so an inline literal would wipe the form on every parent render.
  const editInitialValues = useMemo<EditFormValues>(
    () => ({ title: editingNote?.title ?? '', body: editingNote?.body ?? '' }),
    [editingNote]
  );

  const noteMenuItems = useMemo<BottomPopUpMenuItem[]>(() => {
    if (!activeMenuNote) {
      return [];
    }

    const note = activeMenuNote;

    return [
      {
        icon: Pencil,
        iconColor: theme.colors.accent.primary,
        iconBgColor: theme.colors.accent.primary10,
        title: t('notes.noteMenu.edit'),
        description: t('notes.noteMenu.editDescription'),
        onPress: () => setEditingNote(note),
      },
      {
        icon: Copy,
        iconColor: theme.colors.accent.primary,
        iconBgColor: theme.colors.accent.primary10,
        title: t('notes.noteMenu.duplicate'),
        description: t('notes.noteMenu.duplicateDescription'),
        onPress: () => void handleDuplicateNote(note),
      },
      // Hidden entirely when no AI provider is set up — "Track this" only leads to the coach's
      // meal-tracking flow, so offering it would dead-end. Same gating as the AI meal actions in
      // app/app/nutrition/food.tsx.
      ...(isAiConfigured
        ? [
            {
              icon: UtensilsCrossed,
              iconColor: theme.colors.accent.primary,
              iconBgColor: theme.colors.accent.primary10,
              title: t('notes.noteMenu.track'),
              description: t('notes.noteMenu.trackDescription'),
              onPress: () => handleTrackNote(note),
            },
          ]
        : []),
      {
        icon: Trash2,
        iconColor: theme.colors.status.error,
        iconBgColor: theme.colors.status.error10,
        titleColor: theme.colors.status.error,
        title: t('notes.noteMenu.delete'),
        description: t('notes.noteMenu.deleteDescription'),
        onPress: () => setNoteToDelete(note),
      },
    ];
  }, [activeMenuNote, handleDuplicateNote, handleTrackNote, isAiConfigured, t, theme]);

  return (
    <MasterLayout>
      <KeyboardAwareScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        bottomOffset={16}
      >
        <AnimatedContent>
          <View className="px-4 py-6">
            <View className="flex-row items-center justify-between">
              <GradientText
                colors={theme.colors.gradients.workoutsTitle}
                style={{
                  fontSize: theme.typography.fontSize['4xl'],
                  fontWeight: theme.typography.fontWeight.bold,
                }}
              >
                {t('notes.title')}
              </GradientText>
              <MenuButton onPress={() => setIsScreenMenuVisible(true)} />
            </View>
          </View>

          <View className="px-4">
            {!isLoading && notes.length === 0 ? (
              <EmptyStateCard
                icon={StickyNote}
                title={t('emptyStates.notes.title')}
                description={t('emptyStates.notes.description')}
                buttonLabel={t('emptyStates.notes.buttonLabel')}
                iconGradient={true}
                buttonVariant="gradientCta"
                onButtonPress={() => setIsCreateVisible(true)}
              />
            ) : null}

            {latest.length > 0 ? (
              <View className="mb-8">
                <View className="mb-4 flex-row items-center gap-2">
                  <Sparkles size={theme.iconSize.sm} color={theme.colors.text.secondary} />
                  <Text className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                    {t('notes.sections.latest')}
                  </Text>
                </View>
                <View className="flex-row gap-3">
                  {latest.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      relativeTime={relativeTimeFor(note.createdAt)}
                      onPress={() => setEditingNote(note)}
                      onMenuPress={() => setActiveMenuNote(note)}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {earlier.length > 0 ? (
              <View>
                <View className="mb-4 flex-row items-center gap-2">
                  <History size={theme.iconSize.sm} color={theme.colors.text.secondary} />
                  <Text className="text-sm font-semibold uppercase tracking-wider text-text-secondary">
                    {t('notes.sections.earlier')}
                  </Text>
                </View>
                <View className="gap-3">
                  {earlier.map((note) => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      relativeTime={relativeTimeFor(note.createdAt)}
                      onPress={() => setEditingNote(note)}
                      onMenuPress={() => setActiveMenuNote(note)}
                    />
                  ))}
                </View>

                {hasMore ? (
                  <View className="items-center pt-6">
                    <Button
                      label={t('common.loadMore')}
                      variant="outline"
                      size="sm"
                      width="auto"
                      onPress={loadMore}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          <View className="h-20" />
        </AnimatedContent>
      </KeyboardAwareScrollView>

      <BottomPopUpMenu
        visible={isScreenMenuVisible}
        onClose={() => setIsScreenMenuVisible(false)}
        title={t('notes.screenMenu.title')}
        subtitle={t('notes.screenMenu.subtitle')}
        items={[
          {
            icon: StickyNote,
            iconColor: theme.colors.accent.primary,
            iconBgColor: theme.colors.accent.primary10,
            title: t('notes.screenMenu.create'),
            description: t('notes.screenMenu.createDescription'),
            onPress: () => setIsCreateVisible(true),
          },
        ]}
      />

      <BottomPopUpMenu
        visible={activeMenuNote != null}
        onClose={() => setActiveMenuNote(null)}
        title={t('notes.noteMenu.title')}
        items={noteMenuItems}
      />

      <GenericEditModal
        visible={isCreateVisible || editingNote != null}
        onClose={closeEditModal}
        title={editingNote ? t('notes.form.editTitle') : t('notes.form.createTitle')}
        fields={NOTE_FIELDS}
        initialValues={editInitialValues}
        onSave={handleSaveNote}
        submitLabel={t('notes.form.submit')}
      />

      <ConfirmationModal
        visible={noteToDelete != null}
        onClose={() => setNoteToDelete(null)}
        onConfirm={handleConfirmDelete}
        title={t('notes.deleteConfirm.title')}
        message={t('notes.deleteConfirm.message')}
        confirmLabel={t('notes.deleteConfirm.confirm')}
        variant="destructive"
      />
    </MasterLayout>
  );
}
