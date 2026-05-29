import { test, expect } from '@playwright/test';
import { setupVirtualAuthenticator } from './helpers';

test.describe('Template System', () => {
  test.beforeEach(async ({ page }) => {
    await setupVirtualAuthenticator(page);
    const username = `template-user-${Date.now()}`;
    await page.goto('/login');
    await page.fill('input[type="text"]', username);
    await page.click('button:has-text("Register")');
    await page.waitForURL('/');

    // Create a base todo
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Todo for template');
    await page.click('button:has-text("Create")');
    await page.waitForSelector('text=Todo for template');
  });

  test('save todo as template — template appears in list', async ({ page }) => {
    await page.locator('button[title="Save as template"]').first().click();
    await page.fill('input[value="Todo for template"]', 'My Template');
    await page.click('button:has-text("Save Template")');
    await expect(page.locator('text=Template saved')).toBeVisible();

    await page.click('button:has-text("Templates")');
    await expect(page.locator('text=My Template')).toBeVisible();
  });

  test('create todo from template', async ({ page }) => {
    await page.locator('button[title="Save as template"]').first().click();
    await page.fill('input[value="Todo for template"]', 'Reusable Template');
    await page.click('button:has-text("Save Template")');

    await page.click('button:has-text("Templates")');
    await page.click('button:has-text("Use")');
    await page.waitForSelector('text=Todo created from template');
    await expect(page.locator('text=Todo for template')).toBeVisible();
  });

  test('delete template — gone from list', async ({ page }) => {
    await page.locator('button[title="Save as template"]').first().click();
    await page.fill('input[value="Todo for template"]', 'Delete Me Template');
    await page.click('button:has-text("Save Template")');

    await page.click('button:has-text("Templates")');
    await page.locator('button[aria-label="Delete template"]').first().click();
    await page.waitForTimeout(300);
    await expect(page.locator('text=Delete Me Template')).not.toBeVisible();
  });
});
