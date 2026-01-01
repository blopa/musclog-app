import { expect, test } from '@playwright/test';

test.describe('Onboarding Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to the app's root URL
        await page.goto('http://localhost:8082');
    });

    test('Complete onboarding process', async ({ page }) => {
        // Step 1: Welcome Screen
        await expect(page.locator('text=Welcome to our app')).toBeVisible();
        await page.locator('button:has-text("Next")').click();

        // Step 2: Permissions Request
        await expect(page.locator('text=Sync with Health Connect?')).toBeVisible();
        await page.locator('button:has-text("Request Permission")').click();
        await page.locator('button:has-text("Skip")').click();

        // Step 3: Tell us about yourself
        await expect(page.locator('text=Tell us about yourself')).toBeVisible();

        // Fill out the form
        await page.locator('input[placeholder="Name"]').fill('John Doe');
        await page.locator('input[placeholder="Weight (kg)"]').fill('70');
        await page.locator('input[placeholder="Height (m)"]').fill('1.75');
        await page.locator('input[placeholder="Fitness Goal"]').fill('Build Muscle');
        await page.locator('input[placeholder="Gender"]').fill('Male');
        await page.locator('select:has-text("Bulking")').selectOption('Bulking');
        await page.locator('select:has-text("Sedentary")').selectOption('Sedentary');

        // Submit the form
        await page.locator('button:has-text("Submit")').click();

        // Verify completion
        await expect(page.locator('text=Track Your Fitness Journey')).toBeVisible();
    });
});
