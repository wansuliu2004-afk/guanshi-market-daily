import path from 'node:path';
import {mkdir,readdir} from 'node:fs/promises';
import {DATA_DIR,chinaDate,atomic,jsonFile,rankNews,DAILY_RANKING,isFinanceTitle} from './collector.mjs';
import {withMarketSources} from './market-sources.mjs';
import {enrichCloseSentiment} from './sentiment.mjs';
import {dayCutoff,pastDayReady} from './day-boundary.mjs';

const clockTime=stamp=>stamp?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(stamp)):'';
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const aShareIds=['sh','sz','cy','kc'];
export function marketOverview(snapshot,date){
 if(!snapshot||snapshot.date!==date||snapshot.demo)return null;
 const s=withMarketSources(snapshot);
 return {date,collectedAt:s.collectedAt,markets:structuredClone(s.markets),sources:structuredClone(s.sources||[]),scope:'A 股显示当日留存报价，其他市场显示当日最后留存、隔夜或日度数据；以各卡片原始报价日期为准，不代表同一时点收盘。'};
}
export function closeReadiness(snapshot,date){
 if(!snapshot||snapshot.date!==date||snapshot.demo)return {ready:false,reason:'尚无该日真实行情'};
 const missing=aShareIds.filter(id=>{const m=snapshot.markets?.find(m=>m.id===id);return !m?.asOf||chinaDate(new Date(m.asOf))!==date||clockTime(m.asOf)<'15:00'||!Number.isFinite(m.rawValue)||!Number.isFinite(m.change);});
 const last=snapshot.intraday?.at(-1),candle=snapshot.candles?.find(c=>c.tradeDate===date);
 if(missing.length||last?.date!==date||last?.time<'15:00'||!candle)return {ready:false,reason:'等待四个 A 股指数收盘报价、15:00 分时及当日日 K 到齐'};
 const sh=snapshot.markets.find(m=>m.id==='sh');
 if(Math.abs(candle.values[1]-sh.rawValue)>.02||Math.abs(last.value-sh.rawValue)>.02)return {ready:false,reason:'收盘报价与分时、日 K 尚未对齐，继续等待下一轮'};
 return {ready:true,reason:'四个 A 股指数、完整分时及日 K 已核对'};
}
export class DailyReports{
 constructor({directory=DATA_DIR,clock=()=>new Date()}={}){this.directory=directory;this.clock=clock;this.queue=Promise.resolve();}
 file(date){if(!validDate(date))throw Error('Invalid report date');return path.join(this.directory,'reports',date+'.json');}
 async get(date){return jsonFile(this.file(date));}
 async refreshAll(){
  const job=this.queue.then(()=>this.run());this.queue=job.catch(()=>{});return job;
 }
 async run(){
  await mkdir(path.join(this.directory,'reports'),{recursive:true});
  const site=await jsonFile(path.join(this.directory,'site.json'));if(!site)throw Error('缺少建站记录');
  const today=chinaDate(this.clock()),now=this.clock().toISOString();
  const files=await readdir(path.join(this.directory,'archive')).catch(()=>[]);
  for(const name of files.filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort()){
   const date=name.slice(0,-5);if(date<site.startedDate||date>today)continue;
   const [saved,raw]=await Promise.all([jsonFile(path.join(this.directory,'archive',name)),jsonFile(path.join(this.directory,'news',name))]);
   if(!saved)continue;
   const existing=await this.get(date);
   const snapshot=withMarketSources(saved.snapshot);
   const cutoffAt=dayCutoff(date),boundaryUpdate=saved.dayEnd?.completedAt&&existing?.dayEndCompletedAt!==saved.dayEnd.completedAt;
   if(existing?.finalizedAt&&!boundaryUpdate){
    const summaries=new Map((raw?.records||[]).filter(r=>r.summary).map(r=>[r.sourceUrl,r]));let changed=false;
    const items=existing.news.items.map(item=>{
     if(item.summary)return item;
     const refs=item.relatedSources||[{name:item.source,url:item.sourceUrl}],source=refs.map(ref=>summaries.get(ref.url)).find(record=>record?.summary);
     if(!source)return item;
     changed=true;return {...item,summary:source.summary,summarySource:source.source};
    });
    const overview=existing.marketOverview||marketOverview(snapshot,date);
    const close=enrichCloseSentiment(existing.close,snapshot,date);
    if(changed||(!existing.marketOverview&&overview)||close!==existing.close||!existing.cutoffAt)await atomic(this.file(date),{...existing,cutoffAt,updatedAt:now,marketOverview:overview,close,news:{...existing.news,cutoffAt,items}});
    continue;
   }
   const readiness=closeReadiness(snapshot,date);
   let close=enrichCloseSentiment(existing?.close||null,snapshot,date);
   if(!close&&readiness.ready){
    const frozen=structuredClone(snapshot);frozen.status='daily-close';
    // 核心收盘盘面锁定；跨市场概览独立保留各自的报价时点。
    frozen.markets=frozen.markets.filter(m=>aShareIds.includes(m.id));
    frozen.recap={...frozen.recap,regime:'收盘事实',summary:'A 股收盘记录已保存',paragraphs:frozen.recap.paragraphs.map(p=>p.title==='明日观察'?{...p,brief:'保留当日收盘事实；主线归因、预测与关键位仍待人工确认。',full:'保留当日收盘事实；主线归因、预测与关键位仍待人工确认。'}:p)};
    close={capturedAt:now,dataCollectedAt:snapshot.collectedAt,asOf:snapshot.asOf,verification:readiness.reason,snapshot:frozen,reconstructed:date<today};
   }
   const records=(raw?.records||[]).filter(r=>r.date===date&&chinaDate(new Date(r.publishedAt))===date&&Date.parse(r.publishedAt)<=this.clock().getTime());
   const legacy=!raw?.records,recentPast=date===new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
   const final=date<today&&pastDayReady(date,this.clock())&&(!recentPast||Boolean(saved.dayEnd));
   const news=existing?.news?.finalizedAt&&!boundaryUpdate?existing.news:{date,cutoffAt,items:legacy?(saved.news?.items||[]):rankNews(records,Date.parse(cutoffAt)-1,{profile:'daily'}),asOf:raw?.asOf||saved.news?.asOf||null,collectedAt:raw?.asOf||saved.news?.asOf||null,latestPublishedAt:records.length?new Date(Math.max(...records.map(r=>Date.parse(r.publishedAt)))).toISOString():null,
    totalCandidates:legacy?saved.news?.totalCandidates||0:records.length,financeCandidates:legacy?saved.news?.financeCandidates||0:records.filter(r=>isFinanceTitle(r.title)).length,
    sources:raw?.sources||saved.news?.sources||[],ranking:legacy?{name:'原榜单存档',description:'缺少完整候选文件，仅保留原榜单，不能重新筛选全日重要新闻。'}:DAILY_RANKING,
    status:final?'final':date<today?'closing':'developing',finalizedAt:final?now:null,mode:'daily',legacy,coverageStart:records.length?new Date(Math.min(...records.map(r=>Date.parse(r.observedAt||r.publishedAt)))).toISOString():null};
   const weekday=new Date(date+'T12:00:00Z').getUTCDay();
   // 无真实交易日历时只识别周末；法定节假日或缺数不冒充已收盘。
   const closeStatus=close?'closed':[0,6].includes(weekday)?'weekend':final?'unavailable':'awaiting-close';
   const report={version:3,date,cutoffAt,dayEndCompletedAt:saved.dayEnd?.completedAt||null,createdAt:existing?.createdAt||now,updatedAt:now,finalizedAt:final?(existing?.finalizedAt||now):null,status:final?'final':date<today?'closing':'developing',news,close,closeStatus,marketOverview:existing?.finalizedAt&&existing.marketOverview?existing.marketOverview:marketOverview(snapshot,date)||existing?.marketOverview||null,
    closeMessage:close?'A 股收盘盘面已独立保存；后续实时行情不覆盖该快照':closeStatus==='weekend'?'周末无 A 股收盘记录':closeStatus==='unavailable'?'未保存到可核对的当日收盘数据，不使用其他日期替代':readiness.reason,
    scope:'全日统计截至北京时间当日24:00，跨日补采后固定新闻榜单；A 股收盘盘面独立锁定，市场概览保留各市场当日最后实际报价时间。'};
   await atomic(this.file(date),report);
  }
 }
}
