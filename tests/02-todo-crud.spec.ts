import { test, expect } from '@playwright/test';
import { setupVirtualAuthenticator, getFutureDateString } from './helpers';

test.describe('Todo CRUD', () => {
  test.beforeEach(async ({ page }) => {
    await setupVirtualAuthenticator(page);
    const username = `crud-user-${Date.now()}`;
    await page.goto('/login');
    await page.fill('input[type="text"]', username);
    await page.click('button:has-text("Register")');
    await page.waitForURL('/');
  });

  test('create todo with title only', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'My first todo');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=My first todo')).toBeVisible();
  });

  test('create todo with all fields', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Full todo');
    await page.fill('textarea[placeholder="Optional notes…"]', 'Notes here');
    await page.selectOption('select:near(:text("Priority"))', 'high');
    await page.fill('input[type="datetime-local"]', getFutureDateString());
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=Full todo')).toBeVisible();
    await expect(page.locator('text=High')).toBeVisible();
  });

  test('toggle todo completion — moves to completed section', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Complete me');
    await page.click('button:has-text("Create")');
    await page.locator('text=Complete me').first().locator('..').locator('input[type="checkbox"]').first().click();
    await expect(page.locator('text=Completed')).toBeVisible();
  });

  test('edit todo title and description', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Original title');
    await page.click('button:has-text("Create")');
    await page.locator('text=Original title').first().locator('..').locator('..').locator('button[title="Edit"]').click();
    await page.fill('input[placeholder="What needs to be done?"]', 'Updated title');
    await page.click('button:has-text("Update")');
    await expect(page.locator('text=Updated title')).toBeVisible();
  });

  test('delete todo — shows confirmation, removes from list', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Delete me');
    await page.click('button:has-text("Create")');
    await page.locator('text=Delete me').first().locator('..').locator('..').locator('button[title="Delete"]').click();
    await expect(page.locator('text=Delete this todo?')).toBeVisible();
    await page.click('button:has-text("Delete")');
    await expect(page.locator('text=Delete me')).not.toBeVisible();
  });

  test('validation — empty title shows error', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=Title is required')).toBeVisible();
  });

  test('validation — past due date shows error', async ({ page }) => {
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Past due');
    await page.fill('input[type="datetime-local"]', '2020-01-01T00:00');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=at least 1 minute')).toBeVisible();
  });
});
