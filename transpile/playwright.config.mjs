import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/app', testMatch:'*.spec.mjs', outputDir:'./reports/browser/artifacts',
  workers:1, use:{channel:'chrome',baseURL:'http://127.0.0.1:4179',viewport:{width:1024,height:1000},headless:true},
  webServer:{command:'python3 -m http.server 4179 --bind 127.0.0.1 --directory .',cwd:new URL('.',import.meta.url).pathname,url:'http://127.0.0.1:4179',reuseExistingServer:false},
});
