import os
import asyncio
from playwright.async_api import async_playwright

async def verify():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Use a context to set localStorage
        context = await browser.new_context()
        page = await context.new_page()

        # Go to a blank page first to be able to set localStorage for the domain
        await page.goto("http://localhost:8081/musclog-app/")

        # Bypass onboarding
        await page.evaluate("""
            localStorage.setItem('onboardingCompleted', 'true');
            localStorage.setItem('onboardingVersion', '1');
        """)

        # Reload to apply changes
        await page.goto("http://localhost:8081/musclog-app/")
        await page.wait_for_load_state("domcontentloaded")

        # Wait a bit for hydration
        await asyncio.sleep(5)
        await page.screenshot(path="after_bypass.png", full_page=True)

        # Try to navigate to AI Settings directly if possible, or click through Profile
        # Based on app/_layout.tsx, we might have a bottom tab or side menu
        # Let's try to find the Profile link/icon

        # In many Musclog versions, the user menu is accessible via an icon or 'Profile' text
        try:
            # Try to click on Profile in bottom tab or similar
            profile_selectors = ["text=Profile", "accessibility-label=Profile", "svg"]
            for selector in profile_selectors:
                if await page.locator(selector).is_visible():
                    await page.click(selector)
                    break

            await asyncio.sleep(2)
            await page.screenshot(path="profile_page.png", full_page=True)

            # Look for "AI Settings" or "Connect ChatGPT"
            if await page.locator("text=AI Settings").is_visible():
                await page.click("text=AI Settings")
            elif await page.locator("text=Connect ChatGPT").is_visible():
                # Maybe it's directly on the profile page
                pass

            await asyncio.sleep(2)
            await page.screenshot(path="ai_settings_modal.png", full_page=True)

        except Exception as e:
            print(f"Error during navigation: {e}")
            await page.screenshot(path="error_nav.png", full_page=True)

        await browser.close()

if __name__ == "__main__":
    # Ensure server is running or start it
    # We'll assume the server is already started from previous turns
    asyncio.run(verify())
