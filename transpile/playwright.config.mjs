import { defineConfig } from '@playwright/test';
const port=Number(process.env.TRANSLATION_PORT||4179);
export default defineConfig({
  testDir:'./tests/app', testMatch:'*.spec.mjs', outputDir:'./reports/browser/artifacts',
  workers:1, use:{channel:'chrome',baseURL:`http://127.0.0.1:${port}`,viewport:{width:1024,height:1000},headless:true},
  webServer:{command:`python3 -m http.server ${port} --bind 127.0.0.1 --directory .`,cwd:new URL('.',import.meta.url).pathname,url:`http://127.0.0.1:${port}`,reuseExistingServer:false},
});
