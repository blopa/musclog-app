import type { DiarySelection } from './foodDiarySelection';

/**
 * What the food diary can do with a set of logs, whoever picked them. A single food, a whole
 * meal section, one grouped meal and a long-press selection are all just a `DiarySelection`
 * (`foodDiarySelection.ts`), so one host (`DiaryActionPanels`) owns the sheets and the writes
 * for all four; only the wording differs, and that is the `DIARY_SCOPE_COPY` table below.
 *
 * Pure, so the table is checked in the Jest `node` project and `check-translations` can read
 * every key (it only sees whole `…Key:` strings, never one assembled inside `t()`).
 */

/** Which surface asked, which decides the wording. */
export type DiaryActionScope = 'selection' | 'food' | 'meal' | 'group';

export type DiaryTransferMode = 'copy' | 'move' | 'split';

/** `combine` exists only for a long-press selection; the others work on any scope. */
export type DiaryPanelKind = DiaryTransferMode | 'scale' | 'combine' | 'delete';

export type DiaryActionRequest = {
  scope: DiaryActionScope;
  panel: DiaryPanelKind;
  /** A snapshot taken when the action was chosen, so it outlives the menu that chose it. */
  selection: DiarySelection;
  /** What a delete confirmation names: the food, the localized meal or the group. */
  subjectName: string;
};

type TransferCopy = {
  /** Sheet title, counted with `{ count }`. Absent: the sheet's own default for the mode. */
  titleKey?: string;
  successKey: string;
};

type DeleteCopy = {
  titleKey: string;
  messageKey: string;
  successKey: string;
  errorKey: string;
  /** Interpolation shared by the title and the message. */
  params: (request: DiaryActionRequest) => Record<string, string | number>;
};

type ScopeCopy = {
  transfer: Record<DiaryTransferMode, TransferCopy>;
  delete: DeleteCopy;
};

/** A transfer fails the same way whoever asked, so these are not per scope. */
export const DIARY_TRANSFER_ERROR_KEYS = {
  copy: 'food.actions.copyError',
  move: 'food.actions.moveError',
  split: 'food.actions.splitError',
} as const satisfies Record<DiaryTransferMode, string>;

const SINGLE_SUBJECT_TRANSFER = {
  copy: { successKey: 'food.actions.copySuccess' },
  move: { successKey: 'food.actions.moveSuccess' },
  split: { successKey: 'food.actions.splitSuccess' },
} as const satisfies Record<DiaryTransferMode, TransferCopy>;

export const DIARY_SCOPE_COPY = {
  selection: {
    transfer: {
      copy: {
        titleKey: 'food.selection.copyModalTitle',
        successKey: 'food.selection.copySuccess',
      },
      move: {
        titleKey: 'food.selection.moveModalTitle',
        successKey: 'food.selection.moveSuccess',
      },
      split: SINGLE_SUBJECT_TRANSFER.split,
    },
    delete: {
      titleKey: 'food.selection.deleteConfirmTitle',
      messageKey: 'food.selection.deleteConfirmMessage',
      successKey: 'food.selection.deleteSuccess',
      errorKey: 'food.actions.deleteAllError',
      params: (request) => ({ count: request.selection.itemCount }),
    },
  },
  food: {
    transfer: {
      ...SINGLE_SUBJECT_TRANSFER,
      split: {
        titleKey: 'food.actions.splitFoodModalTitle',
        successKey: 'food.actions.splitSuccess',
      },
    },
    delete: {
      titleKey: 'food.actions.deleteConfirmTitle',
      messageKey: 'food.actions.deleteConfirmMessage',
      successKey: 'food.actions.deleteSuccess',
      errorKey: 'food.actions.deleteError',
      params: (request) => ({ foodName: request.subjectName }),
    },
  },
  meal: {
    transfer: SINGLE_SUBJECT_TRANSFER,
    delete: {
      titleKey: 'food.actions.deleteAllConfirmTitle',
      messageKey: 'food.actions.deleteAllConfirmMessage',
      successKey: 'food.actions.deleteAllSuccess',
      errorKey: 'food.actions.deleteAllError',
      params: (request) => ({ mealName: request.subjectName }),
    },
  },
  group: {
    transfer: SINGLE_SUBJECT_TRANSFER,
    delete: {
      titleKey: 'food.mealGroup.deleteGroup',
      messageKey: 'food.mealGroup.deleteGroupWarning',
      successKey: 'food.actions.deleteAllSuccess',
      errorKey: 'food.actions.deleteAllError',
      params: () => ({}),
    },
  },
} as const satisfies Record<DiaryActionScope, ScopeCopy>;
