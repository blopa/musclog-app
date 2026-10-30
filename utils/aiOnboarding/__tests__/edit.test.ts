import { clearField, editField, parseDecimalInput } from '@/utils/aiOnboarding/edit';

const today = new Date(2026, 9, 30);

describe('parseDecimalInput', () => {
  it.each([
    ['70', 70],
    [' 70.5 ', 70.5],
    ['70,5', 70.5],
  ])('reads %j', (text, value) => {
    expect(parseDecimalInput(text)).toBe(value);
  });

  it.each(['', 'abc', '7 0', '-5', '1e3', '5.', '.5', '1,2,3'])('rejects %j', (text) => {
    expect(parseDecimalInput(text)).toBeNull();
  });
});

describe('editField', () => {
  it('converts typed imperial measurements into metric answers', () => {
    const weight = editField({}, { field: 'weightKg', text: '154,3', units: 'imperial' }, today);
    const height = editField({}, { field: 'heightCm', text: '70', units: 'imperial' }, today);

    expect(weight).toEqual({ ok: true, draft: { weightKg: 70 } });
    expect(height).toEqual({ ok: true, draft: { heightCm: 177.8 } });
    expect(editField({}, { field: 'heightCm', text: '180', units: 'metric' }, today)).toEqual({
      ok: true,
      draft: { heightCm: 180 },
    });
  });

  it('keeps the other answers', () => {
    const result = editField(
      { gender: 'male', weightKg: 80 },
      { field: 'weightKg', text: '75', units: 'metric' },
      today
    );

    expect(result).toEqual({ ok: true, draft: { gender: 'male', weightKg: 75 } });
  });

  it('says why a value was not accepted, and leaves the draft alone', () => {
    expect(editField({}, { field: 'weightKg', text: '5', units: 'metric' }, today)).toEqual({
      ok: false,
      code: 'outOfRange',
    });
    expect(editField({}, { field: 'weightKg', text: 'lots', units: 'metric' }, today)).toEqual({
      ok: false,
      code: 'invalid',
    });
    expect(editField({}, { field: 'heightCm', text: '', units: 'metric' }, today)).toEqual({
      ok: false,
      code: 'invalid',
    });
    expect(editField({}, { field: 'bodyFatPercent', text: '90' }, today)).toEqual({
      ok: false,
      code: 'outOfRange',
    });
    expect(editField({}, { field: 'bodyFatPercent', text: 'x' }, today)).toEqual({
      ok: false,
      code: 'invalid',
    });
  });

  it('sets a real birthday and drops the estimate flag', () => {
    const result = editField(
      { birthDate: '1990-01-01', dobEstimated: true },
      { field: 'birthDate', isoDate: '1991-02-03' },
      today
    );

    expect(result).toEqual({ ok: true, draft: { birthDate: '1991-02-03' } });
    expect(editField({}, { field: 'birthDate', isoDate: '2020-01-01' }, today)).toEqual({
      ok: false,
      code: 'outOfRange',
    });
  });

  it('sets the choice fields', () => {
    expect(editField({}, { field: 'gender', value: 'other' }, today).ok).toBe(true);
    expect(editField({}, { field: 'activityLevel', value: 4 }, today)).toEqual({
      ok: true,
      draft: { activityLevel: 4 },
    });
    expect(editField({}, { field: 'trainingDaysPerWeek', value: 5 }, today)).toEqual({
      ok: true,
      draft: { trainingDaysPerWeek: 5 },
    });
    expect(editField({}, { field: 'trainingLocation', value: 'home' }, today)).toEqual({
      ok: true,
      draft: { trainingLocation: 'home' },
    });
    expect(editField({}, { field: 'trainingAutonomy', value: 'manual' }, today)).toEqual({
      ok: true,
      draft: { trainingAutonomy: 'manual' },
    });
    expect(editField({}, { field: 'breakLength', value: 'over6m' }, today)).toEqual({
      ok: true,
      draft: { breakLength: 'over6m' },
    });
    expect(editField({}, { field: 'units', value: 'imperial' }, today).ok).toBe(true);
  });

  it('refuses a choice that is not on the list', () => {
    expect(editField({}, { field: 'gender', value: 'robot' }, today)).toEqual({
      ok: false,
      code: 'invalid',
    });
    expect(editField({}, { field: 'activityLevel', value: 9 }, today)).toEqual({
      ok: false,
      code: 'outOfRange',
    });
    expect(editField({}, { field: 'trainingDaysPerWeek', value: 7 }, today).ok).toBe(false);
  });

  it('cleans a name, and treats an emptied optional field as removing the answer', () => {
    expect(editField({}, { field: 'fullName', text: '  Ana  ' }, today)).toEqual({
      ok: true,
      draft: { fullName: 'Ana' },
    });
    expect(editField({ fullName: 'Ana' }, { field: 'fullName', text: '  ' }, today)).toEqual({
      ok: true,
      draft: {},
    });
    expect(editField({ bodyFatPercent: 20 }, { field: 'bodyFatPercent', text: '' }, today)).toEqual(
      { ok: true, draft: {} }
    );
    // Nothing but control characters is not a name: rejected, not silently dropped.
    expect(editField({}, { field: 'fullName', text: String.fromCharCode(1, 2) }, today)).toEqual({
      ok: false,
      code: 'invalid',
    });
  });
});

describe('clearField', () => {
  it('removes an answer', () => {
    expect(clearField({ gender: 'male', weightKg: 70 }, 'weightKg')).toEqual({ gender: 'male' });
  });

  it('removes the estimate flag along with a birthday', () => {
    expect(clearField({ birthDate: '1990-01-01', dobEstimated: true }, 'birthDate')).toEqual({});
  });
});
