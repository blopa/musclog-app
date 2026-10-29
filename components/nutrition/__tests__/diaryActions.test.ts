import { readFileSync } from 'fs';
import { join } from 'path';

import {
  DIARY_SCOPE_COPY,
  DIARY_TRANSFER_ERROR_KEYS,
  type DiaryActionRequest,
  type DiaryActionScope,
  type DiaryTransferMode,
} from '@/components/nutrition/diaryActions';
import type { DiarySelection } from '@/components/nutrition/foodDiarySelection';

const SCOPES = Object.keys(DIARY_SCOPE_COPY) as DiaryActionScope[];
const MODES: DiaryTransferMode[] = ['copy', 'move', 'split'];

const en = JSON.parse(
  readFileSync(join(__dirname, '..', '..', '..', 'lang', 'locales', 'en-us', 'food.json'), 'utf8')
);

/** Whether `food.<path>` exists, directly or as the plural forms i18next resolves with a count. */
function hasKey(key: string): boolean {
  const path = key.replace(/^food\./, '').split('.');
  const leaf = path.pop() as string;
  let node = en.food;
  for (const part of path) {
    node = node?.[part];
  }

  return node != null && (leaf in node || `${leaf}_other` in node);
}

function request(scope: DiaryActionScope, overrides: Partial<DiaryActionRequest> = {}) {
  return {
    scope,
    panel: 'delete',
    subjectName: 'Oats',
    selection: { itemCount: 3 } as DiarySelection,
    ...overrides,
  } as DiaryActionRequest;
}

describe('DIARY_SCOPE_COPY', () => {
  it.each(SCOPES)('%s names a success message for every transfer mode', (scope) => {
    for (const mode of MODES) {
      expect(DIARY_SCOPE_COPY[scope].transfer[mode].successKey).toMatch(/^food\./);
    }
  });

  it('only ever words a title for the selection and a split food, the rest use the sheet default', () => {
    const titled = SCOPES.flatMap((scope) =>
      MODES.filter((mode) => 'titleKey' in DIARY_SCOPE_COPY[scope].transfer[mode]).map(
        (mode) => `${scope}.${mode}`
      )
    );

    expect(titled.sort()).toEqual(['food.split', 'selection.copy', 'selection.move']);
  });

  it('exists in the English locale for every key it can ask for', () => {
    const keys = [
      ...Object.values(DIARY_TRANSFER_ERROR_KEYS),
      ...SCOPES.flatMap((scope) => {
        const copy = DIARY_SCOPE_COPY[scope];

        return [
          ...MODES.flatMap((mode) => {
            const transfer: { titleKey?: string; successKey: string } = copy.transfer[mode];

            return [transfer.successKey, ...(transfer.titleKey ? [transfer.titleKey] : [])];
          }),
          copy.delete.titleKey,
          copy.delete.messageKey,
          copy.delete.successKey,
          copy.delete.errorKey,
        ];
      }),
    ];

    expect(keys.filter((key) => !hasKey(key))).toEqual([]);
  });

  it('fills each delete message with what that scope names', () => {
    expect(DIARY_SCOPE_COPY.selection.delete.params(request('selection'))).toEqual({ count: 3 });
    expect(DIARY_SCOPE_COPY.food.delete.params(request('food'))).toEqual({ foodName: 'Oats' });
    expect(DIARY_SCOPE_COPY.meal.delete.params(request('meal', { subjectName: 'Lunch' }))).toEqual({
      mealName: 'Lunch',
    });
    expect(DIARY_SCOPE_COPY.group.delete.params(request('group'))).toEqual({});
  });
});
