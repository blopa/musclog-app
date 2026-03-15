const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Feature demonstrations for Musclog app
 * Each feature defines navigation and actions to showcase the feature
 */
const FEATURES = {
  // Default - just shows the dashboard
  dashboard: {
    name: 'Dashboard',
    description: 'Daily calorie and macro summary',
    navigate: async (page) => {
      // Already on dashboard after seeding
    },
    actions: async (page, duration) => {
      // Show summary card
      await page.waitForTimeout(1000);

      // Scroll through dashboard content
      await scrollWithPauses(page, duration * 0.7, 3);

      // Click Track Food button to show modal
      const trackFoodBtn = page.getByText('Track\nFood').first();
      if (await trackFoodBtn.isVisible()) {
        await trackFoodBtn.click({ force: true });
        await page.waitForTimeout(1500);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }
  },

  // Workouts feature
  workouts: {
    name: 'Workouts',
    description: 'Workout templates and exercise library',
    navigate: async (page) => {
      // Navigation item "Workouts" in the bottom bar
      const workoutsTab = page.locator('div, span, p').filter({ hasText: /^Workouts$/ }).last();
      await workoutsTab.waitFor({ state: 'visible' });
      await workoutsTab.click({ force: true });
      await page.waitForTimeout(1000);
    },
    actions: async (page, duration) => {
      // Scroll through workout list
      await scrollWithPauses(page, duration * 0.3, 2);

      // Click on seeded workout "Upper Body Power"
      const upperBodyWorkout = page.getByText('Upper Body Power').first();
      if (await upperBodyWorkout.isVisible()) {
        await upperBodyWorkout.click({ force: true });
        await page.waitForTimeout(1500);

        // Scroll workout overview
        await scrollWithPauses(page, duration * 0.4, 2);

        // Close overview
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      // Continue scrolling
      await scrollWithPauses(page, duration * 0.3, 2);
    }
  },

  // Food/Nutrition feature
  food: {
    name: 'Food',
    description: 'Meal tracking and nutrition logging',
    navigate: async (page) => {
      // Navigation item "Food" in the bottom bar
      const foodTab = page.locator('div, span, p').filter({ hasText: /^Food$/ }).last();
      await foodTab.waitFor({ state: 'visible' });
      await foodTab.click({ force: true });
      await page.waitForTimeout(1000);
    },
    actions: async (page, duration) => {
      // Scroll through meal logs
      await scrollWithPauses(page, duration * 0.6, 3);

      // Show "Add Food" options
      const addBtn = page.getByText('Add Food').first();
      if (await addBtn.isVisible()) {
        await addBtn.click({ force: true });
        await page.waitForTimeout(1500);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      // Continue scrolling
      await scrollWithPauses(page, duration * 0.4, 2);
    }
  },

  // AI Coach feature
  coach: {
    name: 'Coach',
    description: 'AI-powered fitness and nutrition assistant',
    navigate: async (page) => {
      // Navigation uses "Chat" label for Coach
      const coachTab = page.locator('div, span, p').filter({ hasText: /^Chat$/ }).last();
      await coachTab.waitFor({ state: 'visible' });
      await coachTab.click({ force: true });
      await page.waitForTimeout(1000);
    },
    actions: async (page, duration) => {
      // Wait to see the chat interface
      await page.waitForTimeout(2000);

      // Simulated interaction
      const input = page.getByPlaceholder(/Ask me anything/i).first();
      if (await input.isVisible()) {
        await input.fill('Give me a high protein snack idea');
        await page.waitForTimeout(1000);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2000);
      }

      // Scroll through chat history if any
      await scrollWithPauses(page, duration * 0.6, 2);
    }
  },

  // Progress/Stats feature
  progress: {
    name: 'Progress',
    description: 'TDEE calculations and progress charts',
    navigate: async (page) => {
      // Try finding Progress in nav or go to Profile first
      const progressTab = page.locator('div, span, p').filter({ hasText: /^Progress$/ }).last();
      if (await progressTab.isVisible()) {
        await progressTab.click({ force: true });
      } else {
        const profileTab = page.locator('div, span, p').filter({ hasText: /^Profile$/ }).last();
        await profileTab.click({ force: true });
        await page.waitForTimeout(800);
        const historyBtn = page.getByText('History').first();
        await historyBtn.click({ force: true });
      }
      await page.waitForTimeout(1500);
    },
    actions: async (page, duration) => {
      // Show charts
      await page.waitForTimeout(1000);

      // Try clicking different time filters
      const filters = ['7D', '30D'];
      for (const filter of filters) {
        const filterBtn = page.getByText(filter, { exact: true }).first();
        if (await filterBtn.isVisible()) {
          await filterBtn.click({ force: true });
          await page.waitForTimeout(1500);
        }
      }

      // Scroll through different chart sections
      await scrollWithPauses(page, duration * 0.7, 4);
    }
  },

  // Cycle tracking feature
  cycle: {
    name: 'Cycle',
    description: 'Menstrual cycle and energy tracking',
    navigate: async (page) => {
      // Direct navigation to cycle if possible, otherwise via profile
      await page.evaluate(() => window.location.hash = '/cycle');
      await page.waitForTimeout(1500);
    },
    actions: async (page, duration) => {
      // Highlight the Phase Wheel
      await page.waitForTimeout(2000);

      // Scroll for insights
      await scrollWithPauses(page, duration * 0.7, 3);
    }
  },

  // Profile feature
  profile: {
    name: 'Profile',
    description: 'User stats and fitness goals',
    navigate: async (page) => {
      const profileTab = page.locator('div, span, p').filter({ hasText: /^Profile$/ }).last();
      await profileTab.waitFor({ state: 'visible' });
      await profileTab.click({ force: true });
      await page.waitForTimeout(1000);
    },
    actions: async (page, duration) => {
      // Show stats
      await page.waitForTimeout(1500);

      // Scroll through profile items
      await scrollWithPauses(page, duration * 0.8, 3);
    }
  },

  // AI Camera feature
  camera: {
    name: 'Camera',
    description: 'AI meal photo tracking',
    navigate: async (page) => {
      // Center camera button (it doesn't have text)
      // It's the 3rd Pressable in the bottom nav usually, or has a specific SVG
      const cameraBtn = page.locator('div[role="button"]').nth(2); // Heuristic for center button
      await cameraBtn.click({ force: true });
      await page.waitForTimeout(1000);
    },
    actions: async (page, duration) => {
      // Showcase the camera modal
      await page.waitForTimeout(2000);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  },

  // Settings feature
  settings: {
    name: 'Settings',
    description: 'App configuration and preferences',
    navigate: async (page) => {
      // Navigate via Profile -> Settings icon or direct hash
      await page.evaluate(() => window.location.hash = '/settings');
      await page.waitForTimeout(1500);
    },
    actions: async (page, duration) => {
      // Scroll through main settings
      await scrollWithPauses(page, duration * 0.3, 2);

      // Showcase a specific setting (e.g., AI Settings)
      const aiSettings = page.getByText('AI Settings').first();
      if (await aiSettings.isVisible()) {
        await aiSettings.click({ force: true });
        await page.waitForTimeout(1500);

        // Scroll AI settings
        await scrollWithPauses(page, duration * 0.4, 2);

        // Close
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      // Continue scrolling
      await scrollWithPauses(page, duration * 0.3, 2);
    }
  }
};

/**
 * Helper: Scroll with pauses for better viewing
 */
async function scrollWithPauses(page, duration, numScrolls) {
  const scrollInterval = duration / numScrolls;
  for (let i = 0; i < numScrolls; i++) {
    await page.evaluate(() => {
      window.scrollBy({ top: 250, behavior: 'smooth' });
    });
    await page.waitForTimeout(scrollInterval);
  }
}

/**
 * Get list of available features
 */
function getAvailableFeatures() {
  return Object.entries(FEATURES).map(([key, feature]) => ({
    key,
    name: feature.name,
    description: feature.description
  }));
}

/**
 * Record a website
 */
async function recordWebsite(options = {}) {
  const {
    url = 'http://localhost:8081/onboarding/landing?demoModeEnabled=true',
    outputPath = '/tmp/recordings/output.webm',
    duration = 10000,
    viewport = null,
    mobile = true,
    headless = true,
    feature = 'dashboard'
  } = options;

  const featureScript = FEATURES[feature];
  if (!featureScript) {
    const available = getAvailableFeatures().map(f => `${f.key}`).join(', ');
    throw new Error(`Unknown feature: "${feature}". Available: ${available}`);
  }

  let finalViewport = { width: 390, height: 844 }; // iPhone 12 Pro
  let userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
  let deviceScaleFactor = 3;

  if (!mobile && viewport) {
    finalViewport = viewport;
    userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    deviceScaleFactor = 1;
  }

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const videoDir = path.join(outputDir, `.video-${Date.now()}`);
  fs.mkdirSync(videoDir, { recursive: true });

  console.log(`🎥 Preparing to record feature: ${featureScript.name}`);

  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    viewport: finalViewport,
    deviceScaleFactor,
    userAgent,
    isMobile: mobile,
    hasTouch: mobile,
    recordVideo: {
      dir: videoDir,
      size: { width: finalViewport.width, height: finalViewport.height }
    }
  });

  const page = await context.newPage();
  const recordingStartTime = Date.now();

  console.log(`🌐 Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

  // Wait for data seeding / onboarding redirect
  console.log('⏳ Waiting for data seeding and redirect...');
  let attempts = 0;
  let appReady = false;
  while (attempts < 120) {
    const currentPath = await page.evaluate(() => window.location.pathname);
    if (currentPath === '/') {
      // Check for a characteristic element on the home screen
      const goodEvening = await page.getByText(/Good Evening/i).isVisible();
      const alexJohnson = await page.getByText(/Alex Johnson/i).isVisible();
      if (goodEvening || alexJohnson) {
        console.log(`✅ App ready and content loaded at: ${currentPath}`);
        appReady = true;
        break;
      }
    }
    await page.waitForTimeout(1000);
    attempts++;
  }

  if (!appReady) {
    console.warn('⚠️ App might not have loaded content fully, proceeding anyway...');
  }

  await page.waitForTimeout(2000); // Final render wait
  const readyTime = Date.now();

  try {
    console.log(`🎬 Executing: ${featureScript.name}`);
    await featureScript.navigate(page);
    await featureScript.actions(page, duration);
    console.log('✅ Recording actions complete!');
  } catch (error) {
    console.error('❌ Error during actions:', error.message);
  } finally {
    // Small wait before closing to ensure final frames are captured
    await page.waitForTimeout(1000);
    await context.close();
    await browser.close();
  }

  // Handle video processing
  const videoFiles = fs.readdirSync(videoDir).filter(f => f.endsWith('.webm'));
  if (videoFiles.length > 0) {
    const latestVideo = path.join(videoDir, videoFiles[0]);
    const timeToTrimSeconds = ((readyTime - recordingStartTime) / 1000).toFixed(2);

    // Copy to final destination
    fs.copyFileSync(latestVideo, outputPath);

    try {
      console.log(`✂️ Attempting to trim ${timeToTrimSeconds}s from the beginning...`);
      const tempOutput = outputPath.replace('.webm', '.trimmed.webm');
      // Try using ffmpeg if available
      execSync(`ffmpeg -ss ${timeToTrimSeconds} -i "${outputPath}" -c copy "${tempOutput}"`, { stdio: 'ignore' });
      fs.renameSync(tempOutput, outputPath);
      console.log('✅ Video trimmed successfully.');
    } catch (e) {
      console.log('⚠️ Ffmpeg trim failed or not available, using raw video (includes seeding wait).');
    }

    fs.rmSync(videoDir, { recursive: true, force: true });
    return outputPath;
  }
  throw new Error('Video generation failed');
}

async function main() {
  const args = process.argv.slice(2);
  let feature = 'dashboard';
  let outputPath = null;
  let duration = 10000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--feature' || args[i] === '-f') feature = args[++i];
    else if (args[i] === '--duration' || args[i] === '-d') duration = parseInt(args[++i]);
    else if (args[i] === '--list' || args[i] === '-l') {
      console.log('Available features:');
      getAvailableFeatures().forEach(f => console.log(` - ${f.key}: ${f.description}`));
      process.exit(0);
    }
    else if (!args[i].startsWith('--')) {
      if (!outputPath) outputPath = args[i];
      else if (!isNaN(parseInt(args[i]))) duration = parseInt(args[i]);
    }
  }

  if (!outputPath) {
    outputPath = `/tmp/recordings/musclog-${feature}-${Date.now()}.webm`;
  }

  try {
    const result = await recordWebsite({ feature, outputPath, duration });
    console.log(`\n🎉 Success! Video saved to: ${result}`);
  } catch (e) {
    console.error(`\n💥 Failed: ${e.message}`);
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { recordWebsite, FEATURES };
