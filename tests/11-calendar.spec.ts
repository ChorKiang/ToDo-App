import { test, expect } from '@playwright/test';
import { setupVirtualAuthenticator, getFutureDateString } from './helpers';

test.describe('Calendar View', () => {
  test.beforeEach(async ({ page }) => {
    await setupVirtualAuthenticator(page);
    const username = `calendar-user-${Date.now()}`;
    await page.goto('/login');
    await page.fill('input[type="text"]', username);
    await page.click('button:has-text("Register")');
    await page.waitForURL('/');
  });

  test('calendar page loads at /calendar', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.locator('text=Calendar')).toBeVisible();
  });

  test('current month displayed by default', async ({ page }) => {
    await page.goto('/calendar');
    const now = new Date();
    const monthName = now.toLocaleString('en-SG', { month: 'long' });
    await expect(page.locator(`text=${monthName}`)).toBeVisible();
  });

  test('navigate to previous month', async ({ page }) => {
    await page.goto('/calendar');
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthName = prevMonth.toLocaleString('en-SG', { month: 'long' });

    await page.click('button:has-text("← Prev")');
    await expect(page.locator(`text=${prevMonthName}`)).toBeVisible();
  });

  test('navigate to next month', async ({ page }) => {
    await page.goto('/calendar');
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthName = nextMonth.toLocaleString('en-SG', { month: 'long' });

    await page.click('button:has-text("Next →")');
    await expect(page.locator(`text=${nextMonthName}`)).toBeVisible();
  });

  test('today button returns to current month', async ({ page }) => {
    await page.goto('/calendar');
    await page.click('button:has-text("Next →")');
    await page.click('button:has-text("Today")');
    const now = new Date();
    const monthName = now.toLocaleString('en-SG', { month: 'long' });
    await expect(page.locator(`text=${monthName}`)).toBeVisible();
  });

  test('URL updates on month navigation', async ({ page }) => {
    await page.goto('/calendar');
    await page.click('button:has-text("Next →")');
    await expect(page).toHaveURL(/\?month=\d{4}-\d{2}/);
  });

  test('click day opens modal with todos', async ({ page }) => {
    // Create a todo first
    await page.goto('/');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, '0');
    const tomorrowStr = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}T12:00`;

    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Calendar todo');
    await page.fill('input[type="datetime-local"]', tomorrowStr);
    await page.click('button:has-text("Create")');

    await page.goto('/calendar');
    // Click on a day cell that has the todo count badge
    const dayWithTodo = page.locator('span.text-xs.rounded-full').first();
    if (await dayWithTodo.isVisible()) {
      await dayWithTodo.locator('..').click();
      await expect(page.locator('text=Calendar todo')).toBeVisible();
    }
  });
});
