import { test, expect } from '@playwright/test';
import { setupVirtualAuthenticator } from './helpers';
import path from 'path';
import fs from 'fs';
import os from 'os';

test.describe('Export & Import', () => {
  test.beforeEach(async ({ page }) => {
    await setupVirtualAuthenticator(page);
    const username = `export-user-${Date.now()}`;
    await page.goto('/login');
    await page.fill('input[type="text"]', username);
    await page.click('button:has-text("Register")');
    await page.waitForURL('/');

    await page.click('button:has-text("New Todo")');
    await page.fill('input[placeholder="What needs to be done?"]', 'Export me');
    await page.click('button:has-text("Create")');
  });

  test('export downloads JSON file', async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button:has-text("⬇️ Export")'),
    ]);
    expect(download.suggestedFilename()).toMatch(/todos-export-.*\.json/);
  });

  test('import valid file — success toast with count', async ({ page }) => {
    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      tags: [{ id: 1, name: 'ImportedTag', color: '#3B82F6' }],
      todos: [{
        id: 1, title: 'Imported Todo', description: null, completed: false,
        due_date: null, priority: 'medium', is_recurring: false,
        recurrence_pattern: null, reminder_minutes: null, created_at: new Date().toISOString(),
        subtasks: [], tag_ids: [1],
      }],
    };

    const tmpFile = path.join(os.tmpdir(), `import-test-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(exportData));

    const fileInput = page.locator('input[type="file"][accept=".json"]');
    await fileInput.setInputFiles(tmpFile);
    await expect(page.locator('text=Imported')).toBeVisible({ timeout: 5000 });

    fs.unlinkSync(tmpFile);
  });

  test('import invalid JSON — error toast', async ({ page }) => {
    const tmpFile = path.join(os.tmpdir(), `invalid-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, 'not valid json {{{');

    const fileInput = page.locator('input[type="file"][accept=".json"]');
    await fileInput.setInputFiles(tmpFile);
    await expect(page.locator('text=Import failed')).toBeVisible({ timeout: 5000 });

    fs.unlinkSync(tmpFile);
  });

  test('import wrong version — error toast', async ({ page }) => {
    const wrongVersion = { version: '2.0', todos: [], tags: [] };
    const tmpFile = path.join(os.tmpdir(), `wrong-version-${Date.now()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(wrongVersion));

    const fileInput = page.locator('input[type="file"][accept=".json"]');
    await fileInput.setInputFiles(tmpFile);
    await expect(page.locator('text=Import failed')).toBeVisible({ timeout: 5000 });

    fs.unlinkSync(tmpFile);
  });
});
