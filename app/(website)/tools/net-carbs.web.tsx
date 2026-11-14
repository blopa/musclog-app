import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type NetCarbsConvention, netCarbsResult } from '@/components/website/tools/netCarbsModel';
import {
  ChoiceField,
  NumberField,
  ResultStat,
  ToolNotice,
  ToolPanel,
} from '@/components/website/tools/ToolFields';
import { ToolLayout, type ToolSection } from '@/components/website/tools/ToolLayout';
import { BODY_TEXT, BODY_TEXT_SOFT } from '@/components/website/websiteColors';
import { fixedPageMetadata } from '@/components/website/websiteMetadata';
import { useFormatAppNumber } from '@/hooks/useFormatAppNumber';

export default function NetCarbsToolPage() {
  const { t } = useTranslation(undefined, { keyPrefix: 'websiteToolNetCarbs' });
  const { formatDecimal } = useFormatAppNumber();
  const [convention, setConvention] = useState<NetCarbsConvention>('total');
  const [carbs, setCarbs] = useState('30');
  const [fiber, setFiber] = useState('5');

  const validation = netCarbsResult({ convention, carbsText: carbs, fiberText: fiber });
  const result = validation.ok ? validation.result : null;
  const problem = validation.ok ? null : validation.problem;
  const sections = t('sections', { returnObjects: true }) as ToolSection[];

  return (
    <ToolLayout
      routeKey="toolNetCarbs"
      title={t('title')}
      intro={t('intro')}
      sections={sections}
      sources={[
        { label: t('sources.eu'), href: 'https://eur-lex.europa.eu/eli/reg/2011/1169/oj' },
        { label: t('sources.fda'), href: 'https://www.fda.gov/media/101183/download' },
      ]}
      related={['proteinCalculator', 'calorieDeficit']}
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_1fr]">
        <ToolPanel>
          <div className="space-y-4">
            <ChoiceField<NetCarbsConvention>
              label={t('form.region')}
              value={convention}
              onChange={setConvention}
              options={[
                { value: 'total', label: t('form.us') },
                { value: 'net', label: t('form.eu') },
              ]}
            />
            <NumberField
              id="net-carbs-carbs"
              label={t('form.carbs')}
              value={carbs}
              onChange={setCarbs}
              suffix="g"
              invalid={problem === 'carbs'}
            />
            <NumberField
              id="net-carbs-fiber"
              label={t('form.fiber')}
              value={fiber}
              onChange={setFiber}
              suffix="g"
              invalid={problem === 'fiber' || problem === 'fiberTooHigh'}
            />
          </div>
        </ToolPanel>

        <div className="flex flex-col gap-4">
          {problem ? <ToolNotice tone="warning">{t(`problems.${problem}`)}</ToolNotice> : null}
          {result ? (
            <>
              <ResultStat
                emphasis
                label={t('results.net')}
                value={`${formatDecimal(result.netCarbs, 1)} g`}
                note={t('results.netNote')}
              />
              <ResultStat
                label={t('results.total')}
                value={`${formatDecimal(result.totalCarbs, 1)} g`}
                note={t('results.totalNote')}
              />
              <ToolPanel title={t('results.logTitle')}>
                <ul className="space-y-2 text-sm" style={{ color: BODY_TEXT }}>
                  <li>
                    {t('results.logTotal', { value: `${formatDecimal(result.totalCarbs, 1)} g` })}
                  </li>
                  <li>
                    {t('results.logNet', { value: `${formatDecimal(result.netCarbs, 1)} g` })}
                  </li>
                </ul>
              </ToolPanel>
            </>
          ) : null}
          <p className="text-sm leading-relaxed" style={{ color: BODY_TEXT_SOFT }}>
            {t('notes.sugarAlcohols')}
          </p>
          <ToolNotice>{t('notes.musclog')}</ToolNotice>
        </div>
      </div>
    </ToolLayout>
  );
}

export function generateMetadata() {
  return fixedPageMetadata('toolNetCarbs');
}
