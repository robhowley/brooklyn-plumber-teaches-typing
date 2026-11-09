import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';

test.beforeEach(async ({ page }) => {
  await page.route('**/__feedback__/**', route => {
    const file = new URL(route.request().url()).pathname.split('/__feedback__/')[1];
    return route.fulfill({ contentType: file.endsWith('.json') ? 'application/json' : file.endsWith('.png') ? 'image/png' : 'text/javascript', body: readFileSync(`src/${file}`) });
  });
  await page.goto('/');
  await page.evaluate(async () => {
    const engine = await import('/__feedback__/engine.js');
    const { drawScene } = await import('/__feedback__/scene.js');
    const { underwaterImages } = await import('/__feedback__/assets/underwater/index.js');
    await Promise.all(Object.values(underwaterImages).map(i => i.decode()));
    const canvas = document.createElement('canvas');
    document.body.replaceChildren(canvas);
    const render = state => { drawScene(canvas, state, 9999); };
    const region = (x,y,w,h) => Array.from(canvas.getContext('2d').getImageData(x,y,w,h).data);
    const colored = (x,y,w,h,kind) => {
      const pixels=region(x,y,w,h), points=[];
      for(let i=0;i<pixels.length;i+=4){const [r,g,b]=pixels.slice(i,i+3);
        if(kind==='red' ? r>130 && r>g*1.6 && r>b*1.6 : b>90 && b>r*1.4 && b>g*1.1) points.push([x+(i/4)%w,y+Math.floor(i/4/w)]);
      }
      return {top:Math.min(...points.map(p=>p[1])),count:points.length,x:points.reduce((a,p)=>a+p[0],0)/points.length,y:points.reduce((a,p)=>a+p[1],0)/points.length};
    };
    window.feedback={...engine,canvas,render,region,colored};
  });
});

async function evidence(page, info, name) {
  const data=await page.evaluate(()=>window.feedback.canvas.toDataURL().split(',')[1]);
  const path=info.outputPath(`${name}.png`);writeFileSync(path,Buffer.from(data,'base64'));
  await info.attach(name,{path,contentType:'image/png'});
  const small=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=240;const p=c.getContext('2d');p.fillStyle='#171824';p.fillRect(0,0,320,240);p.imageSmoothingEnabled=false;p.drawImage(window.feedback.canvas,0,50,320,140);return c.toDataURL().split(',')[1];});
  writeFileSync(info.outputPath(`${name}-320x240.png`),Buffer.from(small,'base64'));
}

test('quicksand visibly descends, struggles, occludes and recovers for every character', async ({page},info) => {
  const result=await page.evaluate(()=>{
    const f=window.feedback, results=[];
    for(const character of ['Mario','Luigi','Princess']){
      const s=f.createAttempt({mode:'castle',goal:30,character,text:'a'});s.castleStage='quicksand';
      const shot=()=>{f.render(s);return {red:f.colored(215,85,55,65,'red'),head:f.region(190,85,90,25),body:f.region(190,150,90,50),arms:f.region(195,115,80,35)};};
      const high=shot();f.advanceTime(s,7);const low=shot();
      // The foreground sand must be identical under every character, at fixed scenery coordinates.
      const lowBody=low.body;f.render({...s,character:character==='Mario'?'Luigi':'Mario'});const otherBody=f.region(190,150,90,50);
      const depth=s.sandDepth;
      for(let i=0;i<30;i++){f.typeKey(s,{key:'a'});f.advanceTime(s,.1);}const recovery=shot();
      results.push({character,redDown:low.red.top-high.red.top,redUp:low.red.top-recovery.red.top,descended:high.head.some((v,i)=>v!==low.head[i]),struggled:high.arms.some((v,i)=>v!==low.arms[i]),occluded:JSON.stringify(lowBody)===JSON.stringify(otherBody),recovered:recovery.head.some((v,i)=>v!==low.head[i]),depth,after:s.sandDepth,status:s.status,correct:s.correct});
    }
    return results;
  });
  for(const r of result){expect(r).toMatchObject({descended:true,struggled:true,occluded:true,recovered:true,status:'running',correct:30});expect(r.after).toBeLessThan(r.depth);if(r.character==='Mario'){expect(r.redDown).toBeGreaterThan(12);expect(r.redUp).toBeGreaterThan(12);}}
  await evidence(page,info,'quicksand-recovery-princess');
  await page.evaluate(()=>{const f=window.feedback,s=f.createAttempt({mode:'castle'});s.castleStage='quicksand';f.advanceTime(s,8);f.render(s);});
  await evidence(page,info,'quicksand-low-mario');
  const hands=await page.evaluate(()=>{const f=window.feedback,s={...f.createAttempt({mode:'castle'}),castleStage:'quicksand',sandDepth:22,elapsed:8};f.render(s);const a=f.region(198,128,12,22);f.render({...s,elapsed:8.34});return JSON.stringify(a)!==JSON.stringify(f.region(198,128,12,22));});
  expect(hands).toBe(true);
  for(const [name,depth] of [['high',0],['middle',11]]){
    await page.evaluate(depth=>{const f=window.feedback;f.render({...f.createAttempt({mode:'castle'}),castleStage:'quicksand',sandDepth:depth,elapsed:8});},depth);
    await evidence(page,info,`quicksand-${name}-mario`);
  }
});

test('practice mouths have three distinct expressions, independent of accuracy', async ({page},info)=>{
  const results=await page.evaluate(()=>{
    const f=window.feedback,results=[];
    for(const character of ['Mario','Luigi','Princess']){
      const mouths=[];
      for(const correct of [10,40,50]){
        const s=f.createAttempt({mode:'practice',goal:50,character});Object.assign(s,{elapsed:12,correct});f.render(s);
        const mouth=f.region(300,146,50,40);mouths.push(JSON.stringify(mouth));
        s.errors=200;f.render(s);results.push({same:JSON.stringify(f.region(300,146,50,40))===JSON.stringify(mouth)});
      }
      results.push({distinct:new Set(mouths).size});
    }
    return results;
  });
  for(const r of results)if('same' in r)expect(r.same).toBe(true);else expect(r.distinct).toBe(3);
  for(const character of ['Mario','Luigi','Princess'])for(const [mood,correct] of [['sad',10],['neutral',40],['happy',50]]){
    await page.evaluate(({character,correct})=>{const f=window.feedback;f.render({...f.createAttempt({mode:'practice',goal:50,character}),elapsed:12,correct});},{character,correct});
    await evidence(page,info,`${character}-${mood}`);
  }
});

test('stronger performance raises swimmer, separates pursuer and lifts Thwomp',async({page},info)=>{
  const r=await page.evaluate(()=>{
    const f=window.feedback;
    const water=correct=>{f.render({...f.createAttempt({mode:'underwater',goal:30}),elapsed:12,correct});return {actor:f.colored(250,90,95,155,'red'),fish:f.colored(0,90,225,155,'red')};};
    const castle=correct=>{f.render({...f.createAttempt({mode:'castle',goal:30}),elapsed:1,correct});return f.colored(120,20,100,230,'blue');};
    return {low:water(0),high:water(30),down:castle(0),up:castle(4)};
  });
  expect(r.low.actor.count).toBeGreaterThan(0);expect(r.high.actor.y).toBeLessThan(r.low.actor.y-30);
  expect(r.low.fish.count).toBeGreaterThan(0);expect(r.high.fish.x).toBeLessThan(r.low.fish.x-40);
  expect(r.down.count).toBeGreaterThan(0);expect(r.down.y).toBeGreaterThan(r.up.y+50);
  await evidence(page,info,'thwomp-high');
});

test('pause and reduced motion freeze hazard pixels; reduced motion keeps static feedback',async({page})=>{
  const results=await page.evaluate(()=>{
    const f=window.feedback,results=[];
    for(const mode of ['castle','underwater','practice'])for(const reducedMotion of [false,true]){
      const s=f.createAttempt({mode,reducedMotion});s.castleStage='quicksand';f.advanceTime(s,4);f.render(s);
      const before=f.region(180,80,160,170);if(!reducedMotion)f.pause(s);f.advanceTime(s,40);f.render(s);
      results.push(JSON.stringify(before)===JSON.stringify(f.region(180,80,160,170)));
    }
    const s=f.createAttempt({mode:'castle',reducedMotion:true,goal:30,text:'a'});s.castleStage='quicksand';f.advanceTime(s,12);f.render(s);const low=f.region(190,85,90,65);
    for(let i=0;i<30;i++)f.typeKey(s,{key:'a'});f.render(s);
    const responded=JSON.stringify(low)!==JSON.stringify(f.region(190,85,90,65));
    const held=f.region(190,85,90,65);f.advanceTime(s,100);f.render(s);
    return {frozen:results,responded,correct:s.correct,idleHeld:JSON.stringify(held)===JSON.stringify(f.region(190,85,90,65))};
  });
  expect(results.frozen.every(Boolean)).toBe(true);expect(results.responded).toBe(true);expect(results.correct).toBe(30);expect(results.idleHeld).toBe(true);
});
