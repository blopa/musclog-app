/**
 * @jest-environment jsdom
 */

/**
 * One send screen for every shareable record.
 *
 * This replaced three wrapper components (`FoodOpticalSendModal`, `MealOpticalSendModal`,
 * `LoggedMealOpticalSendModal`) that differed only in which builder they called and which three
 * translation keys they picked — and two of them picked the SAME three keys. What these tests pin
 * is the part that used to live in three places: dispatching to the right builder, offering the
 * photo toggle only where there is a photo, and translating the builder's typed "nothing to send".
 */

import { act, render } from '@testing-library/react';
import { createElement } from 'react';

import { ShareOpticalSendModal } from '@/components/modals/ShareOpticalSendModal';
import { buildFoodSharePayload } from '@/database/share/buildFoodShare';
import { buildLoggedMealSharePayload } from '@/database/share/buildLoggedMealShare';
import { buildMealSharePayload } from '@/database/share/buildMealShare';
import { MusclogShareError } from '@/utils/share/shareEnvelope';

const sendProps: any[] = [];

jest.mock('@/components/modals/OpticalSendModal', () => ({
  OpticalSendModal: (props: any) => {
    sendProps.push(props);
    return null;
  },
}));

jest.mock('@/database/share/buildFoodShare', () => ({ buildFoodSharePayload: jest.fn() }));
jest.mock('@/database/share/buildMealShare', () => ({ buildMealSharePayload: jest.fn() }));
jest.mock('@/database/share/buildLoggedMealShare', () => ({
  buildLoggedMealSharePayload: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mockFood = buildFoodSharePayload as jest.Mock;
const mockMeal = buildMealSharePayload as jest.Mock;
const mockLoggedMeal = buildLoggedMealSharePayload as jest.Mock;

function renderSender(target: any) {
  render(
    createElement(ShareOpticalSendModal, { onClose: jest.fn(), target, visible: true } as any)
  );
  return latestProps();
}

/** The props of the most recent render — a build publishes its outcome by re-rendering. */
function latestProps() {
  return sendProps[sendProps.length - 1];
}

describe('ShareOpticalSendModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendProps.length = 0;
    mockFood.mockResolvedValue({ json: '{}', photo: 'none' });
    mockMeal.mockResolvedValue({ json: '{}', photo: 'none' });
    mockLoggedMeal.mockResolvedValue({ json: '{}', photo: 'none' });
  });

  it('sends a food through the food builder and offers its photo', async () => {
    const props = renderSender({ foodId: 'food-1', hasImage: true, kind: 'food' });

    expect(props.hasPhoto).toBe(true);
    expect(props.copy.title).toBe('opticalTransfer.share.sendFoodTitle');

    await props.buildPayload({ includeImage: true });
    expect(mockFood).toHaveBeenCalledWith('food-1', { includeImage: true });
  });

  it('sends a saved meal through the meal builder', async () => {
    const props = renderSender({ hasImage: false, kind: 'meal', mealId: 'meal-1' });

    expect(props.hasPhoto).toBe(false);
    expect(props.copy.title).toBe('opticalTransfer.share.sendMealTitle');

    await props.buildPayload({ includeImage: false });
    expect(mockMeal).toHaveBeenCalledWith('meal-1', { includeImage: false });
  });

  it('sends a logged meal with no photo option at all', async () => {
    const logs = [{ id: 'log-1' }];
    const props = renderSender({ kind: 'loggedMeal', logs, name: 'Lunch, 2 Aug' });

    // A logged meal has no photo of its own, and its ingredients' photos are not what was asked for.
    expect(props.hasPhoto).toBe(false);
    // It is presented as a meal because a meal is what the receiver ends up saving.
    expect(props.copy.title).toBe('opticalTransfer.share.sendMealTitle');

    await props.buildPayload({ includeImage: true });
    expect(mockLoggedMeal).toHaveBeenCalledWith(logs, { name: 'Lunch, 2 Aug' });
  });

  it('translates the builder’s typed empty-share failure', async () => {
    mockLoggedMeal.mockRejectedValue(new MusclogShareError('no-ingredients', 'raw english'));
    const props = renderSender({ kind: 'loggedMeal', logs: [], name: 'Lunch' });

    // Matched on the CODE, never the message text: the send screen renders whatever is thrown, and
    // a reworded English string used to drop the user into a generic failure.
    await expect(props.buildPayload({ includeImage: false })).rejects.toThrow(
      'opticalTransfer.share.noIngredients'
    );
  });

  it('lets any other builder failure through untouched', async () => {
    const failure = new Error('disk full');
    mockFood.mockRejectedValue(failure);
    const props = renderSender({ foodId: 'food-1', hasImage: true, kind: 'food' });

    await expect(props.buildPayload({ includeImage: true })).rejects.toBe(failure);
  });

  // Each outcome is invisible in the size card for its own reason, so each gets a sentence. `none`
  // is the exception: no photo, or the user turned it off, and both are already on screen.
  it.each([
    ['embedded', 'opticalTransfer.share.photoEmbedded'],
    ['linked', 'opticalTransfer.share.photoLinked'],
    ['unavailable', 'opticalTransfer.share.photoUnavailable'],
    ['none', undefined],
  ])('captions a %s photo', async (photo, expected) => {
    mockFood.mockResolvedValue({ json: '{}', photo });
    const props = renderSender({ foodId: 'food-1', hasImage: true, kind: 'food' });

    // Nothing is claimed before a build has actually run.
    expect(props.photoNotice).toBeUndefined();

    await act(async () => {
      await props.buildPayload({ includeImage: true });
    });

    expect(latestProps().photoNotice).toBe(expected);
  });

  // Toggling twice quickly leaves two builds in flight. `useOpticalSender` drops the stale one's
  // size, so publishing the stale one's outcome here would caption a payload that is not being
  // sent.
  it('ignores the outcome of a build that a newer one superseded', async () => {
    let finishStale: (payload: unknown) => void = () => {};
    mockFood.mockReturnValueOnce(
      new Promise((resolve) => {
        finishStale = resolve;
      })
    );
    mockFood.mockResolvedValueOnce({ json: '{}', photo: 'linked' });

    const props = renderSender({ foodId: 'food-1', hasImage: true, kind: 'food' });
    const stale = props.buildPayload({ includeImage: true });
    await act(async () => {
      await props.buildPayload({ includeImage: false });
    });

    expect(latestProps().photoNotice).toBe('opticalTransfer.share.photoLinked');

    await act(async () => {
      finishStale({ json: '{}', photo: 'embedded' });
      await stale;
    });

    expect(latestProps().photoNotice).toBe('opticalTransfer.share.photoLinked');
  });
});
