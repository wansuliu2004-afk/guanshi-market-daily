import path from 'node:path';
import {Collector,chinaDate,DATA_DIR,jsonFile,atomic} from '../lib/collector.mjs';
import {MarketCollector} from '../lib/markets.mjs';
import {DailyArchive} from '../lib/archive.mjs';
import {DailyReports} from '../lib/reports.mjs';
import {build,root} from './build.mjs';
import {restoreSeed} from './seed-data.mjs';
import {completePreviousDay} from '../lib/day-boundary.mjs';
import {collectOvernight} from '../lib/overnight.mjs';

const skipCollection=process.argv.includes('--skip-collection');
await restoreSeed();
const collector=new Collector(),markets=new MarketCollector(),archive=new DailyArchive();
const reports=new DailyReports();
await Promise.all([collector.init(),markets.init(),archive.init()]);
for(const date of [...new Set([...(await collector.dates()),...(await markets.dates())])].sort()){
 if(date<archive.site.startedDate||date>chinaDate())continue;
 if(!await archive.get(date))await archive.capture(date,{news:await collector.payload(date),snapshot:await markets.get(date)});
}
await archive.sealPast();
let results=[];
if(!skipCollection){
 results=await Promise.allSettled([collector.refresh(),markets.refresh()]);
 const dates=[...new Set([...(await archive.dates()),chinaDate()])];
 const night=await Promise.allSettled([collectOvernight(dates)]);results.push(...night);
 await archive.capture(chinaDate(),{news:await collector.payload(),snapshot:await markets.get(chinaDate())});
 await completePreviousDay(archive,collector);
}
await archive.applyOvernightBindings();
await reports.refreshAll();
const sources=[...collector.status,...(markets.latest?.sources||[])],errors=results.filter(r=>r.status==='rejected').map(r=>String(r.reason.message));
const now=new Date().toISOString(),previous=await jsonFile(path.join(DATA_DIR,'cloud-runtime.json'));
const nextRun=new Date(now);nextRun.setUTCSeconds(0,0);nextRun.setUTCMinutes(Math.floor(nextRun.getUTCMinutes()/5)*5+2);if(nextRun<=new Date(now))nextRun.setUTCMinutes(nextRun.getUTCMinutes()+5);
const runtime={appVersion:'1.8.1',mode:'scheduled-static',intervalSeconds:300,state:errors.length||sources.some(s=>s.status==='error')?'degraded':'running',
 lastCycleAt:skipCollection?previous?.lastCycleAt||null:now,
 publishedAt:now,nextRunAt:nextRun.toISOString(),
 message:'GitHub Actions 云端每 5 分钟计划触发；平台可能延迟或跳过。网页每 30 秒自动检查新发布数据，延迟会明确提示，无需手动刷新。',
 sources:sources.map(s=>({name:s.name,status:s.status,lastSuccessAt:s.lastSuccessAt||null})),errors};
if(!skipCollection)await atomic(path.join(DATA_DIR,'cloud-runtime.json'),runtime);
await build({staticMode:true,basePath:process.env.BASE_PATH||'/',outputDir:path.resolve(process.env.OUTPUT_DIR||path.join(root,'site')),runtime});
console.log(JSON.stringify({date:chinaDate(),state:runtime.state,collectionSkipped:skipCollection,sources:runtime.sources}));
