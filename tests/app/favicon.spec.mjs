import {test,expect} from '@playwright/test';

test('entry uses an empty authored icon without requesting a missing favicon',async({page,context})=>{
 const responses=[],errors=[],cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');
 cdp.on('Network.responseReceived',({response})=>responses.push(response));
 page.on('console',message=>{if(message.type()==='error')errors.push({text:message.text(),location:message.location()});});
 await page.goto('./?seed=1',{waitUntil:'networkidle'});
 await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href','data:,');
 expect(responses.filter(response=>new URL(response.url).pathname==='/favicon.ico')).toEqual([]);
 expect(errors).toEqual([]);
});
