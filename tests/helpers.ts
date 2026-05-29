import type { Page, CDPSession } from '@playwright/test';

export async function setupVirtualAuthenticator(page: Page): Promise<{ client: CDPSession; authenticatorId: string }> {
  const client = await page.context().newCDPSession(page);
  await client.send('WebAuthn.enable');
  const { authenticatorId } = await client.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  }) as { authenticatorId: string };
  return { client, authenticatorId };
}

export async function registerUser(page: Page, username: string): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type="text"]', username);
  await page.click('button:has-text("Register")');
  await page.waitForURL('/');
}

export async function loginUser(page: Page, username: string): Promise<void> {
  await page.goto('/login');
  await page.fill('input[type="text"]', username);
  await page.click('button:has-text("Login")');
  await page.waitForURL('/');
}

export async function createTodo(page: Page, title: string, options?: {
  description?: string;
  priority?: 'high' | 'medium' | 'low';
  dueDate?: string;
  isRecurring?: boolean;
  recurrencePattern?: string;
}): Promise<void> {
  await page.click('button:has-text("New Todo")');
  await page.fill('input[placeholder="What needs to be done?"]', title);
  if (options?.description) {
    await page.fill('textarea[placeholder="Optional notes…"]', options.description);
  }
  if (options?.priority) {
    await page.selectOption('select:near(:text("Priority"))', options.priority);
  }
  if (options?.dueDate) {
    await page.fill('input[type="datetime-local"]', options.dueDate);
  }
  if (options?.isRecurring) {
    await page.check('input[type="checkbox"]:near(:text("Repeat"))');
    if (options.recurrencePattern) {
      await page.selectOption('select:near(:text("Daily"))', options.recurrencePattern);
    }
  }
  await page.click('button:has-text("Create")');
  await page.waitForSelector(`text=${title}`);
}

export async function createTag(page: Page, name: string, color?: string): Promise<void> {
  await page.click('button:has-text("Tags")');
  await page.fill('input[placeholder="Tag name…"]', name);
  if (color) {
    await page.fill('input[type="color"]', color);
  }
  await page.click('button:has-text("Create")');
  await page.waitForSelector(`text=${name}`);
  await page.keyboard.press('Escape');
}

export function getFutureDateString(minutesFromNow = 120): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutesFromNow);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
