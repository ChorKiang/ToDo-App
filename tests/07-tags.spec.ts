import { test, expect } from '@playwright/test';
import { setupVirtualAuthenticator } from './helpers';

test.describe('Tag System', () => {
  test.beforeEach(async ({ page }) => {
    await setupVirtualAuthenticator(page);
    const username = `tags-user-${Date.now()}`;
    await page.goto('/login');
    await page.fill('input[type="text"]', username);
    await page.click('button:has-text("Register")');
    await page.waitForURL('/');
  });

  test('open Manage Tags modal', async ({ page }) => {
    await page.click('button:has-text("Tags")');
    await expect(page.locator('text=Manage Tags')).toBeVisible();
  });

  test('create tag with name and color', async ({ page }) => {
    await page.click('button:has-text("Tags")');
    await page.fill('input[placeholder="Tag name…"]', 'Work');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=Work')).toBeVisible();
  });

  test('duplicate tag name shows 409 error', async ({ page }) => {
    await page.click('button:has-text("Tags")');
    await page.fill('input[placeholder="Tag name…"]', 'Unique');
    await page.click('button:has-text("Create")');
    await page.fill('input[placeholder="Tag name…"]', 'Unique');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=already exists')).toBeVisible();
  });

  test('assign tags to todo — badges shown', async ({ page }) => {
    // Create tag first
    await page.click('button:has-text("Tags")');
    await page.fill('input[placeholder="Tag name…"]', 'MyTag');
    await page.click('button:has-text("Create")');
    await page.keyboard.press('Escape');

    // Create todo with tag
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Tagged todo');
    await page.locator('label:has-text("MyTag")').locator('input[type="checkbox"]').click();
    await page.click('button:has-text("Create")');
    await expect(page.locator('button:has-text("MyTag")').first()).toBeVisible();
  });

  test('click tag badge — filters list to that tag only', async ({ page }) => {
    // Create two todos, one with tag
    await page.click('button:has-text("Tags")');
    await page.fill('input[placeholder="Tag name…"]', 'FilterTag');
    await page.click('button:has-text("Create")');
    await page.keyboard.press('Escape');

    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Has tag');
    await page.locator('label:has-text("FilterTag")').locator('input[type="checkbox"]').click();
    await page.click('button:has-text("Create")');

    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'No tag');
    await page.click('button:has-text("Create")');

    // Click tag badge
    await page.locator('button:has-text("FilterTag")').first().click();
    await expect(page.locator('text=Has tag')).toBeVisible();
    await expect(page.locator('text=No tag')).not.toBeVisible();
  });

  test('clear tag filter — all todos restored', async ({ page }) => {
    await page.click('button:has-text("Tags")');
    await page.fill('input[placeholder="Tag name…"]', 'ClearTag');
    await page.click('button:has-text("Create")');
    await page.keyboard.press('Escape');

    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Todo with tag');
    await page.locator('label:has-text("ClearTag")').locator('input[type="checkbox"]').click();
    await page.click('button:has-text("Create")');

    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Todo without');
    await page.click('button:has-text("Create")');

    await page.locator('button:has-text("ClearTag")').first().click();
    await expect(page.locator('text=Todo without')).not.toBeVisible();

    await page.click('button:has-text("Clear all")');
    await expect(page.locator('text=Todo without')).toBeVisible();
  });
});
