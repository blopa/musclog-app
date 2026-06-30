'use client';

import {
  BookOpen,
  ChevronDown,
  Dumbbell,
  FlaskConical,
  HelpCircle,
  Salad,
} from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DotPattern } from '@/components/website/WebsiteBackgrounds';
import { BODY_TEXT_SOFT, BRAND_GREEN_BRIGHT, MUTED } from '@/components/website/websiteColors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Citation {
  label: string;
  url: string;
}

interface FaqItem {
  question: string;
  answer: string;
  answer2?: string;
  formula?: string;
  formulaCaption?: string;
  bullets?: string[];
  citations?: Citation[];
  table?: { head: string[]; rows: string[][] };
}

interface FaqCategory {
  id: string;
  label: string;
  icon: typeof HelpCircle;
  color: string;
  borderColor: string;
  bgColor: string;
  items: FaqItem[];
}

// ---------------------------------------------------------------------------
// Static visual config (non-translatable)
// ---------------------------------------------------------------------------

const CATEGORY_VISUAL_CONFIG = {
  general: {
    bgColor: 'rgba(0,255,163,0.06)',
    borderColor: 'rgba(0,255,163,0.25)',
    color: BRAND_GREEN_BRIGHT,
    icon: HelpCircle,
  },
  nutrition: {
    bgColor: 'rgba(56,189,248,0.06)',
    borderColor: 'rgba(56,189,248,0.25)',
    color: '#38BDF8',
    icon: Salad,
  },
  workout: {
    bgColor: 'rgba(167,139,250,0.06)',
    borderColor: 'rgba(167,139,250,0.25)',
    color: '#A78BFA',
    icon: Dumbbell,
  },
  methodology: {
    bgColor: 'rgba(245,158,11,0.06)',
    borderColor: 'rgba(245,158,11,0.25)',
    color: '#F59E0B',
    icon: FlaskConical,
  },
} as const;

type CategoryId = keyof typeof CATEGORY_VISUAL_CONFIG;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CitationChip({ label, url }: Citation) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all hover:scale-[1.02]"
      style={{
        backgroundColor: 'rgba(56,189,248,0.06)',
        borderColor: 'rgba(56,189,248,0.3)',
        color: '#38BDF8',
      }}
    >
      <BookOpen size={11} color="#38BDF8" />
      {label}
    </a>
  );
}

function FormulaBlock({ formula, caption }: { formula: string; caption?: string }) {
  return (
    <div
      className="my-4 overflow-x-auto rounded-xl border px-5 py-3"
      style={{
        backgroundColor: 'rgba(0,255,163,0.04)',
        borderColor: 'rgba(0,255,163,0.2)',
      }}
    >
      <code className="block font-mono text-sm tracking-wide" style={{ color: BRAND_GREEN_BRIGHT }}>
        {formula}
      </code>
      {caption ? (
        <p className="mt-2 text-xs" style={{ color: MUTED }}>
          {caption}
        </p>
      ) : null}
    </div>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div
      className="my-4 overflow-x-auto rounded-xl border"
      style={{ borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <table className="w-full min-w-[520px] text-sm">
        <thead>
          <tr style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
            {head.map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left font-semibold text-white first:rounded-tl-xl last:rounded-tr-xl"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-4 py-3"
                  style={{ color: j === 0 ? '#E5E7EB' : BODY_TEXT_SOFT }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccordionItem({
  accentColor,
  isOpen,
  item,
  onToggle,
  sourcesLabel,
}: {
  accentColor: string;
  isOpen: boolean;
  item: FaqItem;
  onToggle: () => void;
  sourcesLabel: string;
}) {
  return (
    <div
      className="overflow-hidden rounded-2xl border transition-all"
      style={{
        backgroundColor: isOpen ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.015)',
        borderColor: isOpen ? `${accentColor}33` : 'rgba(255,255,255,0.08)',
      }}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="text-base font-semibold text-white">{item.question}</span>
        <span
          className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        >
          <ChevronDown size={18} color={isOpen ? accentColor : MUTED} />
        </span>
      </button>

      {isOpen ? (
        <div className="px-6 pb-6">
          <div className="mb-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />

          <p className="mb-3 text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
            {item.answer}
          </p>

          {item.bullets && item.bullets.length > 0 ? (
            <ul className="mb-3 space-y-2">
              {item.bullets.map((b, i) => (
                <li key={i} className="flex gap-2.5 text-sm" style={{ color: BODY_TEXT_SOFT }}>
                  <span className="mt-1 shrink-0" style={{ color: accentColor }}>
                    ›
                  </span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {item.formula ? (
            <FormulaBlock formula={item.formula} caption={item.formulaCaption} />
          ) : null}

          {item.table ? <DataTable head={item.table.head} rows={item.table.rows} /> : null}

          {item.answer2 ? (
            <p className="mb-3 text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
              {item.answer2}
            </p>
          ) : null}

          {item.citations && item.citations.length > 0 ? (
            <div className="mt-4">
              <p
                className="mb-2.5 text-xs font-semibold uppercase tracking-widest"
                style={{ color: MUTED }}
              >
                {sourcesLabel}
              </p>
              <div className="flex flex-wrap gap-2">
                {item.citations.map((c) => (
                  <CitationChip key={c.url} label={c.label} url={c.url} />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Faq() {
  const { t } = useTranslation(undefined, { keyPrefix: 'website.faq' });

  const [activeCategoryId, setActiveCategoryId] = useState<CategoryId>('general');
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  const translatedCategories = t('categories', { returnObjects: true }) as Record<
    CategoryId,
    { label: string; items: FaqItem[] }
  >;

  const faqCategories: FaqCategory[] = (Object.keys(CATEGORY_VISUAL_CONFIG) as CategoryId[]).map(
    (id) => ({
      id,
      items: translatedCategories[id].items,
      label: translatedCategories[id].label,
      ...CATEGORY_VISUAL_CONFIG[id],
    })
  );

  const activeCategory = faqCategories.find((c) => c.id === activeCategoryId) ?? faqCategories[0];

  const handleCategoryChange = (id: CategoryId) => {
    setActiveCategoryId(id);
    setOpenQuestion(null);
  };

  return (
    <>
      <main className="relative overflow-hidden pb-24 pt-24">
        <DotPattern className="text-primary/20" />
        <div className="from-background/60 to-background/60 absolute inset-0 bg-gradient-to-b via-transparent" />

        {/* Ambient glows */}
        <div
          className="absolute left-1/4 top-32 h-96 w-96 rounded-full blur-[120px]"
          style={{ backgroundColor: 'rgba(0,255,163,0.07)' }}
          aria-hidden="true"
        />
        <div
          className="absolute bottom-32 right-1/4 h-80 w-80 rounded-full blur-[100px]"
          style={{ backgroundColor: 'rgba(56,189,248,0.07)' }}
          aria-hidden="true"
        />

        <div className="container relative z-10 mx-auto max-w-4xl px-4">
          {/* Hero */}
          <div className="mb-14 text-center">
            <div
              className="mb-4 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
              style={{
                backgroundColor: 'rgba(0,255,163,0.06)',
                borderColor: 'rgba(0,255,163,0.25)',
                color: BRAND_GREEN_BRIGHT,
              }}
            >
              <FlaskConical size={12} color={BRAND_GREEN_BRIGHT} />
              {t('badge')}
            </div>
            <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">
              {t('titlePrefix')}{' '}
              <span style={{ color: BRAND_GREEN_BRIGHT }}>{t('titleHighlight')}</span>
            </h1>
            <p
              className="mx-auto max-w-xl text-sm leading-relaxed md:text-base"
              style={{ color: BODY_TEXT_SOFT }}
            >
              {t('description')}
            </p>
          </div>

          {/* Category tabs */}
          <div className="mb-8 flex flex-wrap justify-center gap-2">
            {faqCategories.map((cat) => {
              const isActive = cat.id === activeCategoryId;
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryChange(cat.id as CategoryId)}
                  className="inline-flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-all"
                  style={{
                    backgroundColor: isActive ? cat.bgColor : 'transparent',
                    borderColor: isActive ? cat.borderColor : 'rgba(255,255,255,0.1)',
                    color: isActive ? cat.color : BODY_TEXT_SOFT,
                  }}
                >
                  <Icon size={15} color={isActive ? cat.color : MUTED} />
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Category header */}
          <div
            className="mb-6 flex items-center gap-3 rounded-2xl border px-5 py-4"
            style={{
              backgroundColor: activeCategory.bgColor,
              borderColor: activeCategory.borderColor,
            }}
          >
            {(() => {
              const Icon = activeCategory.icon;
              return (
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border"
                  style={{
                    backgroundColor: `${activeCategory.color}18`,
                    borderColor: activeCategory.borderColor,
                  }}
                >
                  <Icon size={18} color={activeCategory.color} />
                </div>
              );
            })()}
            <div>
              <h2 className="font-semibold text-white">{activeCategory.label}</h2>
              <p className="text-xs" style={{ color: MUTED }}>
                {t('questionsCount', { count: activeCategory.items.length })}
              </p>
            </div>
          </div>

          {/* Accordion */}
          <div className="space-y-3">
            {activeCategory.items.map((item) => (
              <AccordionItem
                key={item.question}
                accentColor={activeCategory.color}
                isOpen={openQuestion === item.question}
                item={item}
                onToggle={() =>
                  setOpenQuestion(openQuestion === item.question ? null : item.question)
                }
                sourcesLabel={t('sources')}
              />
            ))}
          </div>

          {/* Footer note */}
          <div
            className="mt-14 rounded-2xl border p-6 text-center"
            style={{
              backgroundColor: 'rgba(255,255,255,0.02)',
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <p className="text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
              {t('footer.text')}{' '}
              <a
                href="mailto:support@musclog.app"
                className="font-medium hover:underline"
                style={{ color: BRAND_GREEN_BRIGHT }}
              >
                {t('footer.linkText')}
              </a>{' '}
              {t('footer.suffix')}
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
