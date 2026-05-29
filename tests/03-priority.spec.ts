import { test, expect } from '@playwright/test';
import { setupVirtualAuthenticator } from './helpers';

test.describe('Priority System', () => {
  test.beforeEach(async ({ page }) => {
    await setupVirtualAuthenticator(page);
    const username = `priority-user-${Date.now()}`;
    await page.goto('/login');
    await page.fill('input[type="text"]', username);
    await page.click('button:has-text("Register")');
    await page.waitForURL('/');
  });

  test('create todo defaults to medium priority', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    const select = page.locator('select:near(:text("Priority"))');
    await expect(select).toHaveValue('medium');
    await page.fill('input[placeholder="What needs to be done?"]', 'Medium todo');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=Medium')).toBeVisible();
  });

  test('create todo with high priority — red badge shown', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'High priority');
    await page.selectOption('select:near(:text("Priority"))', 'high');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=High')).toBeVisible();
  });

  test('create todo with low priority — blue badge shown', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Low priority');
    await page.selectOption('select:near(:text("Priority"))', 'low');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=Low')).toBeVisible();
  });

  test('filter by high priority — only high todos shown', async ({ page }) => {
    // Create a high and a low priority todo
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'High one');
    await page.selectOption('select:near(:text("Priority"))', 'high');
    await page.click('button:has-text("Create")');

    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Low one');
    await page.selectOption('select:near(:text("Priority"))', 'low');
    await page.click('button:has-text("Create")');

    // Filter by high
    await page.selectOption('select[aria-label="Filter by priority"]', 'high');
    await expect(page.locator('text=High one')).toBeVisible();
    await expect(page.locator('text=Low one')).not.toBeVisible();
  });

  test('clear priority filter — all todos restored', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Any todo');
    await page.click('button:has-text("Create")');

    await page.selectOption('select[aria-label="Filter by priority"]', 'high');
    await page.selectOption('select[aria-label="Filter by priority"]', 'all');
    await expect(page.locator('text=Any todo')).toBeVisible();
  });
});
