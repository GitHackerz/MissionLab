/* Browser verification: MISSIONLAB_PLAYWRIGHT_PATH may point at an existing Playwright installation. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const { chromium } = await import(process.env.MISSIONLAB_PLAYWRIGHT_PATH ? pathToFileURL(join(process.env.MISSIONLAB_PLAYWRIGHT_PATH,'index.mjs')).href : 'playwright');
const base = process.env.MISSIONLAB_BASE_URL || 'http://localhost:3012';
const artifacts = process.env.MISSIONLAB_QA_DIR || '/tmp/missionlab-expansion-qa';
fs.mkdirSync(artifacts, { recursive: true });
const results=[];
const getState = page => page.evaluate(() => {
  const data=JSON.parse(localStorage.getItem('missionlab_sessions_v2'));
  return data.sessions[data.activeMissionId].session;
});
const click=(page,name)=>page.getByRole('button',{name,exact:true}).click();
async function launch(context,title,variant='A'){
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error')errors.push('console: '+message.text());});page.testErrors=errors;
  await page.goto(base+'/mission',{waitUntil:'networkidle'});
  await click(page,'Start Training');await click(page,'Select '+title);await click(page,'View briefing');
  if(title!=='The Red Storm')await page.getByRole('radio',{name:'Exercise '+variant,exact:true}).check();
  await click(page,'Colony Mission Control');await click(page,'Begin '+title);
  await page.getByRole('tab',{name:/^Training/}).click();return page;
}
async function diagnose(page,test,hypothesis){
  await click(page,test+' (2 min)');
  await page.getByRole('tabpanel').getByRole('checkbox').last().check();
  await page.getByRole('radio',{name:hypothesis,exact:true}).check();
  await click(page,'Record supported hypothesis (1 min)');
}
async function service(page,label){
  await click(page,'Begin '+label+' service (1 min)');
  for(let i=0;i<7;i++)await page.getByTestId('atmospheric-procedure-action').click();
}
async function pressureSuccess(page){
  await diagnose(page,'Hatch leak survey','Damaged hatch seal');
  await click(page,'Close isolation valve (1 min)');await service(page,'Hatch seal');
  await click(page,'Run monitored pressure-hold test (5 min)');
  assert.equal((await getState(page)).missionState.status,'success');
}
async function airRepair(page,wrong=false){
  await click(page,'Wait +15 min');
  await diagnose(page,'Fan speed and power test',wrong?'Scrubber media exhausted':'Circulation fan failure');
  await click(page,'Stop circulation fan (1 min)');await click(page,'Stop scrubber (1 min)');
  if(wrong)await page.getByLabel('Component to service',{exact:true}).selectOption('scrubber');
  await service(page,wrong?'Scrubber cartridge':'Circulation fan');
  await click(page,'Start circulation fan (1 min)');await click(page,'Start scrubber (1 min)');
  await click(page,'Run monitored air-recovery test (10 min)');
}
async function waitUntilFailed(page){
  for(let i=0;i<60 && (await getState(page)).missionState.status==='running';i++)await click(page,'Wait +15 min');
  assert.equal((await getState(page)).missionState.status,'failed');
}
async function result(page,name){
  const saved=await getState(page), s=saved.missionState;
  assert.deepEqual(page.testErrors,[]);
  await page.screenshot({path:`${artifacts}/${name}.png`});
  const output={name,scenarioId:s.scenarioId,status:s.status,minute:s.emergency?.minute,hour:s.hour,batteryKwh:s.resources.batteryKwh,waterLiters:s.resources.waterLiters,oxygenKg:s.resources.oxygenKg,failure:s.failure?.kind,gasLostMol:s.emergency?.gasLostMol,verified:s.emergency?.verification?.passed,co2RemovedMol:s.emergency?.co2RemovedMol,branches:saved.branches.length};
  results.push(output);console.log(JSON.stringify(output));
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.MISSIONLAB_CHROMIUM || '/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 async function run(name,body,options={}){if(process.env.MISSIONLAB_QA_FILTER&&!new RegExp(process.env.MISSIONLAB_QA_FILTER).test(name))return;const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',...options});try{await body(context);console.log('PASS',name);}catch(error){for(const page of context.pages()){console.log('FAILED_PAGE',await page.locator('body').innerText());await page.screenshot({path:artifacts+'/failure.png'});}throw error;}finally{await context.close();}}
 try{
  await run('Pressure Drop full repair',async context=>{const page=await launch(context,'Pressure Drop');await pressureSuccess(page);await result(page,'pressure-success');});
  await run('Pressure failure, terminal rewind and preserved branch',async context=>{
    const page=await launch(context,'Pressure Drop');await waitUntilFailed(page);await result(page,'pressure-failure');
    const saved=await getState(page);await page.getByRole('tab',{name:/^Debrief/}).click();await page.getByLabel('Atmospheric rewind point').selectOption(saved.history[0].snapshotId);
    await page.getByRole('tab',{name:/^Training/}).click();await pressureSuccess(page);
    const after=await getState(page);assert.equal(after.branches[0].snapshots.at(-1).state.status,'failed');assert.equal(after.branches.length,1);await result(page,'pressure-rewind-success');
  });
  await run('Silent Air full repair',async context=>{const page=await launch(context,'Silent Air');await airRepair(page);assert.equal((await getState(page)).missionState.status,'success');await result(page,'air-success');});
  await run('Silent Air genuine failure',async context=>{const page=await launch(context,'Silent Air');await waitUntilFailed(page);assert.equal((await getState(page)).missionState.failure.kind,'co2');await result(page,'air-failure');
    const failed=await getState(page);await page.getByRole('tab',{name:/^Debrief/}).click();await page.getByLabel('Atmospheric rewind point').selectOption(failed.history[0].snapshotId);await page.getByRole('tab',{name:/^Training/}).click();await airRepair(page);assert.equal((await getState(page)).missionState.status,'success');assert.equal((await getState(page)).branches[0].snapshots.at(-1).state.failure.kind,'co2');await result(page,'air-rewind-success');});
  await run('Silent Air wrong replacement',async context=>{const page=await launch(context,'Silent Air');await airRepair(page,true);assert.equal((await getState(page)).missionState.emergency.verification.passed,false);await waitUntilFailed(page);await result(page,'air-wrong-repair');});
  await run('Mission identity, refresh/resume, and retained per-mission evidence',async context=>{
    const page=await launch(context,'Pressure Drop');await click(page,'Independent gas analyzer (2 min)');const before=await getState(page);await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:/Continue current mission/}).click();
    assert.equal((await getState(page)).missionState.emergency.evidence[0].id,before.missionState.emergency.evidence[0].id);
    await click(page,'Training menu');await click(page,'Start Training');await click(page,'Select Silent Air');await click(page,'View briefing');await click(page,'Colony Mission Control');await click(page,'Begin Silent Air');assert.equal((await getState(page)).missionState.emergency.evidence.length,0);
    await click(page,'Training menu');await click(page,'Start Training');await page.getByRole('button',{name:/Resume Pressure Drop/}).click();
    assert.equal((await getState(page)).missionState.scenarioId,'mission-02-pressure-drop');assert.equal((await getState(page)).missionState.emergency.evidence.length,1);await result(page,'mission-resume');
  });
  await run('Pressure sensor variant, mobile layout and calibration',async context=>{
    const page=await launch(context,'Pressure Drop','C');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false);
    await diagnose(page,'Independent gas analyzer','Pressure instrument drift');await page.getByLabel('Component to service',{exact:true}).selectOption('pressure-sensor');await click(page,'Calibrate against reference (3 min)');await click(page,'Run monitored pressure-hold test (5 min)');
    assert.equal((await getState(page)).missionState.emergency.gasLostMol,0);assert.equal((await getState(page)).missionState.status,'success');await result(page,'pressure-mobile-sensor');
  },{viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  await run('Red Storm power failure regression',async context=>{
    const page=await launch(context,'The Red Storm');for(let i=0;i<5;i++)await click(page,'+6h');const s=(await getState(page)).missionState;assert.equal(s.hour,26);assert.equal(s.failure.kind,'power');await result(page,'red-storm-energy');
  });
  await run('Red Storm full conservation and recycler repair regression',async context=>{
    const page=await launch(context,'The Red Storm');await page.getByRole('tab',{name:'Power',exact:true}).click();await page.getByRole('checkbox',{name:/Greenhouse lighting/}).uncheck();await page.getByRole('checkbox',{name:/Research laboratory/}).uncheck();await click(page,'Apply this plan');for(let i=0;i<5;i++)await click(page,'+6h');await page.getByRole('tab',{name:/^Training/}).click();
    await click(page,'Run full diagnostic cycle (30 min)');await page.getByRole('radio',{name:'Pump failure',exact:true}).check();await page.getByRole('tabpanel').getByRole('checkbox').first().check();await click(page,'Record evidence-backed diagnosis');
    for(let i=0;i<25;i++){const action=page.getByTestId('current-engine-action');if(!await action.count())break;await action.click();}
    const repaired=(await getState(page)).missionState;assert.equal(repaired.training.recycler.procedure.verification.passed,true);
    for(let i=0;i<7;i++)await click(page,'+6h');assert.equal((await getState(page)).missionState.status,'success');await result(page,'red-storm-success');
  });
  await run('Non-WebGL fallback can execute a complete mission',async context=>{
    await context.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){if(String(type).includes('webgl'))return null;return original.call(this,type,...args);};});
    const page=await launch(context,'Pressure Drop');await page.getByText(/WebGL is not available/).first().waitFor();await pressureSuccess(page);await result(page,'pressure-no-webgl');
  });
  fs.writeFileSync(artifacts+'/results.json',JSON.stringify(results,null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
