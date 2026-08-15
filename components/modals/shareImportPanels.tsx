/**
 * What each share kind puts in the receive screen's `ShareImportPanel`: its preview, the message
 * shown while it saves, the sentence shown once it has, and the buttons that commit it.
 *
 * Everything structural — the layout, the saved/unsaved switch, the spinner — lives in
 * `components/optical/ShareImportPanel.tsx`. Only these differences are per kind. A day share used
 * to be an 80-line early return in front of a structurally identical food/meal block.
 *
 * A `switch` rather than a `Record<MusclogShareKind, …>` because each arm needs its OWN envelope
 * type (a food summary is not a day summary), and narrowing a discriminated union is exactly what a
 * switch does without a cast. It is still exhaustive: both functions return non-optionally with no
 * `default`, so adding a kind fails the build here.
 */

import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { Text } from 'react-native';

import { OpticalFoodSharePreview } from '@/components/optical/OpticalFoodSharePreview';
import { OpticalMealSharePreview } from '@/components/optical/OpticalMealSharePreview';
import { OpticalNutritionDaySharePreview } from '@/components/optical/OpticalNutritionDaySharePreview';
import { Button } from '@/components/theme/Button';
import type { ShareImportRequest, ShareImportResult } from '@/database/share/importShareEnvelope';
import type { MusclogShareEnvelope } from '@/utils/share/shareEnvelope';

import { type ShareSavedSentence, shareSavedSentence } from './shareSavedSentence';

export interface ShareImportPanelContext {
  envelope: MusclogShareEnvelope;
  formatInteger: (value: number) => string;
  /**
   * Opens the destructive confirmation in front of a day share's "replace" action, carrying the
   * request it will commit once confirmed — so the confirmation step never has to re-derive which
   * kind of share it is looking at.
   */
  onRequestReplaceDay: (request: ShareImportRequest) => void;
  /** Commits the import. Each arm below builds the request its own kind needs. */
  onSave: (request: ShareImportRequest) => void;
  result?: ShareImportResult;
  t: TFunction;
}

export interface ShareImportPanelContent {
  actions: ReactNode;
  preview: ReactNode;
  /** Present only once the import has committed. */
  saved?: ShareSavedSentence;
  savingMessage: string;
}

export function resolveShareImportPanel(context: ShareImportPanelContext): ShareImportPanelContent {
  const { envelope, formatInteger, onRequestReplaceDay, onSave, result, t } = context;
  const saved = result ? shareSavedSentence({ envelope, formatInteger, result, t }) : undefined;

  switch (envelope.kind) {
    case 'food':
      return {
        actions: (
          <Button
            label={t('opticalTransfer.share.saveToMyFoods')}
            onPress={() => onSave({ envelope })}
            size="sm"
            variant="accent"
            width="full"
          />
        ),
        preview: <OpticalFoodSharePreview summary={envelope.summary} />,
        saved,
        savingMessage: t('opticalTransfer.share.savingFood'),
      };

    case 'meal':
      return {
        actions: (
          <Button
            label={t('opticalTransfer.share.saveToMyMeals')}
            onPress={() => onSave({ envelope })}
            size="sm"
            variant="accent"
            width="full"
          />
        ),
        preview: <OpticalMealSharePreview summary={envelope.summary} />,
        saved,
        savingMessage: t('opticalTransfer.share.saving'),
      };

    case 'nutritionDay':
      return {
        actions: (
          <>
            {/* Two buttons rather than a toggle plus one: which of these the user wants is the
                whole decision, and neither is safe to preselect — adding to a day that was already
                logged double-counts it, replacing throws away entries they may have typed. */}
            <Text className="text-sm text-text-secondary">
              {t('opticalTransfer.share.dayModeExplainer')}
            </Text>
            <Button
              label={t('opticalTransfer.share.dayAdd')}
              onPress={() => onSave({ dayMode: 'add', envelope })}
              size="sm"
              variant="accent"
              width="full"
            />
            <Button
              label={t('opticalTransfer.share.dayReplace')}
              onPress={() => onRequestReplaceDay({ dayMode: 'replace', envelope })}
              size="sm"
              variant="outline"
              width="full"
            />
          </>
        ),
        preview: <OpticalNutritionDaySharePreview summary={envelope.summary} />,
        saved,
        savingMessage: t('opticalTransfer.share.savingDay'),
      };
  }
}
