// Optional browser verification: set QA_MODULE to an installed puppeteer-core module.
import {pathToFileURL} from 'node:url';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const {default:puppeteer}=await import(pathToFileURL(process.env.QA_MODULE).href);
const base=process.env.QA_URL||'http://localhost:3010';
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={routes:[],tools:[],consultation:[],errors:[],broken:[],links:[]};
try{
 const page=await browser.newPage();
 page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'&&/hydration|hydrating|did not match/i.test(m.text()))report.errors.push(m.text())});
 page.on('response',r=>{if(r.status()>=400 && !r.url().includes('nonexistent'))report.broken.push({url:r.url(),status:r.status()})});
 await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await fs.mkdir('docs/verification',{recursive:true});
 const xml=await (await fetch(base+'/sitemap.xml')).text();
 const paths=[...xml.matchAll(/<loc>https:\/\/migrationfactor.com([^<]*)<\/loc>/g)].map(m=>m[1]||'/');
 for(const path of paths){
  await page.setViewport({width:1440,height:1000});const response=await page.goto(base+path,{waitUntil:'networkidle0'});
  const data=await page.evaluate(()=>({title:document.title,description:document.querySelector('meta[name=description]')?.content,canonical:document.querySelector('link[rel=canonical]')?.href,og:document.querySelector('meta[property="og:url"]')?.content,twitter:document.querySelector('meta[name="twitter:card"]')?.content,h1:document.querySelectorAll('h1').length,schemas:[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>JSON.parse(s.textContent)),overflow:document.documentElement.scrollWidth>innerWidth+1,images:[...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.src),links:[...document.querySelectorAll('a[href]')].map(a=>a.href)}));
  assert.equal(response.status(),200,path);assert.equal(data.canonical,'https://migrationfactor.com'+path,path);assert.equal(new URL(data.og).href,new URL(data.canonical).href,path);assert.equal(data.h1,1,path);assert.equal(data.overflow,false,path);assert.ok(data.description&&data.twitter&&data.schemas.length>=3,path);assert.deepEqual(data.images,[],path);
  report.routes.push({path,title:data.title,canonical:data.canonical,h1:data.h1});report.links.push(...data.links.filter(l=>l.startsWith(base)));
  if(path==='/')await page.screenshot({path:'docs/seo-after-home.png',fullPage:true});
 }
 assert.equal(new Set(report.routes.map(r=>r.title)).size,report.routes.length);
 const slugs=['pr-calculator','visa-quiz','eligibility-checker','subclass-482-checker','business-sponsor-checker','sponsorship-cost-estimator','applicant-cost-calculator'];
 for(const width of [1440,390,320]){
  await page.setViewport({width,height:1000});
  for(const slug of slugs){
   await page.goto(base+'/tools/'+slug,{waitUntil:'networkidle0'});
   await page.click('.feature-workspace [type=submit]');assert.ok(await page.$('[aria-invalid=true]'));
   for(let pass=0;pass<8;pass++){
    const inputs=await page.$$eval('.feature-fields select,.feature-fields input',els=>els.filter(e=>!e.value).map(e=>({name:e.name,tag:e.tagName,value:e.tagName==='SELECT'?e.options[1]?.value:e.min||'0'})));
    if(!inputs.length)break;
    for(const input of inputs){const selector=`.feature-fields [name="${input.name}"]`;if(!await page.$(selector))continue;if(input.tag==='SELECT')await page.select(selector,input.value);else await page.type(selector,input.value);}
   }
   await page.click('.feature-workspace [type=submit]');await page.waitForSelector('.tool-result');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,slug+' '+width);
   const result=await page.$eval('.tool-result',el=>el.innerText);
   if(width===390)await page.screenshot({path:'docs/verification/'+slug+'-mobile.png',fullPage:true});
   const first=await page.$eval('.feature-fields select',e=>({name:e.name,value:e.options[2]?.value}));await page.select(`[name="${first.name}"]`,first.value);assert.equal(await page.$('.tool-result'),null);
   report.tools.push({slug,width,result:result.slice(0,180),editClearsResult:true});
  }
  await page.goto(base+'/tools/occupation-search',{waitUntil:'networkidle0'});
  await page.type('#occupation-query','261313');assert.equal(await page.$$('.occupation-results article').then(x=>x.length),1);assert.match(await page.$eval('.occupation-results',e=>e.innerText),/Software Engineer/);
  await page.select('#occupation-stream','ens');assert.match(await page.$eval('.occupation-results',e=>e.innerText),/ACS/);
  await page.focus('#occupation-query');await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await page.type('#occupation-query','111111');await page.click('.occupation-results summary');assert.match(await page.$eval('.occupation-results',e=>e.innerText),/180,001/);
  await page.focus('#occupation-query');await page.keyboard.down('Control');await page.keyboard.press('KeyA');await page.keyboard.up('Control');await page.keyboard.press('Backspace');await page.type('#occupation-query','not-a-real-occupation-xyz');assert.equal(await page.$$('.occupation-results article').then(x=>x.length),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  report.tools.push({slug:'occupation-search',width,search:true,caveats:true,noMatches:true});
  await page.goto(base+'/consultation',{waitUntil:'networkidle0'});
  const posted=[];const onRequest=r=>{if(r.method()==='POST')posted.push(r.url())};page.on('request',onRequest);
  await page.click('.feature-workspace [type=submit]');assert.ok(await page.$('[aria-invalid=true]'));
  await page.select('[name=format]','video');
  const day=new Date();day.setUTCDate(day.getUTCDate()+3);while([0,6].includes(day.getUTCDay()))day.setUTCDate(day.getUTCDate()+1);const date=day.toISOString().slice(0,10);
  await page.$eval('[name=date]',(e,value)=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))},date);
  await page.select('[name=time]','20:30');await page.click('.feature-workspace [type=submit]');await page.waitForSelector('[name=email]');
  for(const [name,value]of Object.entries({name:'Browser QA',email:'qa@example.invalid',phone:'+923001234567',country:'Pakistan',message:'A test preference for a consultation.'}))await page.type(`[name=${name}]`,value);
  await page.select('[name=category]','Student Visa');await page.click('[name=consent]');await page.click('.feature-workspace [type=submit]');await page.waitForSelector('.feature-summary');
  const text=await page.$eval('.feature-workspace',e=>e.innerText);assert.match(text,/has not been submitted/);assert.match(text,/Asia\/Karachi/);assert.deepEqual(posted,[]);page.off('request',onRequest);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:`docs/verification/consultation-${width}.png`,fullPage:true});report.consultation.push({width,date,review:true,requests:posted.length});
 }
 const targets=[...new Set(report.links.map(l=>new URL(l).pathname))];
 for(const target of targets){const r=await fetch(base+target);if(!r.ok)report.broken.push({url:target,status:r.status})}
 const missing=await fetch(base+'/nonexistent-page-qa');assert.equal(missing.status,404);assert.match(await missing.text(),/noindex/);
 const robots=await (await fetch(base+'/robots.txt')).text();assert.match(robots,/Sitemap: https:\/\/migrationfactor.com\/sitemap.xml/);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.broken,[]);
 delete report.links;await fs.writeFile('docs/verification/browser-report.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({routes:report.routes.length,toolFlows:report.tools.length,consultation:report.consultation,errors:report.errors,broken:report.broken}));
}finally{await browser.close()}

