import {test,expect} from '@playwright/test';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {boot,activate,enterActivity,openMenu,stored,fixture} from './helpers.js';

const evidence=process.env.FIDELITY_EVIDENCE||'.tmp/fidelity-validation/phase6-final';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function snapshot(page,name){await mkdir(`${evidence}/screenshots`,{recursive:true});await page.screenshot({path:`${evidence}/screenshots/${name}.png`,fullPage:true});}
async function student(page){const data=await stored(page);return data.students.find(p=>p.id===data.currentStudentId);}
async function reload(page){await page.reload();await activate(page,'#skip-title');await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');}
async function guided(page){await openMenu(page,'File');await activate(page,'#help');await activate(page,'#guided');await expect(page.locator('.historical-notice')).toContainText('slavery');await activate(page,'#original');}
async function times(page,label='miss'){ await openMenu(page,'Student');await activate(page,'#times');for(const mode of ['outdoor','underwater','castle','practice'])await page.locator(`[name=${mode}-seconds]`).fill(mode==='outdoor'?'60':'10');await snapshot(page,`${label}-times`);await activate(page,'#times-form button.primary');}
// Advance one callback per paced key, not thousands of rendering frames. The engine still
// receives cumulative active time and real DOM keyboard events, including outdoor contact.
async function paced(page,goal,mode){
 const count=mode==='outdoor'?goal*6:goal;
 let elapsed=0;
 for(let i=0;i<count;i++){
  const target=await page.locator('#target').textContent();
  await page.keyboard.press(target==='␣'?'Space':target);
  if(await page.locator('#resume').isVisible())await activate(page,'#resume');
  const until=mode==='outdoor'?(309+i*120)/Math.max(72,goal*14.4)*1000+32:(i+1)*9000/count;
  const delta=Math.round(until)-elapsed;await page.clock.fastForward(delta);elapsed+=delta;
  await expect(page.locator('#correct')).toHaveText(String(i+1));
 }
 await page.clock.fastForward((mode==='outdoor'?60000:10000)-elapsed+32);
 await expect(page.locator('#outcome')).toContainText('Passed at timeout');
 const p=await student(page);expect(p.results.at(-1)).toMatchObject({wpm:goal,correct:count,errors:0,passed:true});
}

test('production HTTP bytes match the rebuilt distribution and record provenance',async({page,request,browser})=>{
 const dist=resolve(process.env.FIDELITY_DIST||'dist');const files={};
 async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=resolve(dir,item.name);if(item.isDirectory())await walk(path);else{const name=relative(dist,path);const bytes=await readFile(path);const response=await request.get('/'+name);expect(response.ok()).toBeTruthy();expect(sha(await response.body()),name).toBe(sha(bytes));files[name]=sha(bytes);}}}
 const requests=[];page.on('request',request=>requests.push(request.url()));
 await walk(dist);await page.goto('/');await activate(page,'#skip-title');await snapshot(page,'main-menu');
 expect(requests.every(url=>new URL(url).origin===new URL(page.url()).origin)).toBeTruthy();
 const source={};
 async function hashSource(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=`${dir}/${item.name}`;if(item.isDirectory())await hashSource(path);else source[path]=sha(await readFile(path));}}
 await hashSource('src');await hashSource('tests/browser');for(const file of ['index.html','vite.config.js','package-lock.json','scripts/fidelity-validation.mjs'])source[file]=sha(await readFile(file));
 await mkdir(evidence,{recursive:true});await writeFile(`${evidence}/build-evidence.json`,JSON.stringify({head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),browser:browser.version(),ruleset:'original-fidelity-browser-v2',corpusVersion:JSON.parse(await readFile('src/data/lessons.json','utf8')).corpusVersion,dist,files,source,requests,method:'Playwright DOM keyboard automation with controlled fake active clock. Not human play or DOS runtime validation.'},null,2));
});

for(const motion of ['no-preference','reduce'])test(`fresh full guided course, exact 50, ${motion}`,async({page})=>{
 // Measured at 21 seconds per route with two workers; allow 3x for slower hosts.
 test.setTimeout(65000);
 const route=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await boot(page,{data:null,motion});await snapshot(page,`${motion}-menu`);
 await openMenu(page,'Student');await activate(page,'#new-student');await snapshot(page,`${motion}-new`);await page.getByLabel('Name',{exact:true}).fill(`Course ${motion}`);await page.getByLabel('Character').selectOption('Mario');await activate(page,'#student-done');
 expect((await student(page)).course).toMatchObject({goal:5,group:0,revision:0,pending:null,graduated:false});
 await times(page,motion);
 for(const [id,name] of [['help','help'],['keyboard','keyboard']]){await openMenu(page,'File');await activate(page,`#${id}`);await snapshot(page,`${motion}-${name}`);await activate(page,'#back');}
 await openMenu(page,'Student');await activate(page,'#load-student');await snapshot(page,`${motion}-load`);await activate(page,'#load-form button.primary');await reload(page);
 try{
 for(let step=0;step<32;step++){
  const before=await student(page);if(before.course.graduated)break;
  const {goal,group,revision}=before.course;const mode=goal<10?'outdoor':goal<30?'underwater':'castle';
  if(group===0){await openMenu(page,'Student');await activate(page,'#edit-student');await page.getByLabel('Character').selectOption(mode==='outdoor'?'Mario':mode==='underwater'?'Luigi':'Princess');await snapshot(page,`${motion}-edit-${mode}`);await activate(page,'#student-done');await reload(page);}
  await guided(page);await snapshot(page,`${motion}-${mode}-${goal}-${group}-activity`);
  await paced(page,goal,mode);await snapshot(page,`${motion}-${mode}-${goal}-${group}-result`);
  let earned=await student(page);route.push({goal,group,revision,result:earned.results.at(-1),pending:earned.course.pending});
  if(earned.course.graduated){expect(goal).toBe(50);expect(group).toBe(5);await activate(page,'#retry');await paced(page,50,'castle');expect((await student(page)).certificates).toEqual(earned.certificates);expect((await student(page)).course.pending).toBeNull();await activate(page,'#menu');break;}
  expect(earned.course.pending).not.toBeNull();expect(earned.course.revision).toBe(revision);
  if(group===0){const pending=earned.course.pending;await activate(page,'#retry');await page.clock.fastForward((mode==='outdoor'?60000:10000)+32);await expect(page.locator('#outcome')).toContainText('Not passed');await snapshot(page,`${motion}-${mode}-failed-retry`);expect((await student(page)).course.pending).toEqual(pending);}
  await reload(page);expect((await student(page)).course.pending).toEqual(earned.course.pending);
  await activate(page,'#next');await expect(page.locator('#screen-art')).toHaveAttribute('aria-label','Original MAINMENU background');await expect(page.locator('#next')).toBeDisabled();
  const committed=await student(page);expect(committed.course.revision).toBe(revision+1);expect(committed.course.pending).toBeNull();
  await page.keyboard.press('6');expect((await student(page)).course).toEqual(committed.course);
  await reload(page);expect((await student(page)).course).toEqual(committed.course);
 }
 const graduated=await student(page);expect(graduated.course.graduated).toBe(true);expect(graduated.certificates.map(c=>c.kind)).toEqual(['outdoor','underwater','graduation']);
 expect(route.map(r=>`${r.goal}:${r.group}`)).toEqual([...Array.from({length:6},(_,i)=>`5:${i}`),'7:5','9:5',...Array.from({length:6},(_,i)=>`10:${i}`),'15:5','20:5','25:5',...Array.from({length:6},(_,i)=>`30:${i}`),'35:5','40:5','45:5','50:5']);
 await reload(page);await page.keyboard.press('5');await snapshot(page,`${motion}-report`);
 for(let i=0;i<3;i++){await activate(page,`[data-certificate="${i}"]`);await snapshot(page,`${motion}-certificate-${i}`);const waiting=page.waitForEvent('download');await activate(page,'#download');const download=await waiting;const path=`${evidence}/${motion}-${download.suggestedFilename()}`;await download.saveAs(path);const text=await readFile(path,'utf8');expect(text).toContain(graduated.name);expect(text).toContain(graduated.certificates[i].resultId);expect(text).toContain(graduated.certificates[i].ruleset);await activate(page,'#back');}
 await activate(page,'#back');await enterActivity(page,'practice');await expect(page.locator('#source-caption')).toContainText('Generated practice, not original lesson text');await snapshot(page,`${motion}-practice`);await paced(page,5,'practice');await snapshot(page,`${motion}-practice-result`);await activate(page,'#retry');await page.clock.fastForward(10032);await expect(page.locator('#outcome')).toContainText('Not passed');await snapshot(page,`${motion}-practice-failed-retry`);await activate(page,'#menu');
 expect((await student(page)).course).toEqual(graduated.course);expect((await student(page)).certificates).toEqual(graduated.certificates);expect(errors).toEqual([]);
 }finally{await mkdir(evidence,{recursive:true});await writeFile(`${evidence}/course-${motion}.json`,JSON.stringify({route,student:await student(page),errors},null,2));}
});

test('narrow initial castle fixture overshoots to 50 assessment, never skips graduation',async({page})=>{
 const data=fixture({duration:10,goal:48,group:5});Object.assign(data.students[0].course,{goal:48,group:5});
 await boot(page,{data});await guided(page);await paced(page,48,'castle');expect((await student(page)).course.pending.destination).toMatchObject({goal:50,group:5});await reload(page);await activate(page,'#next');await guided(page);await paced(page,50,'castle');expect((await student(page)).certificates.map(c=>c.kind)).toEqual(['graduation']);await reload(page);expect((await student(page)).course.graduated).toBe(true);
});


test('normal outdoor missed target returns without a penalty and accepts one buffered key',async({page})=>{
 await boot(page,{data:null,motion:'no-preference'});await times(page);await guided(page);
 const target=await page.locator('#target').textContent();
 await page.clock.fastForward(6000);await expect(page.locator('#target')).toHaveText(target);await expect(page.locator('#correct')).toHaveText('0');await expect(page.locator('#errors')).toHaveText('0');
 await page.keyboard.press(target);await expect(page.locator('#encounter-status')).toContainText('held');await expect(page.locator('#correct')).toHaveText('0');
 await page.clock.fastForward(8400);await expect(page.locator('#correct')).toHaveText('1');await expect(page.locator('#errors')).toHaveText('0');await snapshot(page,'outdoor-returned-miss');
 await page.clock.fastForward(500);await expect(page.locator('#correct')).toHaveText('1');
});

test('student strings stay literal DOM text through edit, load and reload',async({page})=>{
 await boot(page,{data:null});await openMenu(page,'Student');await activate(page,'#new-student');
 const name='<img src=x onerror=1>';await page.getByLabel('Name',{exact:true}).fill(name);await activate(page,'#student-done');
 expect((await student(page)).name).toBe(name);await expect(page.locator('img')).toHaveCount(0);
 await openMenu(page,'Student');await activate(page,'#edit-student');await expect(page.getByLabel('Name',{exact:true})).toHaveValue(name);await activate(page,'#student-done');
 await openMenu(page,'Student');await activate(page,'#load-student');await expect(page.locator('select[name=student]')).toContainText(name);await activate(page,'#load-form button.primary');await reload(page);expect((await student(page)).name).toBe(name);await expect(page.locator('img')).toHaveCount(0);
});
