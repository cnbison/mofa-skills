const assert = require('node:assert/strict');

function loadPlaywright() {
  const candidates = [
    process.env.PLAYWRIGHT_NODE_MODULE,
    '/opt/homebrew/lib/node_modules/playwright',
    'playwright',
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {}
  }

  throw new Error(
    'Unable to resolve Playwright. Set PLAYWRIGHT_NODE_MODULE or install playwright locally.',
  );
}

function contains(haystack, needle, label) {
  assert.ok(haystack.includes(needle), `${label} should include "${needle}"`);
}

async function text(page, selector) {
  return (await page.locator(selector).textContent()) || '';
}

async function run() {
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const baseUrl = process.env.MOFA_SITE_STUDIO_BASE_URL || 'http://127.0.0.1:4310/';

  try {
    await page.goto(baseUrl);
    await page.waitForSelector('text=Start with a site command');
    await page.locator('#session-command').fill('/new site astro');
    await page.locator('#site-name-input').fill('Signal Atlas Docs');
    await page
      .locator('#site-description-input')
      .fill('Docs site for onboarding, setup, and API reference.');
    await page.getByRole('button', { name: 'Build session' }).click();

    await page.waitForSelector('#studio-shell:not([hidden])');
    await page.waitForFunction(() => {
      const el = document.querySelector('#session-template');
      return el && el.textContent && el.textContent.includes('astro-site');
    });
    contains(await text(page, '#session-template'), 'astro-site', 'session template');
    contains(await text(page, '#project-root'), '/site', 'project root');

    await page.waitForSelector('text=index.astro');
    await page.getByRole('button', { name: 'index.astro' }).click();
    contains(await text(page, '#file-content'), '<Layout title="Signal Atlas Docs"', 'source viewer');

    const frame = page.frameLocator('#site-frame');
    await frame.getByText('Signal Atlas Docs').first().waitFor();
    await frame.getByRole('heading', { name: 'Overview' }).waitFor();

    await page.locator('#chat-input').fill('add page FAQ');
    await page.getByRole('button', { name: 'Send' }).click();
    await page.waitForSelector('text=FAQ');

    await page.waitForSelector('text=faq.md');
    await page.getByRole('button', { name: 'faq.md' }).click();
    await page.waitForFunction(() => {
      const el = document.querySelector('#file-content');
      return el && el.textContent && el.textContent.includes('# FAQ');
    });
    contains(await text(page, '#file-content'), '# FAQ', 'generated page brief');

    await page.locator('#chat-input').fill('rename site to Signal Atlas Docs Pro');
    await page.getByRole('button', { name: 'Send' }).click();
    await frame.getByText('Signal Atlas Docs Pro').first().waitFor();

    await page.screenshot({
      path: '/tmp/mofa-site-studio-smoke.png',
      fullPage: true,
    });

    console.log('Playwright smoke test passed.');
    console.log('Screenshot: /tmp/mofa-site-studio-smoke.png');
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error.stack || String(error));
  process.exit(1);
});
