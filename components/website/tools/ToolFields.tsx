import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  BODY_TEXT,
  BODY_TEXT_SOFT,
  BRAND_GREEN,
  brandBright,
  CARD_BG,
  CARD_BORDER,
  HEADING_TEXT,
  hue,
  INPUT_BG,
  INPUT_BORDER,
  MUTED,
  ON_BRAND,
} from '@/components/website/websiteColors';
import type { Units } from '@/constants/settings';

const inputClass =
  'w-full rounded-control border px-3 py-2.5 text-sm transition-colors focus:outline-none focus:ring-1 focus:ring-accent-bright/40';

/** A raised card the form or the results sit in. */
export function ToolPanel({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <section
      className="rounded-card border p-5 md:p-6"
      style={{ backgroundColor: CARD_BG, borderColor: CARD_BORDER }}
    >
      {title ? <h2 className="mb-4 text-lg font-bold text-text-primary">{title}</h2> : null}
      {children}
    </section>
  );
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Unit or other text drawn after the number, e.g. "kg". */
  suffix?: string;
  hint?: string;
  invalid?: boolean;
  /** "decimal" opens the decimal keypad on a phone; "numeric" the integer one. */
  inputMode?: 'decimal' | 'numeric';
}

/**
 * A typed number, held by the page as the visitor's own string (so "62," survives while typing and
 * an empty field is "nothing entered", not 0). The page parses it with `parseToolNumber`.
 */
export function NumberField({
  id,
  label,
  value,
  onChange,
  suffix,
  hint,
  invalid = false,
  inputMode = 'decimal',
}: NumberFieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold" style={{ color: BODY_TEXT }}>
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode={inputMode}
          autoComplete="off"
          value={value}
          aria-invalid={invalid}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => onChange((event.target as HTMLInputElement).value)}
          className={inputClass}
          style={{
            backgroundColor: INPUT_BG,
            borderColor: invalid ? hue('error') : INPUT_BORDER,
            color: HEADING_TEXT,
          }}
        />
        {suffix ? (
          <span className="shrink-0 text-sm font-semibold" style={{ color: BODY_TEXT_SOFT }}>
            {suffix}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs" style={{ color: MUTED }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

interface ChoiceFieldProps<T extends string | number> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** A small set of mutually exclusive choices as buttons (a radio group, keyboard reachable). */
export function ChoiceField<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: ChoiceFieldProps<T>) {
  return (
    <div className="space-y-1.5" role="radiogroup" aria-label={label}>
      <p className="text-sm font-semibold" style={{ color: BODY_TEXT }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={String(option.value)}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className="min-h-11 grow basis-[96px] rounded-control border px-3 py-2 text-sm font-semibold transition-colors"
              style={
                active
                  ? { backgroundColor: BRAND_GREEN, borderColor: BRAND_GREEN, color: ON_BRAND }
                  : { backgroundColor: INPUT_BG, borderColor: INPUT_BORDER, color: BODY_TEXT }
              }
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The kg / lb switch every weight tool carries. */
export function UnitsField({
  units,
  onChange,
}: {
  units: Units;
  onChange: (units: Units) => void;
}) {
  const { t } = useTranslation(undefined, { keyPrefix: 'websiteTools.units' });
  return (
    <ChoiceField
      label={t('label')}
      value={units}
      onChange={onChange}
      options={[
        { value: 'metric', label: t('metric') },
        { value: 'imperial', label: t('imperial') },
      ]}
    />
  );
}

/** One result: a label, a large figure and an optional note under it. */
export function ResultStat({
  label,
  value,
  note,
  emphasis = false,
}: {
  label: string;
  value: string;
  note?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className="rounded-card border p-4"
      style={{
        backgroundColor: emphasis ? brandBright(0.08) : CARD_BG,
        borderColor: emphasis ? brandBright(0.4) : CARD_BORDER,
      }}
    >
      <p className="text-sm font-semibold" style={{ color: BODY_TEXT_SOFT }}>
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold tabular-nums text-text-primary">{value}</p>
      {note ? (
        <p className="mt-2 text-xs leading-relaxed" style={{ color: MUTED }}>
          {note}
        </p>
      ) : null}
    </div>
  );
}

/** A line of explanation under a result: `info` for context, `warning` for a limit the page hit. */
export function ToolNotice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warning';
}) {
  return (
    <p
      role={tone === 'warning' ? 'alert' : undefined}
      className="rounded-control border px-3 py-2.5 text-sm leading-relaxed"
      style={
        tone === 'warning'
          ? {
              backgroundColor: hue('warning', 0.1),
              borderColor: hue('warning', 0.4),
              color: HEADING_TEXT,
            }
          : { backgroundColor: INPUT_BG, borderColor: INPUT_BORDER, color: BODY_TEXT }
      }
    >
      {children}
    </p>
  );
}
