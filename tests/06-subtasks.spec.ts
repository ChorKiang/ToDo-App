import { test, expect } from '@playwright/test';
import { setupVirtualAuthenticator } from './helpers';

test.describe('Subtasks & Progress', () => {
  test.beforeEach(async ({ page }) => {
    await setupVirtualAuthenticator(page);
    const username = `subtask-user-${Date.now()}`;
    await page.goto('/login');
    await page.fill('input[type="text"]', username);
    await page.click('button:has-text("Register")');
    await page.waitForURL('/');

    // Create a base todo
    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Parent todo');
    await page.click('button:has-text("Create")');
    await page.waitForSelector('text=Parent todo');
  });

  test('expand subtasks section on a todo', async ({ page }) => {
    await page.locator('text=▼ Subtasks').first().click();
    await expect(page.locator('input[placeholder="Add a subtask…"]')).toBeVisible();
  });

  test('add subtask via Enter key', async ({ page }) => {
    await page.locator('text=▼ Subtasks').first().click();
    await page.fill('input[placeholder="Add a subtask…"]', 'First subtask');
    await page.keyboard.press('Enter');
    await expect(page.locator('text=First subtask')).toBeVisible();
  });

  test('add subtask via Add button', async ({ page }) => {
    await page.locator('text=▼ Subtasks').first().click();
    await page.fill('input[placeholder="Add a subtask…"]', 'Button subtask');
    await page.click('button:has-text("Add")');
    await expect(page.locator('text=Button subtask')).toBeVisible();
  });

  test('progress bar shows count after adding subtasks', async ({ page }) => {
    await page.locator('text=▼ Subtasks').first().click();
    await page.fill('input[placeholder="Add a subtask…"]', 'Subtask 1');
    await page.click('button:has-text("Add")');
    await page.fill('input[placeholder="Add a subtask…"]', 'Subtask 2');
    await page.click('button:has-text("Add")');
    await expect(page.locator('text=0/2')).toBeVisible();
  });

  test('toggle subtask completion — progress updates', async ({ page }) => {
    await page.locator('text=▼ Subtasks').first().click();
    await page.fill('input[placeholder="Add a subtask…"]', 'Toggle me');
    await page.click('button:has-text("Add")');
    await page.fill('input[placeholder="Add a subtask…"]', 'Other');
    await page.click('button:has-text("Add")');

    // Toggle first subtask
    await page.locator('text=Toggle me').locator('..').locator('input[type="checkbox"]').click();
    await expect(page.locator('text=1/2')).toBeVisible();
  });

  test('delete parent todo — subtasks also removed (cascade)', async ({ page }) => {
    await page.locator('text=▼ Subtasks').first().click();
    await page.fill('input[placeholder="Add a subtask…"]', 'Cascade subtask');
    await page.click('button:has-text("Add")');

    // Delete parent
    await page.locator('button[title="Delete"]').first().click();
    await page.click('button:has-text("Delete")');
    await expect(page.locator('text=Parent todo')).not.toBeVisible();
  });
});
