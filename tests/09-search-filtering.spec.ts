import { test, expect } from '@playwright/test';
import { setupVirtualAuthenticator } from './helpers';

test.describe('Search & Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await setupVirtualAuthenticator(page);
    const username = `search-user-${Date.now()}`;
    await page.goto('/login');
    await page.fill('input[type="text"]', username);
    await page.click('button:has-text("Register")');
    await page.waitForURL('/');

    // Create test todos
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Alpha task');
    await page.click('button:has-text("Create")');

    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Beta work');
    await page.selectOption('select:near(:text("Priority"))', 'high');
    await page.click('button:has-text("Create")');
  });

  test('search by title — matching todos shown', async ({ page }) => {
    await page.fill('input[aria-label="Search todos"]', 'Alpha');
    await page.waitForTimeout(350);
    await expect(page.locator('text=Alpha task')).toBeVisible();
    await expect(page.locator('text=Beta work')).not.toBeVisible();
  });

  test('search by title — case insensitive', async ({ page }) => {
    await page.fill('input[aria-label="Search todos"]', 'alpha');
    await page.waitForTimeout(350);
    await expect(page.locator('text=Alpha task')).toBeVisible();
  });

  test('non-matching search — empty state displayed', async ({ page }) => {
    await page.fill('input[aria-label="Search todos"]', 'xxxxxxxxxx');
    await page.waitForTimeout(350);
    await expect(page.locator('text=No todos match')).toBeVisible();
  });

  test('filter by priority high', async ({ page }) => {
    await page.selectOption('select[aria-label="Filter by priority"]', 'high');
    await expect(page.locator('text=Beta work')).toBeVisible();
    await expect(page.locator('text=Alpha task')).not.toBeVisible();
  });

  test('search + priority filter combined — AND logic', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Beta high');
    await page.selectOption('select:near(:text("Priority"))', 'high');
    await page.click('button:has-text("Create")');

    await page.fill('input[aria-label="Search todos"]', 'Beta');
    await page.selectOption('select[aria-label="Filter by priority"]', 'high');
    await page.waitForTimeout(350);

    await expect(page.locator('text=Beta work')).toBeVisible();
    await expect(page.locator('text=Beta high')).toBeVisible();
    await expect(page.locator('text=Alpha task')).not.toBeVisible();
  });

  test('clear all filters restores full list', async ({ page }) => {
    await page.fill('input[aria-label="Search todos"]', 'Alpha');
    await page.waitForTimeout(350);
    await page.click('button:has-text("Clear all")');
    await page.waitForTimeout(350);
    await expect(page.locator('text=Alpha task')).toBeVisible();
    await expect(page.locator('text=Beta work')).toBeVisible();
  });
});
