import {mkdir,readFile,writeFile,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {AVAILABLE_DATES,DEMO_DATE,getSnapshot} from '../lib/data.mjs';
import {chinaDate} from '../lib/collector.mjs';
import {DailyArchive} from '../lib/archive.mjs';
import {DailyReports} from '../lib/reports.mjs';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const escape=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function renderHTML(template,snapshot,{demoMode=false,availableDates=[],date=chinaDate(),catalogue=null,staticMode=false,basePath='/'}={}){
 const s=snapshot||{date,recap:{paragraphs:[],summary:'暂无盘面记录'}};
 const json=JSON.stringify({snapshot,appVersion:"1.7.2",availableDates:demoMode?AVAILABLE_DATES:availableDates,demoDate:DEMO_DATE,currentDate:chinaDate(),demoMode,catalogue,staticMode}).replaceAll('<','\\u003c');
 return template.replace('src="/app.js"','src="/app.js?v=1.7.2"').replace('href="/styles.css"','href="/styles.css?v=1.7.2"').replace(/\b(href|src)="\/(?!\/)/g,(_,attr)=>`${attr}="${basePath}`).replace('<title>观市 · 财经日报</title>',`<title>${s.date} 财经日报 · 观市</title>`)
 .replace('<div id="recapContent" class="recap-content"></div>',`<div id="recapContent" class="recap-content">${snapshot?s.recap.paragraphs.map(p=>`<div class="recap-point"><h4>${escape(p.title)}</h4><p>${escape(p.brief)}</p></div>`).join(''):''}</div>`)
 .replace('<!--BOOTSTRAP-->',`<script id="bootstrap" type="application/json">${json}</script>`)
 .replace('<!--STATIC_RECAP-->',snapshot?`<article class="static-recap"><h2>${s.date} ${demoMode?'收盘复盘 · 演示数据':'盘面事实 · 待复盘确认'}</h2><p>${escape(s.recap.summary)}</p>${s.recap.paragraphs.map(p=>`<h3>${escape(p.title)}</h3><p>${escape(p.brief)}</p>`).join('')}</article>`:'<p>所选日期暂无盘面快照。</p>');
}
export async function build({staticMode=false,basePath='/',outputDir=path.join(root,'dist'),runtime=null}={}){
 if(!/^\/(?:[A-Za-z0-9_.-]+\/)*$/.test(basePath))throw Error('BASE_PATH 必须是 / 或 /仓库名/，仅限字母、数字、下划线、连字符和点');
 const folderFor=(...parts)=>path.join(outputDir,...parts);
 const writeJSON=async(file,value)=>{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(value));};
 const template=await readFile(path.join(root,'public/index.html'),'utf8');
 await mkdir(outputDir,{recursive:true});
 await cp(path.join(root,'public'),outputDir,{recursive:true});
 const archive=new DailyArchive();await archive.init();const catalogue=await archive.catalogue();
 const reports=new DailyReports();await reports.refreshAll();
 for(const entry of catalogue.entries){const report=await reports.get(entry.date);entry.reportStatus=report?.status||null;entry.hasClose=Boolean(report?.close);entry.dailyNewsCount=report?.news?.items?.length||0;}
 const today=chinaDate(),latest=(await archive.get(today))?.snapshot||null;
 const actualDates=catalogue.dates;
 const options={staticMode,basePath};
 await writeFile(folderFor('index.html'),renderHTML(template,latest,{availableDates:actualDates,catalogue,...options}));
 for(const date of AVAILABLE_DATES){
   const folder=folderFor('demo/daily',date);await mkdir(folder,{recursive:true});
   await writeFile(path.join(folder,'index.html'),renderHTML(template,getSnapshot(date),{demoMode:true,date,...options}));
   await writeFile(path.join(folder,'snapshot.json'),JSON.stringify(getSnapshot(date)));
 }
 for(const date of actualDates){const saved=await archive.get(date),snapshot=saved?.snapshot||null;const folder=folderFor('daily',date);await mkdir(folder,{recursive:true});await writeFile(path.join(folder,'index.html'),renderHTML(template,snapshot,{availableDates:actualDates,date,catalogue,...options}));await writeJSON(path.join(folder,'snapshot.json'),snapshot);await writeJSON(path.join(folder,'news.json'),saved?.news||{date,items:[],asOf:null,sources:[]});}
 for(const date of actualDates)await writeJSON(folderFor('daily',date,'report.json'),await reports.get(date));
 if(staticMode){
  if(!runtime)throw Error('静态发布需要提供定时采集状态');
  await writeJSON(folderFor('feed/catalogue.json'),catalogue);
  await writeJSON(folderFor('feed/runtime.json'),{...runtime,site:archive.site});
  await writeFile(folderFor('.nojekyll'),'');
  // GitHub Pages 无服务端路由：404 页面仍加载交互界面，由查询日期显示空状态。
  await writeFile(folderFor('404.html'),renderHTML(template,null,{date:today,availableDates:actualDates,catalogue,...options}));
 }
 console.log(`已生成真实归档 ${actualDates.length} 日 / 独立演示 ${AVAILABLE_DATES.length} 日 → ${outputDir}`);
}
if(process.argv[1]===fileURLToPath(import.meta.url)) await build();
