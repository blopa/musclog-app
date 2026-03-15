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
      await page.locator('div, span, p').filter({ hasText: /^Home$/ }).last().click().catch(() => {});
      await page.waitForTimeout(800);
    },
    actions: async (page, duration) => {
      await scrollWithPauses(page, duration, 3);
    }
  },

  // Workouts feature
  workouts: {
    name: 'Workouts',
    description: 'Workout templates and exercise library',
    navigate: async (page) => {
      const workoutsTab = page.locator('div, span, p').filter({ hasText: /^Workouts$/ }).last();
      await workoutsTab.click();
      await page.waitForTimeout(1000);
    },
    actions: async (page, duration) => {
      // Scroll through workout list
      await scrollWithPauses(page, duration * 0.4, 2);

      // Click on first workout to show preview
      // The seeder creates "Grouped Test Workout"
      const firstWorkout = page.locator('div, span, p').filter({ hasText: /Test Workout|Full Body/ }).first();
      if (await firstWorkout.isVisible()) {
        await firstWorkout.click();
        await page.waitForTimeout(1000);

        // Scroll workout details
        await scrollWithPauses(page, duration * 0.3, 2);

        // Go back (usually a close button or back arrow)
        // Using escape or clicking outside might work, but let's try to find the X button or just goBack if it pushed a route
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }

      await scrollWithPauses(page, duration * 0.3, 2);
    }
  },

  // Food/Nutrition feature
  food: {
    name: 'Food',
    description: 'Meal tracking and nutrition search',
    navigate: async (page) => {
      const foodTab = page.locator('div, span, p').filter({ hasText: /^Food$/ }).last();
      await foodTab.click();
      await page.waitForTimeout(1000);
    },
    actions: async (page, duration) => {
      // Scroll through existing meals
      await scrollWithPauses(page, duration * 0.3, 2);

      // Simulate adding a food
      const addFoodBtn = page.locator('div, span, p').filter({ hasText: /^Add Food$/ }).first();
      if (await addFoodBtn.isVisible()) {
        await addFoodBtn.click();
        await page.waitForTimeout(800);

        // Type in search
        const searchInput = page.locator('input[placeholder*="Search"], input[type="text"]').first();
        if (await searchInput.isVisible()) {
          await typeHumanLike(page, searchInput, 'Peanut Butter');
          await page.waitForTimeout(1500); // Wait for results

          // Scroll results if any
          await page.mouse.wheel(0, 300);
          await page.waitForTimeout(800);

          // Close search
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }

      await scrollWithPauses(page, duration * 0.4, 2);
    }
  },

  // AI Coach feature
  coach: {
    name: 'AI Coach',
    description: 'Interactive fitness and nutrition assistant',
    navigate: async (page) => {
      const coachTab = page.locator('div, span, p').filter({ hasText: /^Chat$/ }).last();
      await coachTab.click();
      await page.waitForTimeout(1500); // Wait for entrance animation
    },
    actions: async (page, duration) => {
      const input = page.locator('input[placeholder*="Type a message"], textarea').first();
      if (await input.isVisible()) {
        await typeHumanLike(page, input, "How many calories should I eat to lose weight safely?");
        await page.waitForTimeout(500);
        await page.keyboard.press('Enter');

        // Wait for "AI is thinking" or response
        await page.waitForTimeout(duration - 4000);
      }
    }
  },

  // Progress/Stats feature
  progress: {
    name: 'Progress',
    description: 'TDEE calculations and progress charts',
    navigate: async (page) => {
      // Usually accessible via User Menu or Profile, let's try direct navigation if tab isn't visible
      // But we know it's often a tab too.
      const progressTab = page.locator('div, span, p').filter({ hasText: /^Progress$/ }).last();
      if (await progressTab.isVisible()) {
        await progressTab.click();
      } else {
        // Fallback: Click profile then progress if needed, or just goto
        await page.evaluate(() => window.location.hash = '#/progress');
      }
      await page.waitForTimeout(1500);
    },
    actions: async (page, duration) => {
      // Cycle through time filters
      const filters = ['7D', '30D', '90D', 'All'];
      for (const filter of filters) {
        const btn = page.locator('div, span, p').filter({ hasText: new RegExp(`^${filter}$`) }).first();
        if (await btn.isVisible()) {
          await btn.click({ force: true });
          await page.waitForTimeout(1200);
        }
      }

      await scrollWithPauses(page, duration * 0.4, 3);
    }
  },

  // Cycle tracking feature
  cycle: {
    name: 'Cycle',
    description: 'Menstrual cycle and energy tracking',
    navigate: async (page) => {
      const cycleTab = page.locator('div, span, p').filter({ hasText: /^Cycle$/ }).last();
      if (await cycleTab.isVisible()) {
        await cycleTab.click();
      } else {
        await page.evaluate(() => window.location.hash = '#/cycle');
      }
      await page.waitForTimeout(1500);
    },
    actions: async (page, duration) => {
      await scrollWithPauses(page, duration, 3);
    }
  },

  // Profile feature
  profile: {
    name: 'Profile',
    description: 'User stats and body metrics',
    navigate: async (page) => {
      const profileTab = page.locator('div, span, p').filter({ hasText: /^Profile$/ }).last();
      await profileTab.click();
      await page.waitForTimeout(1000);
    },
    actions: async (page, duration) => {
      await scrollWithPauses(page, duration, 4);
    }
  },

  // Settings feature
  settings: {
    name: 'Settings',
    description: 'App configuration and preferences',
    navigate: async (page) => {
      // Settings is often in the User Menu or a separate tab
      const settingsTab = page.locator('div, span, p').filter({ hasText: /^Settings$/ }).last();
      if (await settingsTab.isVisible()) {
        await settingsTab.click();
      } else {
        // Try opening user menu first
        const avatar = page.locator('div[className*="rounded-full"]').first();
        if (await avatar.isVisible()) {
          await avatar.click();
          await page.waitForTimeout(500);
          await page.locator('text=Settings').first().click();
        } else {
          await page.evaluate(() => window.location.hash = '#/settings');
        }
      }
      await page.waitForTimeout(1000);
    },
    actions: async (page, duration) => {
      await scrollWithPauses(page, duration, 3);
    }
  }
};

/**
 * Helper: Human-like typing
 */
async function typeHumanLike(page, locator, text) {
  await locator.focus();
  for (const char of text) {
    await page.keyboard.type(char);
    await page.waitForTimeout(Math.random() * 100 + 50);
  }
}

/**
 * Helper: Scroll with pauses for better viewing
 */
async function scrollWithPauses(page, duration, numScrolls) {
  const scrollInterval = duration / numScrolls;
  for (let i = 0; i < numScrolls; i++) {
    const scrollAmount = 200 + Math.random() * 100;
    await page.evaluate((amount) => {
      window.scrollBy({ top: amount, behavior: 'smooth' });
    }, scrollAmount);
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
 * Record a video of a website
 */
async function recordWebsite(options = {}) {
  const {
    url = 'http://localhost:8081/onboarding/landing?demoModeEnabled=true',
    outputPath = '/tmp/recordings/output.webm',
    duration = 10000,
    viewport = null,
    mobile = false,
    headless = true,
    feature = 'dashboard'
  } = options;

  const featureScript = FEATURES[feature];
  if (!featureScript) {
    const available = getAvailableFeatures().map(f => `${f.key} (${f.name})`).join(', ');
    throw new Error(`Unknown feature: "${feature}". Available: ${available}`);
  }

  let finalViewport = { width: 390, height: 844 }; // iPhone 12 Pro
  let userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1';
  let deviceScaleFactor = 3;
  let isMobile = true;

  if (!mobile && viewport) {
    finalViewport = viewport;
    userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    isMobile = false;
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
    isMobile,
    hasTouch: isMobile,
    recordVideo: {
      dir: videoDir,
      size: { width: finalViewport.width, height: finalViewport.height }
    }
  });

  const page = await context.newPage();
  const recordingStartTime = Date.now();

  console.log(`🌐 Navigating to ${url}...`);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

  console.log('⏳ Waiting for data seeding and redirect...');
  // Landing page has a "Resetting Database" or "Seeding Data" state
  // We wait for it to redirect to "/"
  try {
    await page.waitForURL(u => u.pathname === '/' || u.hash === '#/' || u.pathname.includes('dashboard'), { timeout: 30000 });
  } catch (e) {
    console.log('   Timeout waiting for redirect, continuing anyway...');
  }

  // Additional wait for any dynamic content/animations
  await page.waitForTimeout(2000);
  console.log(`✅ App ready and content loaded at: ${await page.evaluate(() => window.location.pathname)}`);

  const readyTime = Date.now();
  const timeToTrimSeconds = ((readyTime - recordingStartTime) / 1000).toFixed(2);

  try {
    console.log(`🎬 Executing: ${featureScript.name}`);
    await featureScript.navigate(page);
    await featureScript.actions(page, duration);
    console.log('✅ Actions complete!');
  } catch (error) {
    console.error('❌ Error during actions:', error.message);
  } finally {
    await context.close();
    await browser.close();
  }

  const videoFiles = fs.readdirSync(videoDir).filter(f => f.endsWith('.webm'));
  if (videoFiles.length > 0) {
    const latestVideo = path.join(videoDir, videoFiles[0]);
    fs.copyFileSync(latestVideo, outputPath);

    try {
      console.log(`✂️ Attempting to trim ${timeToTrimSeconds}s from the beginning...`);
      const tempTrimmed = outputPath.replace('.webm', '.trimmed.webm');
      execSync(`ffmpeg -ss ${timeToTrimSeconds} -i "${outputPath}" -c copy -avoid_negative_ts make_zero "${tempTrimmed}"`, { stdio: 'ignore' });
      fs.renameSync(tempTrimmed, outputPath);
      console.log(`✅ Trimmed successfully`);
    } catch (e) {
      console.log(`⚠️ Ffmpeg trim failed or not available, using raw video (includes seeding wait).`);
    }

    fs.rmSync(videoDir, { recursive: true, force: true });
    console.log(`\n🎉 Success! Video saved to: ${outputPath}`);
    return outputPath;
  } else {
    fs.rmSync(videoDir, { recursive: true, force: true });
    throw new Error('No video file was created');
  }
}

async function main() {
  const args = process.argv.slice(2);
  let outputPath = '/tmp/recordings/musclog-demo.webm';
  let duration = 10000;
  let mobileFlag = true;
  let feature = 'dashboard';
  let headless = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--mobile' || arg === '-m') mobileFlag = true;
    else if (arg === '--desktop' || arg === '-d') mobileFlag = false;
    else if (arg === '--feature' || arg === '-f') feature = args[++i];
    else if (arg === '--duration') duration = parseInt(args[++i]);
    else if (arg === '--headful') headless = false;
    else if (arg === '--headless') headless = true;
    else if (!arg.startsWith('--')) {
      if (arg.endsWith('.webm')) outputPath = arg;
      else if (!isNaN(parseInt(arg))) duration = parseInt(arg);
      else outputPath = arg;
    }
  }

  try {
    await recordWebsite({ outputPath, duration, mobile: mobileFlag, feature, headless });
    process.exit(0);
  } catch (error) {
    console.error('\n💥 Failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { recordWebsite, getAvailableFeatures, FEATURES };
