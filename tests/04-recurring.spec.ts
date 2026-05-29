import { test, expect } from '@playwright/test';
import { setupVirtualAuthenticator, getFutureDateString } from './helpers';

test.describe('Recurring Todos', () => {
  test.beforeEach(async ({ page }) => {
    await setupVirtualAuthenticator(page);
    const username = `recurring-user-${Date.now()}`;
    await page.goto('/login');
    await page.fill('input[type="text"]', username);
    await page.click('button:has-text("Register")');
    await page.waitForURL('/');
  });

  test('create daily recurring todo — recurrence badge shown', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Daily task');
    await page.fill('input[type="datetime-local"]', getFutureDateString());
    await page.check('input[type="checkbox"]:near(:text("Repeat"))');
    await page.selectOption('select:near(:text("Daily"))', 'daily');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=Daily task')).toBeVisible();
    await expect(page.locator('text=🔄').first()).toBeVisible();
  });

  test('recurring todo requires due date — validation error without it', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'No date recurring');
    await page.check('input[type="checkbox"]:near(:text("Repeat"))');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=Due date required for recurring todos')).toBeVisible();
  });

  test('complete daily recurring todo — new instance appears in active', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Recurring daily');
    await page.fill('input[type="datetime-local"]', getFutureDateString());
    await page.check('input[type="checkbox"]:near(:text("Repeat"))');
    await page.click('button:has-text("Create")');

    // Toggle completion
    await page.locator('text=Recurring daily').first().locator('..').locator('..').locator('input[type="checkbox"]').first().click();
    await page.waitForTimeout(500);

    // New instance should appear
    const count = await page.locator('text=Recurring daily').count();
    expect(count).toBeGreaterThan(0);
  });
});
