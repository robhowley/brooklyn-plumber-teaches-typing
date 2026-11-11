import {test,expect} from '@playwright/test';

test.use({javaScriptEnabled:false});

test('built entry exposes social metadata without running the game',async({page,request,baseURL})=>{
 const title='Mario Teaches Typing | The 1992 MS-DOS classic';
 const description='The 1992 MS-DOS classic, playable in your browser.';
 const origin='https://brooklynplumberteachestyping.dad/';
 const preview=new URL('assets/site/social-preview.png',origin).href;
 const alt='Original Mario Teaches Typing title screen';
 const response=await page.goto('./');
 expect(response.status()).toBe(200);
 await expect(page).toHaveTitle(title);
 await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',origin);
 for(const [name,content] of Object.entries({
  description,
  'twitter:card':'summary_large_image',
  'twitter:title':title,
  'twitter:description':description,
  'twitter:image':preview,
  'twitter:image:alt':alt,
 }))await expect(page.locator(`meta[name="${name}"]`)).toHaveAttribute('content',content);
 for(const [property,content] of Object.entries({
  'og:type':'website',
  'og:url':origin,
  'og:title':title,
  'og:description':description,
  'og:image':preview,
  'og:image:type':'image/png',
  'og:image:width':'720',
  'og:image:height':'450',
  'og:image:alt':alt,
 }))await expect(page.locator(`meta[property="${property}"]`)).toHaveAttribute('content',content);
 // Fetch the advertised production path from this deployment, including its prefix.
 const imageResponse=await request.get(new URL(new URL(preview).pathname.slice(1),baseURL).href);
 expect(imageResponse.status()).toBe(200);
 expect(imageResponse.headers()['content-type']).toMatch(/^image\/png\b/);
 const bytes=await imageResponse.body();
 expect([...bytes.subarray(0,8)]).toEqual([137,80,78,71,13,10,26,10]);
 const dimensions=await page.evaluate(async bytes=>{
  const image=await createImageBitmap(new Blob([new Uint8Array(bytes)],{type:'image/png'}));
  const size=[image.width,image.height];image.close();return size;
 },[...bytes]);
 expect(dimensions).toEqual([720,450]);
});
