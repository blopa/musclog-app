import { fireEvent, render, screen } from '@testing-library/react';

import type { MealEstimateReview } from '@/components/camera/mealEstimateReview';
import {
  VoiceCommandModal,
  type VoiceCommandModalState,
} from '@/components/modals/VoiceCommandModal';

jest.mock('@/lang/lang', () => ({ __esModule: true, default: { t: (key: string) => key } }));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: unknown) => (options ? `${key}:${JSON.stringify(options)}` : key),
  }),
}));
jest.mock('@/hooks/useTheme', () => ({ useTheme: () => require('@/theme').darkTheme }));
jest.mock('@/components/modals/CenteredModal', () => ({
  CenteredModal: ({
    visible,
    title,
    footer,
    children,
  }: {
    visible: boolean;
    title: string;
    footer: React.ReactNode;
    children: React.ReactNode;
  }) =>
    visible ? (
      <div>
        <h2>{title}</h2>
        {children}
        {footer}
      </div>
    ) : null,
}));
jest.mock('@/components/theme/ListRow', () => ({
  ListRow: ({
    title,
    subtitle,
    onPress,
  }: {
    title: string;
    subtitle: string;
    onPress: () => void;
  }) => (
    <button onClick={onPress}>
      <span>{title}</span>
      <span>{subtitle}</span>
    </button>
  ),
}));
jest.mock('@/components/theme/Button', () => ({
  Button: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
}));
// The sheets have their own tests; here they only show that the modal mounts the right one.
jest.mock('@/components/modals/VoiceWeightSheet', () => ({
  VoiceWeightSheet: ({ onClose }: { onClose: (saved: boolean) => void }) => (
    <div>
      <span>weight-sheet</span>
      <button onClick={() => onClose(true)}>weight-saved</button>
      <button onClick={() => onClose(false)}>weight-dismissed</button>
    </div>
  ),
}));
const mockLogMealOnClose = jest.fn();
jest.mock('@/components/modals/LogMealModal', () => ({
  LogMealModal: ({
    onClose,
    onLogMeal,
  }: {
    onClose: () => void;
    onLogMeal: (data: unknown) => Promise<void>;
  }) => (
    <div>
      <span>meal-review</span>
      <button onClick={() => mockLogMealOnClose(onClose)}>meal-close</button>
      <button
        onClick={() =>
          void onLogMeal({
            date: new Date(2026, 10, 26),
            time: null,
            mealType: 'lunch',
            portionGrams: 100,
          })
        }
      >
        meal-log
      </button>
    </div>
  ),
}));

const TRANSCRIPT = 'copy my breakfast from yesterday';

const REVIEW = {
  meal: { name: 'Oats', type: 'Breakfast' },
  ingredients: [],
} as unknown as MealEstimateReview;

function renderModal(
  state: VoiceCommandModalState | null,
  extra: Partial<Parameters<typeof VoiceCommandModal>[0]> = {}
) {
  const props = {
    state,
    onCancel: jest.fn(),
    onAskCoach: jest.fn(),
    onPickTool: jest.fn(),
    onWeighInClose: jest.fn(),
    onLogMeal: jest.fn(async () => {}),
    onMealReviewClose: jest.fn(),
    ...extra,
  };
  render(<VoiceCommandModal {...props} />);

  return props;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('VoiceCommandModal', () => {
  it('renders nothing when there is no state', () => {
    const { container } = render(
      <VoiceCommandModal
        state={null}
        onCancel={jest.fn()}
        onAskCoach={jest.fn()}
        onPickTool={jest.fn()}
        onWeighInClose={jest.fn()}
        onLogMeal={jest.fn()}
        onMealReviewClose={jest.fn()}
      />
    );

    expect(container.innerHTML).toBe('');
  });

  it('shows the transcript while working and cancels through onCancel', () => {
    const { onCancel } = renderModal({ kind: 'working', transcript: TRANSCRIPT });

    expect(screen.getByText(TRANSCRIPT)).toBeTruthy();
    expect(screen.getByText('voiceInput.command.workingTitle')).toBeTruthy();
    fireEvent.click(screen.getByText('common.cancel'));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('lists only the offered tools and reports the picked one with the transcript', () => {
    const { onPickTool } = renderModal({
      kind: 'pick',
      transcript: TRANSCRIPT,
      offered: ['copy_meal', 'search_food'],
    });

    expect(screen.getByText('voiceInput.command.pickTitle')).toBeTruthy();
    expect(screen.getByText('voiceInput.command.tool.copyMeal')).toBeTruthy();
    expect(screen.getByText('voiceInput.command.tool.searchFood')).toBeTruthy();
    expect(screen.queryByText('voiceInput.command.tool.logWeight')).toBeNull();
    expect(screen.queryByText('voiceInput.command.tool.addNote')).toBeNull();

    fireEvent.click(screen.getByText('voiceInput.command.tool.copyMeal'));

    expect(onPickTool).toHaveBeenCalledWith(TRANSCRIPT, 'copy_meal');
  });

  it('hands the transcript to the coach on Ask coach, and closes on Cancel', () => {
    const { onAskCoach, onCancel } = renderModal({
      kind: 'pick',
      transcript: TRANSCRIPT,
      offered: ['copy_meal'],
    });

    fireEvent.click(screen.getByText('voiceInput.command.askCoach'));
    expect(onAskCoach).toHaveBeenCalledWith(TRANSCRIPT);
    expect(onCancel).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('common.cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('shows the step of a meal estimate from its progress line', () => {
    renderModal(
      { kind: 'estimating', transcript: TRANSCRIPT },
      { progress: { key: 'food.aiProgress.estimating', options: { count: 3 } } as never }
    );

    expect(screen.getByText(/food\.aiProgress\.estimating/)).toBeTruthy();
    expect(screen.getByText('voiceInput.command.mealTitle')).toBeTruthy();
  });

  it('mounts the weigh-in sheet and reports whether it saved', () => {
    const { onWeighInClose } = renderModal({
      kind: 'weight',
      transcript: TRANSCRIPT,
      weighIn: { kind: 'logWeight', day: new Date(2026, 10, 26), weightKg: 80 },
    });

    expect(screen.getByText('weight-sheet')).toBeTruthy();
    expect(screen.getByText('voiceInput.command.weight.title')).toBeTruthy();

    fireEvent.click(screen.getByText('weight-saved'));
    expect(onWeighInClose).toHaveBeenLastCalledWith(true);

    fireEvent.click(screen.getByText('weight-dismissed'));
    expect(onWeighInClose).toHaveBeenLastCalledWith(false);
  });

  it('mounts the meal review and passes logging and closing through', () => {
    const { onLogMeal, onMealReviewClose } = renderModal({
      kind: 'mealReview',
      transcript: TRANSCRIPT,
      review: REVIEW,
      day: new Date(2026, 10, 26),
      mealType: 'lunch',
    });

    expect(screen.getByText('meal-review')).toBeTruthy();

    fireEvent.click(screen.getByText('meal-log'));
    expect(onLogMeal).toHaveBeenCalledWith(expect.objectContaining({ mealType: 'lunch' }));

    fireEvent.click(screen.getByText('meal-close'));
    expect(mockLogMealOnClose).toHaveBeenCalledWith(onMealReviewClose);
  });
});
