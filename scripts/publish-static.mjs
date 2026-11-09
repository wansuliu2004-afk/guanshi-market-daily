import path from 'node:path';
import {Collector,chinaDate,DATA_DIR,jsonFile,atomic} from '../lib/collector.mjs';
import {MarketCollector} from '../lib/markets.mjs';
import {DailyArchive} from '../lib/archive.mjs';
import {build,root} from './build.mjs';
import {restoreSeed} from './seed-data.mjs';

const skipCollection=process.argv.includes('--skip-collection');
await restoreSeed();
const collector=new Collector(),markets=new MarketCollector(),archive=new DailyArchive();
await Promise.all([collector.init(),markets.init(),archive.init()]);
for(const date of [...new Set([...(await collector.dates()),...(await markets.dates())])].sort()){
 if(date<archive.site.startedDate||date>chinaDate())continue;
 if(!await archive.get(date))await archive.capture(date,{news:await collector.payload(date),snapshot:await markets.get(date)});
}
await archive.sealPast();
let results=[];
if(!skipCollection){
 results=await Promise.allSettled([collector.refresh(),markets.refresh()]);
 await archive.capture(chinaDate(),{news:await collector.payload(),snapshot:await markets.get(chinaDate())});
}
const sources=[...collector.status,...(markets.latest?.sources||[])],errors=results.filter(r=>r.status==='rejected').map(r=>String(r.reason.message));
const now=new Date().toISOString(),previous=await jsonFile(path.join(DATA_DIR,'cloud-runtime.json'));
const runtime={mode:'scheduled-static',intervalSeconds:1800,state:errors.length||sources.some(s=>s.status==='error')?'degraded':'running',
 lastCycleAt:skipCollection?previous?.lastCycleAt||null:now,
 publishedAt:now,nextRunAt:new Date(Date.now()+1800_000).toISOString(),
 message:'GitHub Actions 云端计划每 30 分钟采集；可能排队或延迟。个人电脑关机不影响网页访问与云端任务。',
 sources:sources.map(s=>({name:s.name,status:s.status,lastSuccessAt:s.lastSuccessAt||null})),errors};
if(!skipCollection)await atomic(path.join(DATA_DIR,'cloud-runtime.json'),runtime);
await build({staticMode:true,basePath:process.env.BASE_PATH||'/',outputDir:path.resolve(process.env.OUTPUT_DIR||path.join(root,'site')),runtime});
console.log(JSON.stringify({date:chinaDate(),state:runtime.state,collectionSkipped:skipCollection,sources:runtime.sources}));
