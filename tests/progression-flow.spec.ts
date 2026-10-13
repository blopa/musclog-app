import { expect, test } from '@playwright/test';

import enFeedback from '../lang/locales/en-us/sessionFeedback.json';
import nlFeedback from '../lang/locales/nl-nl/sessionFeedback.json';
import en from '../lang/locales/en-us/workoutSession.json';
import nl from '../lang/locales/nl-nl/workoutSession.json';
import enEnd from '../lang/locales/en-us/endWorkout.json';
import nlEnd from '../lang/locales/nl-nl/endWorkout.json';

const app = '/app';

test('logs, switches views, restores timer and drafts, undoes targets, reviews independently, and retains targets', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const comma = testInfo.project.name === 'tablet-comma';
  const copy = comma ? nl : en;
  const locale = comma ? 'nl-NL' : 'en-US';
  const theme = testInfo.project.name === 'phone-light' ? 'light' : 'dark';
  await page.addInitScript(() => {
    localStorage.setItem('onboardingCompleted', 'true');
    localStorage.setItem('onboardingVersion', '1.0.0');
  });
  await page.goto(`${app}/test/progression-flow?locale=${locale}&theme=${theme}`);
  await page.getByTestId('seed-progression').click();
  await expect(page.getByTestId('session-rest-timer')).toBeVisible({ timeout: 120000 });
  const sessionURL = page.url();
  const previous = page.locator('[data-testid$="-previous"]');
  await expect(previous).toHaveCount(3);
  await expect(previous.first()).toContainText('60 × 12');
  expect(await previous.first().evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(
    true
  );
  const weights = page.locator('input[data-testid$="-weight"]');
  await expect(weights).toHaveCount(3);
  await weights.first().fill(comma ? '62,5' : '62.5');
  await page.getByRole('radio', { name: copy.trainingFlow.guided, exact: true }).click();
  await expect(page.locator('input[data-testid$="-weight"]').first()).toHaveValue(
    comma ? '62,5' : '62.5'
  );
  await page.getByRole('button', { name: copy.trainingFlow.complete, exact: true }).click();
  await expect(page.getByTestId('session-rest-timer')).toContainText(copy.trainingFlow.rest);
  await page.getByRole('radio', { name: copy.trainingFlow.inline, exact: true }).click();
  await expect(
    page.getByRole('button', { name: copy.trainingFlow.reopen, exact: true })
  ).toHaveCount(1);
  await expect(weights.first()).not.toBeEditable();
  await page.getByRole('button', { name: copy.trainingFlow.reopen, exact: true }).click();
  await expect(weights.first()).toBeEditable();
  await page.getByRole('button', { name: copy.trainingFlow.complete, exact: true }).first().click();
  await weights.nth(1).fill(comma ? '63,5' : '63.5');
  await page.reload();
  await expect(page.getByTestId('session-rest-timer')).toContainText(copy.trainingFlow.rest);
  await expect(weights.nth(1)).toHaveValue(comma ? '63,5' : '63.5');
  await page.getByTestId('set-adjustment-revert').first().click();
  await expect(weights.nth(1)).toHaveValue('60');
  await expect(weights.nth(2)).toHaveValue('60');
  await page.reload();
  await expect(weights.nth(1)).toHaveValue('60');
  await expect(weights.nth(2)).toHaveValue('60');
  await page.goto(`${app}/nutrition/checkin-list`);
  await expect(page.getByTestId('review-training')).toBeVisible();
  await expect(page.getByTestId('review-nutrition')).toBeVisible();
  await page.screenshot({ path: `/tmp/musclog-${testInfo.project.name}-review.png` });
  await page.getByRole('button', { name: copy.weeklyReview.editShort, exact: true }).click();
  await page
    .getByRole('button', { name: /Cancel|Annuleren/ })
    .last()
    .click();
  await expect(
    page.getByRole('button', { name: copy.weeklyReview.applyTomorrow, exact: true })
  ).toBeEnabled();
  // Nobody in this fixture has finished a workout yet, so training asks nothing of them: the
  // section counts as reviewed and offers no decision. (The decision itself is pinned by the
  // weekly-review integration tests, which can finish a workout.)
  await expect(page.getByTestId('review-training')).toContainText(copy.weeklyReview.reviewed);
  await expect(page.getByTestId('review-training-decision')).toHaveCount(0);
  await page.getByRole('button', { name: copy.weeklyReview.applyTomorrow, exact: true }).click();
  await expect(page.getByTestId('review-nutrition')).toContainText(copy.weeklyReview.applied);
  await page.reload();
  await expect(page.getByTestId('review-nutrition')).toContainText(copy.weeklyReview.applied);
  for (const path of ['', '/workout/workouts', '/nutrition/food']) {
    await page.goto(`${app}${path}`);
    await expect(page.getByTestId('weekly-review-entry')).toBeVisible();
    await page.getByTestId('weekly-review-entry').click();
    await expect(page.getByTestId('weekly-review')).toBeVisible();
  }
  await page.goto(sessionURL);
  await expect(weights.first()).toHaveValue(comma ? '62,5' : '62.5');
  await expect(
    page.getByRole('button', { name: copy.trainingFlow.reopen, exact: true })
  ).toHaveCount(1);
  await page.screenshot({ path: `/tmp/musclog-${testInfo.project.name}-workout.png` });
  await page.context().setOffline(true);
  await page.getByRole('button', { name: copy.trainingFlow.complete, exact: true }).first().click();
  await page.getByRole('button', { name: copy.trainingFlow.complete, exact: true }).first().click();
  await expect(
    page.getByRole('button', { name: copy.trainingFlow.reopen, exact: true })
  ).toHaveCount(3);
  await expect(
    page.getByRole('button', { name: copy.trainingFlow.actions.swap, exact: true })
  ).toBeDisabled();
  await page.getByRole('button', { name: copy.trainingFlow.finish, exact: true }).click();
  await page
    .getByRole('button', { name: (comma ? nlEnd : enEnd).endWorkout.finishAndSave, exact: true })
    .click();
  await expect(page.getByText(copy.trainingFlow.nextTime, { exact: true })).toBeVisible();
  const feedback = (comma ? nlFeedback : enFeedback).sessionFeedback;
  await page.getByRole('button', { name: feedback.title, exact: true }).click();
  await page.getByPlaceholder(feedback.notesPlaceholder).fill('Good session');
  await page.getByRole('button', { name: feedback.submit, exact: true }).click();
  await expect(page.getByPlaceholder(feedback.notesPlaceholder)).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.screenshot({ path: `/tmp/musclog-${testInfo.project.name}.png`, fullPage: true });
});
