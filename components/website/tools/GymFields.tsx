import { useTranslation } from 'react-i18next';

import { BODY_TEXT, INPUT_BORDER, MUTED } from '@/components/website/websiteColors';
import type { Units } from '@/constants/settings';

import { PLATE_DENOMINATIONS, plateKey } from './gymForm';
import { NumberField, ToolNotice } from './ToolFields';
import type { useToolGym } from './useToolState';

/**
 * The shared "your gym" form: the bar and how many pairs of each plate the gym has. Collapsed by
 * default (a standard gym is what most visitors have) and remembered in this browser.
 */
export function GymFields({
  units,
  gymState,
}: {
  units: Units;
  gymState: ReturnType<typeof useToolGym>;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: 'websiteTools.gym' });
  const { t: unitsT } = useTranslation(undefined, { keyPrefix: 'websiteTools.units' });
  const unitLabel = units === 'imperial' ? unitsT('lb') : unitsT('kg');
  const { form, gym, setBarWeight, setPairs, reset } = gymState;

  return (
    <details className="rounded-control border p-3" style={{ borderColor: INPUT_BORDER }}>
      <summary className="cursor-pointer text-sm font-semibold" style={{ color: BODY_TEXT }}>
        {t('summary')}
      </summary>
      <div className="mt-4 space-y-4">
        <div className="max-w-xs">
          <NumberField
            id="gym-bar-weight"
            label={t('barWeight')}
            value={form.barWeight}
            onChange={setBarWeight}
            suffix={unitLabel}
            invalid={gym === null}
          />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold" style={{ color: BODY_TEXT }}>
            {t('plates')}
          </p>
          <p className="text-xs" style={{ color: MUTED }}>
            {t('platesHint')}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {PLATE_DENOMINATIONS[units].map((plate) => (
              <NumberField
                key={plate}
                id={`gym-plate-${plate}`}
                label={`${plate} ${unitLabel}`}
                value={form.pairs[plateKey(plate)] ?? ''}
                onChange={(value) => setPairs(plate, value)}
                inputMode="numeric"
              />
            ))}
          </div>
        </div>
        {gym === null ? <ToolNotice tone="warning">{t('invalid')}</ToolNotice> : null}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-control border px-4 py-2 text-sm font-semibold"
            style={{ borderColor: INPUT_BORDER, color: BODY_TEXT }}
          >
            {t('reset')}
          </button>
          <span className="text-xs" style={{ color: MUTED }}>
            {t('remembered')}
          </span>
        </div>
      </div>
    </details>
  );
}
