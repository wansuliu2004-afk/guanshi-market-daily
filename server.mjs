import http from 'node:http';
import {readFile,stat,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {root,build,renderHTML} from './scripts/build.mjs';
import {AVAILABLE_DATES,getSnapshot} from './lib/data.mjs';
import {Collector,chinaDate,INTERVAL_MS} from './lib/collector.mjs';
import {MarketCollector} from './lib/markets.mjs';
import {DailyArchive} from './lib/archive.mjs';
import {DailyReports} from './lib/reports.mjs';
import {completePreviousDay} from './lib/day-boundary.mjs';
import {collectOvernight} from './lib/overnight.mjs';

const collector=new Collector(),markets=new MarketCollector(),archive=new DailyArchive();
const reports=new DailyReports();
await Promise.all([collector.init(),markets.init(),archive.init()]);
// 将升级前已保存的建站日及之后数据迁入统一日档，不删除旧采集文件。
for(const date of [...new Set([...(await collector.dates()),...(await markets.dates())])].sort()){
 if(date<archive.site.startedDate||date>chinaDate())continue;
 if(!await archive.get(date))await archive.capture(date,{news:await collector.payload(date),snapshot:await markets.get(date)});
}
await archive.sealPast();
const runtime={mode:'local',startedAt:new Date().toISOString(),intervalSeconds:INTERVAL_MS/1000,lastCycleAt:null,nextRunAt:null,state:'starting',message:'本地服务运行且联网时自动采集；关闭网页不影响，电脑关机或服务停止后暂停。'};
const subscribers=new Set();let cycleBusy=null,cycleTimer;
const allDates=async()=>(await archive.catalogue()).dates;
const newsFor=async date=>{
 if(date<archive.site.startedDate||date>chinaDate())return {...await collector.payload('0001-01-01'),date,items:[],totalCandidates:0,financeCandidates:0,asOf:null,sources:[],archiveStatus:'unavailable'};
 const saved=await archive.get(date);
 return {...(date<chinaDate()&&saved?.news?saved.news:await collector.payload(date)),archiveStatus:date<chinaDate()?'archived':'collecting',savedAt:saved?.lastSavedAt||null,sealedAt:saved?.sealedAt||null};
};
const snapshotFor=async date=>{
 if(date<archive.site.startedDate||date>chinaDate())return null;
 const saved=await archive.get(date);return date<chinaDate()?saved?.snapshot||null:await markets.get(date)||saved?.snapshot||null;
};
async function saveStatic(date){
 const saved=await archive.get(date),snapshot=saved?.snapshot;if(!saved)return;
 const template=await readFile(path.join(root,'public/index.html'),'utf8'),dir=path.join(root,'dist/daily',date);
 await mkdir(dir,{recursive:true});
 await writeFile(path.join(dir,'index.html'),renderHTML(template,snapshot,{date,availableDates:await allDates(),catalogue:await archive.catalogue()}));
 await writeFile(path.join(dir,'snapshot.json'),JSON.stringify(snapshot));
 await writeFile(path.join(dir,'news.json'),JSON.stringify(saved.news));
}
async function runCycle(){
 if(cycleBusy)return cycleBusy;
 clearTimeout(cycleTimer);runtime.state='collecting';runtime.nextRunAt=null;
 cycleBusy=(async()=>{
  try{
   await archive.sealPast();
   await Promise.allSettled([collector.refresh(),markets.refresh()]);
   const today=chinaDate();
   const [overnightResult]=await Promise.allSettled([collectOvernight([...new Set([...(await allDates()),today])])]);
   await archive.capture(today,{news:await collector.payload(today),snapshot:await markets.get(today)});
   await completePreviousDay(archive,collector);
   await archive.applyOvernightBindings();
   await reports.refreshAll();
   for(const date of await allDates())await saveStatic(date);
   runtime.lastCycleAt=new Date().toISOString();runtime.state=overnightResult.status==='rejected'?'degraded':'running';runtime.error=overnightResult.status==='rejected'?overnightResult.reason.message:null;
   const news=await newsFor(today),snapshot=await snapshotFor(today);
   for(const send of subscribers){try{send('news',news);send('market',{date:today,snapshot});}catch{}}
  }catch(error){runtime.state='degraded';runtime.error=error.message;console.error(error.message);}
 })().finally(()=>{cycleBusy=null;runtime.nextRunAt=new Date(Date.now()+INTERVAL_MS).toISOString();cycleTimer=setTimeout(()=>runCycle(),INTERVAL_MS);cycleTimer.unref();});
 return cycleBusy;
}
await runCycle();await build();
const rolloverTimer=setInterval(()=>archive.sealPast().catch(console.error),60_000);rolloverTimer.unref();
const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml'};
const json=(res,data,status=200)=>{res.writeHead(status,{'Content-Type':mime['.json'],'Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),date=url.searchParams.get('date')||chinaDate(),demoMode=url.searchParams.get('mode')==='demo';
  if(!validDate(date))return json(res,{error:'INVALID_DATE'},400);
  if(url.pathname==='/api/dates')return json(res,{...await archive.catalogue(),...(demoMode?{dates:AVAILABLE_DATES}:{}),demo:demoMode});
  if(url.pathname==='/api/runtime')return json(res,{...runtime,site:archive.site,serverTime:new Date().toISOString()});
  if(url.pathname==='/api/report'){const report=await reports.get(date);return json(res,report||{error:'NO_REPORT',date},report?200:404);}
  if(url.pathname==='/api/news')return json(res,await newsFor(date));
  if(url.pathname==='/api/news/refresh'){
   if(req.method!=='POST')return json(res,{error:'METHOD_NOT_ALLOWED'},405);
   if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return json(res,{error:'CROSS_ORIGIN'},403);
   if(date===chinaDate()&&Date.now()-Date.parse(runtime.lastCycleAt||0)>60_000)await runCycle();
   return json(res,await newsFor(date));
  }
  if(url.pathname==='/api/sources')return json(res,{news:collector.status,market:markets.latest?.sources||[],intervalSeconds:300});
  if(url.pathname==='/api/archive'){
   await archive.sealPast();const saved=await archive.get(date);return json(res,saved||{error:'NO_ARCHIVE',date,startedDate:archive.site.startedDate},saved?200:404);
  }
  if(url.pathname==='/api/snapshot'){
   const snapshot=demoMode?getSnapshot(date):await snapshotFor(date);return json(res,snapshot||{error:'NO_SNAPSHOT',date},snapshot?200:404);
  }
  if(url.pathname==='/api/news/stream'){
   if(date!==chinaDate())return json(res,{error:'HISTORICAL_DATE'},400);
   res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});
   const send=(event,payload)=>res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
   send('connected',{mode:'aggregate',intervalSeconds:300});subscribers.add(send);
   const timer=setInterval(()=>send('heartbeat',{serverTime:new Date().toISOString()}),15_000);
   res.on('close',()=>{clearInterval(timer);subscribers.delete(send)});return;
  }
  if(url.pathname==='/health')return json(res,{ok:true,mode:'aggregate',newsSources:collector.status.map(s=>({name:s.name,status:s.status})),lastCollection:runtime.lastCycleAt,startedDate:archive.site.startedDate,nextRunAt:runtime.nextRunAt});
  if(url.pathname==='/'||/^\/(?:demo\/)?daily\/\d{4}-\d{2}-\d{2}\/?$/.test(url.pathname)){
   const requested=url.pathname.match(/(\d{4}-\d{2}-\d{2})/)?.[1]||date,asDemo=demoMode||url.pathname.startsWith('/demo/');
   const snapshot=asDemo?getSnapshot(requested):await snapshotFor(requested),catalogue=await archive.catalogue();
   const template=await readFile(path.join(root,'public/index.html'),'utf8');
   res.writeHead(200,{'Content-Type':mime['.html'],'Cache-Control':'no-cache'});res.end(renderHTML(template,snapshot,{date:requested,availableDates:catalogue.dates,catalogue,demoMode:asDemo}));return;
  }
  const staticData=url.pathname.match(/^\/daily\/(\d{4}-\d{2}-\d{2})\/(snapshot|news)\.json$/);
  if(staticData){const data=staticData[2]==='snapshot'?await snapshotFor(staticData[1]):(await archive.get(staticData[1]))?.news;return json(res,data||{error:'NO_ARCHIVE'},data?200:404);}
  let decoded;try{decoded=decodeURIComponent(url.pathname)}catch{return json(res,{error:'BAD_PATH'},400)}
  const target=path.resolve(root,'dist','.'+decoded),dist=path.join(root,'dist');
  if(!target.startsWith(dist+path.sep)||decoded.split('/').includes('data'))return json(res,{error:'FORBIDDEN'},403);
  let file=target;try{if((await stat(file)).isDirectory())file=path.join(file,'index.html');}catch{return json(res,{error:'NOT_FOUND'},404)}
  const body=await readFile(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});res.end(body);
 }catch(error){console.error(error.message);if(!res.headersSent)json(res,{error:'INTERNAL_ERROR'},500);else res.end();}
});
server.listen(port,host,()=>console.log(`观市聚合平台：http://${host}:${port} · 5 分钟自动采集 · 建站 ${archive.site.startedDate}`));
const shutdown=()=>{clearTimeout(cycleTimer);clearInterval(rolloverTimer);server.close(()=>process.exit(0));};
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
