import {test,expect} from '@playwright/test';
import rasters from '../../src/assets/original/rasters.json' with {type:'json'};
import {boot,custom,fixture} from './helpers.js';

function rasterIndex(name,x,y){
 const raster=rasters[name];return Buffer.from(raster.pixels,'base64')[y*raster.width+x];
}
function rasterColor(name,x,y){
 const raster=rasters[name],index=rasterIndex(name,x,y);return raster.palette.slice(index*3,index*3+3);
}
const underlay={
 block:{transparent:rasterColor('OUTSIDE-brick1_1',14,12),outside:rasterColor('OUTSIDE-brick1_1',15,12)},
 turtle:{transparent:rasterColor('OUTSIDE-turt1_1',21,12),outside:rasterColor('OUTSIDE-turt1_1',22,12)},
};
const glyphSamples={F:{core:[6,1],outline:[8,1]},L:{core:[6,7],outline:[8,7]}};

test('production outdoor blocks and turtles render outlined FONT7H letters without changing transparent pixels',async({page},info)=>{
 for(const [letter,points] of Object.entries(glyphSamples)){
  const name=`FONT7H-font7_${letter.charCodeAt(0)}`;
  expect(rasterIndex(name,...points.outline)).toBe(2);expect(rasterIndex(name,...points.core)).toBe(1);expect(rasterIndex(name,9,9)).toBe(0);
 }
 await boot(page,{data:fixture()});await custom(page,'outdoor',{generated:false});
 const samples={F:{block:null,turtle:null},L:{block:null,turtle:null}};
 for(let step=0;step<100&&!Object.values(samples).every(letters=>Object.values(letters).every(Boolean));step++){
  const index=Number(await page.locator('#correct').textContent());
  const letter=await page.locator('#target').textContent();
  const surface=index%2?'turtle':'block';
  if(samples[letter]?.[surface]===null){
   samples[letter][surface]=await page.locator('#scene').evaluate((canvas,{surface,points})=>{
    const data=canvas.getContext('2d').getImageData(0,0,640,400).data;
    const left=surface==='block'?231:236,top=surface==='block'?141:252;
    const pixel=(x,y)=>{const i=(y*640+x)*4;return Array.from(data.slice(i,i+4));};
    return {core:pixel(left+points.core[0]*2,top+points.core[1]*2),outline:pixel(left+points.outline[0]*2,top+points.outline[1]*2),transparent:pixel(left+18,top+18),outside:pixel(left+20,top+18)};
   },{surface,points:glyphSamples[letter]});
  }
  if(Object.values(samples).every(letters=>Object.values(letters).every(Boolean)))break;
  await page.keyboard.press(letter);
 }
 for(const letter of ['F','L'])for(const surface of ['block','turtle']){
  const sample=samples[letter][surface];
  expect(sample,`${letter} on ${surface}`).not.toBeNull();
  expect(sample.core.slice(0,3),`${letter} white core on ${surface}`).toEqual([255,255,255]);
  expect(sample.outline.slice(0,3),`${letter} black outline on ${surface}`).toEqual([0,0,0]);
  expect(sample.core[3]).toBe(255);expect(sample.outline[3]).toBe(255);
  expect(sample.transparent.slice(0,3),`${letter} transparent pixel on ${surface}`).toEqual(underlay[surface].transparent);
  expect(sample.transparent[3]).toBe(255);
  expect(sample.outside.slice(0,3),`${letter} surrounding ${surface} pixel`).toEqual(underlay[surface].outside);
 }
 await expect(page.locator('#target')).toHaveText('L');
 await page.screenshot({path:info.outputPath('outdoor-letter-palette-turtle.png'),fullPage:true});
});
