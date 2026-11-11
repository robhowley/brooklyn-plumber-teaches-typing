import {test,expect} from '@playwright/test';

test.use({javaScriptEnabled:false});

test('entry serves a real PNG tab icon at either deployment path',async({page,request,baseURL})=>{
 const responses=[],errors=[];
 page.on('response',response=>responses.push(response));
 page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
 await page.goto('./',{waitUntil:'networkidle'});
 const icon=page.locator('link[rel="icon"]');
 await expect(icon).toHaveCount(1);
 await expect(icon).toHaveAttribute('href','./assets/site/favicon.png');
 await expect(icon).toHaveAttribute('type','image/png');
 await expect(icon).toHaveAttribute('sizes','184x184');
 const url=new URL(await icon.getAttribute('href'),page.url());
 expect(url.href).toBe(new URL('assets/site/favicon.png',baseURL).href);
 const response=await request.get(url.href);
 expect(response.status()).toBe(200);
 expect(response.headers()['content-type']).toMatch(/^image\/png\b/);
 const bytes=await response.body();
 expect([...bytes.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
 const dimensions=await page.evaluate(async bytes=>{
  const image=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));
  const size=[image.width,image.height];image.close();return size;
 },[...bytes]);
 expect(dimensions).toEqual([184,184]);
 expect(responses.filter(response=>new URL(response.url()).pathname.endsWith('/favicon.ico'))).toEqual([]);
 expect(errors).toEqual([]);
});
