import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';
const port = Number(process.env.PLAYWRIGHT_PORT || 4173);
export default defineConfig({testDir:'./tests/browser',outputDir:'.tmp/test-results/playwright',workers:1,use:{baseURL:`http://127.0.0.1:${port}`,viewport:{width:1280,height:1000},launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || process.env.CHROME_PATH || (existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome') ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined)}},webServer:{command:`node_modules/.bin/vite preview --host 127.0.0.1 --port ${port} --strictPort --outDir ${process.env.FIDELITY_DIST || 'dist'}`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false}});
