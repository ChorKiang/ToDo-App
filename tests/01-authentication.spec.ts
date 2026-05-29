import { test, expect } from '@playwright/test';
import { setupVirtualAuthenticator } from './helpers';

test.describe('Authentication', () => {
  test('register new user — redirected to home', async ({ page }) => {
    await setupVirtualAuthenticator(page);
    const username = `testuser-${Date.now()}`;
    await page.goto('/login');
    await page.fill('input[type="text"]', username);
    await page.click('button:has-text("Register")');
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });

  test('login existing user — redirected to home', async ({ page }) => {
    await setupVirtualAuthenticator(page);
    const username = `testuser-login-${Date.now()}`;
    // Register first
    await page.goto('/login');
    await page.fill('input[type="text"]', username);
    await page.click('button:has-text("Register")');
    await page.waitForURL('/');

    // Now login
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    await page.goto('/login');
    await page.fill('input[type="text"]', username);
    await page.click('button:has-text("Login")');
    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
  });

  test('logout — session cleared, redirected to login', async ({ page }) => {
    await setupVirtualAuthenticator(page);
    const username = `testuser-logout-${Date.now()}`;
    await page.goto('/login');
    await page.fill('input[type="text"]', username);
    await page.click('button:has-text("Register")');
    await page.waitForURL('/');

    await page.click('button:has-text("Logout")');
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });

  test('access / without auth — redirected to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/login/);
  });

  test('access /calendar without auth — redirected to login', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page).toHaveURL(/login/);
  });
});
