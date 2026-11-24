import {defineConfig} from '@playwright/test';
const port=Number(process.env.TRANSLATION_PORT||4287);
export default defineConfig({
 testDir:'./tests',testMatch:['browser.spec.mjs','integration.spec.mjs','acceptance.spec.mjs','startup.spec.mjs'],outputDir:'./.tmp/browser',workers:1,
 use:{headless:true,viewport:{width:1024,height:1000},...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})},
 projects:[
  {name:'root',use:{baseURL:`http://127.0.0.1:${port}/`}},
  {name:'pages-prefix',use:{baseURL:`http://127.0.0.1:${port}/brooklyn-plumber-teaches-typing/`}},
 ],
 webServer:{command:`python3 -B mario2/tools/serve.py --port ${port}`,cwd:new URL('../',import.meta.url).pathname,
 url:`http://127.0.0.1:${port}/`,reuseExistingServer:false},
});
