import path from 'node:path';
import {mkdir,readdir} from 'node:fs/promises';
import {DATA_DIR,chinaDate,atomic,jsonFile} from './collector.mjs';
import {withMarketSources} from './market-sources.mjs';

const dayValid=date=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date));
export class DailyArchive{
 constructor({directory=DATA_DIR,clock=()=>new Date()}={}){this.directory=directory;this.clock=clock;this.site=null;this.queue=Promise.resolve();}
 today(){return chinaDate(this.clock());}
 file(date){if(!dayValid(date))throw Error('Invalid archive date');return path.join(this.directory,'archive',date+'.json');}
 async init(){
  await mkdir(path.join(this.directory,'archive'),{recursive:true});
  this.site=await jsonFile(path.join(this.directory,'site.json'));
  if(!this.site){
   // 迁移既有采集记录，以首次实际接收时间作为建站时间，不用新闻的原始发布日期倒推。
   const seen=[];const files=await readdir(path.join(this.directory,'news')).catch(()=>[]);
   for(const f of files.filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n))){const d=await jsonFile(path.join(this.directory,'news',f));for(const r of d?.records||[])if(r.observedAt)seen.push(r.observedAt);}
   const latest=await jsonFile(path.join(this.directory,'market-latest.json'));if(latest?.collectedAt)seen.push(latest.collectedAt);
   const dates=seen.map(s=>Date.parse(s)).filter(Number.isFinite),createdAt=new Date(dates.length?Math.min(...dates):this.clock()).toISOString();
   this.site={version:1,createdAt,startedDate:chinaDate(new Date(createdAt)),timezone:'Asia/Shanghai',retention:'all-collected-days'};
   await atomic(path.join(this.directory,'site.json'),this.site);
  }
 }
 async dates(){return (await readdir(path.join(this.directory,'archive'))).filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n)).map(n=>n.slice(0,-5)).filter(d=>d>=this.site.startedDate).sort();}
 async get(date){if(date<this.site.startedDate||date>this.today())return null;return jsonFile(this.file(date));}
 async capture(date,{news,snapshot}){
  // 串行写入，查询和定时采集共享同一个原子归档，不互相覆盖临时文件。
  const job=this.queue.then(async()=>{
   if(date<this.site.startedDate||date>this.today())return null;
   const existing=await this.get(date);if(existing?.sealedAt)return existing;
   if(!news?.asOf&&!snapshot?.collectedAt&&!existing)return null;
   const savedAt=this.clock().toISOString();
   const payload={date,status:date<this.today()?'archived':'collecting',firstSavedAt:existing?.firstSavedAt||savedAt,lastSavedAt:savedAt,sealedAt:date<this.today()?savedAt:null,
    news:news||existing?.news||null,snapshot:withMarketSources(snapshot||existing?.snapshot||null)};
   await atomic(this.file(date),payload);return payload;
  });this.queue=job.catch(()=>{});return job;
 }
 async sealPast(){
  await this.queue;const today=this.today();
  for(const date of await this.dates())if(date<today){const d=await this.get(date);if(d&&!d.sealedAt)await this.capture(date,{news:d.news,snapshot:d.snapshot});}
 }
 async catalogue(){
  await this.queue;
  const entries=[];
  for(const date of await this.dates()){const d=await this.get(date);if(!d)continue;entries.push({date,status:date<this.today()?'archived':'collecting',hasNews:Boolean(d.news?.items?.length),newsCount:d.news?.items?.length||0,hasMarket:Boolean(d.snapshot),lastSavedAt:d.lastSavedAt,sealedAt:d.sealedAt,marketAsOf:d.snapshot?.asOf||null,newsAsOf:d.news?.asOf||null});}
  return {dates:entries.map(e=>e.date),entries,startedDate:this.site.startedDate,createdAt:this.site.createdAt,currentDate:this.today(),timezone:'Asia/Shanghai',retention:'all-collected-days'};
 }
}
