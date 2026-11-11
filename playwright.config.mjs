import { defineConfig } from '@playwright/test';
const port = Number(process.env.TRANSLATION_PORT || 4199);
export default defineConfig({
  testDir: './tests/app', testMatch: '*.spec.mjs', outputDir: './reports/browser/artifacts',
  workers: 1,
  use: {
    ...(process.env.PLAYWRIGHT_CHANNEL ? {channel: process.env.PLAYWRIGHT_CHANNEL} : {}),
    baseURL: `http://127.0.0.1:${port}`, viewport: {width: 1024, height: 1000}, headless: true,
  },
  projects: [
    {name: 'root', use: {baseURL: `http://127.0.0.1:${port}/`}},
    {name: 'pages-prefix', use: {baseURL: `http://127.0.0.1:${port}/brooklyn-plumber-teaches-typing/`}},
  ],
  webServer: {
    command: `python3 -B tools/serve.py --port ${port}`,
    cwd: new URL('.', import.meta.url).pathname,
    url: `http://127.0.0.1:${port}`, reuseExistingServer: false,
  },
});
