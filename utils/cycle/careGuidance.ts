import type { CycleDayLogDto, CycleLifeStage } from './types';

export const CYCLE_EDUCATION = {
  bleeding: 'https://www.nhs.uk/conditions/heavy-periods/',
  pain: 'https://www.nhs.uk/symptoms/period-pain/',
  unexpected: 'https://www.nhs.uk/symptoms/vaginal-bleeding-between-periods-or-after-sex/',
  pms: 'https://www.rcog.org.uk/for-the-public/browse-our-patient-information/managing-premenstrual-syndrome-pms/',
  menopause: 'https://www.nhs.uk/conditions/menopause/symptoms/',
  pregnancy: 'https://www.nhs.uk/pregnancy/',
  postpartum: 'https://www.nhs.uk/pregnancy/labour-and-birth/after-the-birth/your-body/',
  pregnancy_loss: 'https://www.nhs.uk/conditions/miscarriage/',
} as const;
export type CareTopic = keyof typeof CYCLE_EDUCATION;

export const CARE_TOPIC_LABEL_KEYS: Record<CareTopic, string> = {
  bleeding: 'cycle.complete.education.bleeding',
  pain: 'cycle.complete.education.pain',
  unexpected: 'cycle.complete.education.unexpected',
  pms: 'cycle.complete.education.pms',
  menopause: 'cycle.complete.education.menopause',
  pregnancy: 'cycle.complete.education.pregnancy',
  postpartum: 'cycle.complete.education.postpartum',
  pregnancy_loss: 'cycle.complete.education.pregnancy_loss',
};

/** Educational destinations, not an automated diagnosis or urgency classification. */
export function careTopics(log: CycleDayLogDto | undefined, stage: CycleLifeStage): CareTopic[] {
  const topics = new Set<CareTopic>(['pms']);
  if (
    log?.bleeding === 'heavy' ||
    log?.bleeding === 'very_heavy' ||
    log?.observations?.leakage ||
    log?.observations?.clots
  ) {
    topics.add('bleeding');
  }

  if (log?.pain != null && log.pain > 0) {
    topics.add('pain');
  }

  if (
    ['no_bleeding', 'hysterectomy', 'menopause', 'pregnancy'].includes(stage) &&
    log?.bleeding &&
    log.bleeding !== 'none'
  ) {
    topics.add('unexpected');
  }

  if (stage === 'perimenopause' || stage === 'menopause') {
    topics.add('menopause');
  }

  if (stage === 'pregnancy' || stage === 'postpartum' || stage === 'pregnancy_loss') {
    topics.add(stage);
  }

  return [...topics];
}
