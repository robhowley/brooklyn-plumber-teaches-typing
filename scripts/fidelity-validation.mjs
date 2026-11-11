// Rebuild and test exactly that production output over HTTP. No archive execution.
import {mkdir,writeFile,open} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
const root=process.env.FIDELITY_EVIDENCE||'research/artifacts/fidelity-validation';await mkdir(root,{recursive:true});
const env={...process.env,FIDELITY_EVIDENCE:root,FIDELITY_DIST:`${root}/dist`,PLAYWRIGHT_PORT:process.env.PLAYWRIGHT_PORT||'4191',PLAYWRIGHT_JUNIT_OUTPUT_FILE:`${root}/browser.xml`,PLAYWRIGHT_JSON_OUTPUT_FILE:`${root}/browser.json`};
const commands=[['node_modules/.bin/vite',['build','--outDir',env.FIDELITY_DIST,'--emptyOutDir']],['node_modules/.bin/playwright',['test','--workers=2',...(process.argv.includes('--bounded')?['--max-failures=2']:[]),'--trace=on',`--output=${root}/traces`,'--reporter=json,junit']]];
const runs=[];
for(const [command,args] of commands){const log=`${root}/${runs.length===0?'build':'browser'}.log`;const handle=await open(log,'w');const started=new Date().toISOString();const result=spawnSync(command,args,{env,timeout:600000,stdio:['ignore',handle.fd,handle.fd]});await handle.close();runs.push({command:[command,...args].join(' '),env:Object.fromEntries(Object.entries(env).filter(([key])=>key.startsWith('PLAYWRIGHT_')||key==='FIDELITY_DIST')),started,finished:new Date().toISOString(),status:result.status,error:result.error?.message,log});await writeFile(`${root}/commands.json`,JSON.stringify(runs,null,2));if(result.status!==0){console.error(`Failed: ${command}; see ${log}`);process.exit(result.status||1);}}
console.log(`Production validation passed. JSON, JUnit, screenshots, route records and build hashes: ${root}/`);
