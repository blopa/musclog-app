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

import { render } from '@testing-library/react';
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
  return sendProps[sendProps.length - 1];
}

describe('ShareOpticalSendModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendProps.length = 0;
    mockFood.mockResolvedValue({ json: '{}' });
    mockMeal.mockResolvedValue({ json: '{}' });
    mockLoggedMeal.mockResolvedValue({ json: '{}' });
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
});
