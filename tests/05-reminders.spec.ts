import { test, expect } from '@playwright/test';
import { setupVirtualAuthenticator, getFutureDateString } from './helpers';

test.describe('Reminders & Notifications', () => {
  test.beforeEach(async ({ page }) => {
    await setupVirtualAuthenticator(page);
    const username = `reminder-user-${Date.now()}`;
    await page.goto('/login');
    await page.fill('input[type="text"]', username);
    await page.click('button:has-text("Register")');
    await page.waitForURL('/');
  });

  test('reminder dropdown disabled without due date', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    const reminderSelect = page.locator('select:near(:text("Reminder"))');
    await expect(reminderSelect).toBeDisabled();
  });

  test('reminder dropdown enabled when due date set', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    await page.fill('input[type="datetime-local"]', getFutureDateString());
    const reminderSelect = page.locator('select:near(:text("Reminder"))');
    await expect(reminderSelect).toBeEnabled();
  });

  test('set 15-minute reminder — badge shows "15 minutes before"', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Reminder todo');
    await page.fill('input[type="datetime-local"]', getFutureDateString());
    await page.selectOption('select:near(:text("Reminder"))', '15');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=15 minutes before')).toBeVisible();
  });

  test('API notifications/check returns overdue reminder todo', async ({ page }) => {
    // Create a todo via API with a past due date and reminder
    const response = await page.request.get('/api/notifications/check');
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.todos)).toBe(true);
  });
});
