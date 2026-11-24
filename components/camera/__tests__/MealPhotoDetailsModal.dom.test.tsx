import { fireEvent, render, screen } from '@testing-library/react';

import { MealPhotoDetailsModal } from '@/components/camera/MealPhotoDetailsModal';
import { EMPTY_MEAL_PHOTO_DRAFT, type MealPhotoDraft } from '@/utils/mealPhotoDraft';

jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/utils/webPhoneFrame', () => ({ useWebModalLayerStyle: () => ({}) }));
jest.mock('@/components/ZoomableThumbnail', () => ({
  ZoomableThumbnail: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
// The shell is covered by its own tests; here only its children and footer matter.
jest.mock('@/components/modals/FullScreenModal', () => ({
  FullScreenModal: ({
    visible,
    children,
    footer,
    onClose,
  }: {
    visible: boolean;
    children: React.ReactNode;
    footer: React.ReactNode;
    onClose: () => void;
  }) =>
    visible ? (
      <div>
        <button onClick={onClose}>close-x</button>
        {children}
        {footer}
      </div>
    ) : null,
}));
jest.mock('@/components/modals/ConfirmationModal', () => ({
  ConfirmationModal: ({
    visible,
    title,
    confirmLabel,
    onConfirm,
  }: {
    visible: boolean;
    title: string;
    confirmLabel: string;
    onConfirm: () => void;
  }) =>
    visible ? (
      <div>
        <span>{title}</span>
        <button onClick={onConfirm}>{confirmLabel}</button>
      </div>
    ) : null,
}));
jest.mock('@/components/theme/Button', () => ({
  Button: ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button disabled={disabled} onClick={onPress}>
      {label}
    </button>
  ),
}));
jest.mock('@/components/theme/TextButton', () => ({
  TextButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
}));
jest.mock('@/components/theme/TextInput', () => ({
  TextInput: ({
    label,
    value,
    onChangeText,
  }: {
    label: string;
    value: string;
    onChangeText: (v: string) => void;
  }) => <input aria-label={label} value={value} onChange={(e) => onChangeText(e.target.value)} />,
}));
jest.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: () => undefined },
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
    i18n: { language: 'en-US', resolvedLanguage: 'en-US' },
  }),
}));

const withPhotos = (n: number): MealPhotoDraft => ({
  ...EMPTY_MEAL_PHOTO_DRAFT,
  photos: Array.from({ length: n }, (_, i) => `file:///p${i}.jpg`),
});

function setup(draft: MealPhotoDraft, photoLimit = 5) {
  const dispatch = jest.fn();
  const onAddPhoto = jest.fn();
  const onEstimate = jest.fn();
  const onDiscard = jest.fn();
  render(
    <MealPhotoDetailsModal
      visible
      draft={draft}
      dispatch={dispatch}
      photoLimit={photoLimit}
      onAddPhoto={onAddPhoto}
      onEstimate={onEstimate}
      onDiscard={onDiscard}
    />
  );

  return { dispatch, onAddPhoto, onEstimate, onDiscard };
}

describe('MealPhotoDetailsModal', () => {
  it('renders a tile per photo, the count and the + tile', () => {
    const { onAddPhoto } = setup(withPhotos(3));

    expect(screen.getAllByLabelText(/food\.mealPhotos\.removePhoto/)).toHaveLength(3);
    expect(screen.getByText('food.mealPhotos.photoCount:{"count":3,"max":5}')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('food.mealPhotos.addPhoto'));
    expect(onAddPhoto).toHaveBeenCalled();
  });

  it('removes a photo by its index', () => {
    const { dispatch } = setup(withPhotos(2));

    fireEvent.click(screen.getByLabelText('food.mealPhotos.removePhoto:{"index":2}'));
    expect(dispatch).toHaveBeenCalledWith({ type: 'removePhoto', index: 1 });
  });

  it('hides the + tile at the limit', () => {
    setup(withPhotos(2), 2);

    expect(screen.queryByLabelText('food.mealPhotos.addPhoto')).toBeNull();
  });

  it('dispatches the chips and the text fields', () => {
    const { dispatch } = setup(withPhotos(1));

    fireEvent.click(screen.getByText('food.mealPhotos.origin.home'));
    fireEvent.click(screen.getByText('food.mealPhotos.addedFat.lots'));
    fireEvent.click(screen.getByText('food.aiNutritionContext.quickTagVegan'));
    fireEvent.change(screen.getByLabelText('food.mealPhotos.nameLabel'), {
      target: { value: 'Soup' },
    });

    expect(dispatch).toHaveBeenCalledWith({ type: 'toggleOrigin', value: 'home' });
    expect(dispatch).toHaveBeenCalledWith({ type: 'toggleAddedFat', value: 'lots' });
    expect(dispatch).toHaveBeenCalledWith({
      type: 'toggleTag',
      value: 'food.aiNutritionContext.quickTagVegan',
    });
    expect(dispatch).toHaveBeenCalledWith({ type: 'setName', value: 'Soup' });
  });

  it('disables Estimate with no photos and enables it otherwise', () => {
    const first = setup(EMPTY_MEAL_PHOTO_DRAFT);
    expect((screen.getByText('food.mealPhotos.estimate') as HTMLButtonElement).disabled).toBe(true);
    expect(first.onEstimate).not.toHaveBeenCalled();
  });

  it('estimates when a photo is present', () => {
    const { onEstimate } = setup(withPhotos(1));

    fireEvent.click(screen.getByText('food.mealPhotos.estimate'));
    expect(onEstimate).toHaveBeenCalled();
  });

  it('asks before discarding a draft with input', () => {
    const { onDiscard } = setup(withPhotos(1));

    fireEvent.click(screen.getByText('common.cancel'));
    expect(onDiscard).not.toHaveBeenCalled();
    expect(screen.getByText('food.mealPhotos.discardTitle')).toBeTruthy();

    fireEvent.click(screen.getByText('food.mealPhotos.discard'));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('discards an empty draft directly', () => {
    const { onDiscard } = setup(EMPTY_MEAL_PHOTO_DRAFT);

    fireEvent.click(screen.getByText('close-x'));
    expect(onDiscard).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('food.mealPhotos.discardTitle')).toBeNull();
  });
});
