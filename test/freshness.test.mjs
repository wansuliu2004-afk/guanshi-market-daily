import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {marketContext,normalizeMarketSnapshot} from '../public/market-context.js';
import {dayCutoff,pastDayReady,completePreviousDay} from '../lib/day-boundary.mjs';
import {DailyArchive} from '../lib/archive.mjs';
import {DailyReports} from '../lib/reports.mjs';
import {atomic} from '../lib/collector.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'guanshi-freshness-'));after(()=>rm(root,{recursive:true,force:true}));
const old='2026-11-10T07:00:00.000Z',morning='2026-11-11T00:21:00.000Z';
const snapshot={date:'2026-11-11',collectedAt:morning,status:'intraday',asOf:old,markets:[{id:'sh',category:'A股',value:'100',rawValue:100,change:1,asOf:old,trend:[98,100],turnoverYuan:10}],intraday:[{date:'2026-11-10',value:100}],candles:[],sectors:[{name:'昨日板块',asOf:old},{name:'今日板块',asOf:morning}],recap:{turnover:'1',summary:'盘中数据已接入',paragraphs:[]}};
test('开盘前昨收明确标为参考，不能作为今日盘中、板块、成交额或分时',()=>{
 const s=normalizeMarketSnapshot(snapshot);assert.equal(s.marketContext.phase,'preopen');assert.match(s.marketContext.message,/上一交易日参考/);assert.equal(s.status,'preopen');assert.equal(s.markets[0].reference,true);assert.deepEqual(s.markets[0].trend,[]);assert.equal(s.markets[0].turnoverYuan,null);assert.deepEqual(s.intraday,[]);assert.equal(s.sectors.length,1);assert.equal(s.recap.turnover,'—');assert.match(s.recap.summary,/未开盘/);
 assert.equal(marketContext(s,s.date,new Date('2026-11-11T02:00:00Z')).phase,'awaiting-data');assert(!marketContext(s,s.date,new Date('2026-11-11T02:00:00Z')).hasTodayQuote);
});
test('当日盘中、午休、待收盘和正式收盘各自区分，日K历史不冒充今日分时',()=>{
 const quote={...snapshot,markets:[{...snapshot.markets[0],asOf:'2026-11-11T02:00:00Z'}]};
 assert.equal(marketContext(quote,quote.date,new Date('2026-11-11T02:10:00Z')).phase,'intraday');assert.equal(marketContext(quote,quote.date,new Date('2026-11-11T04:10:00Z')).phase,'midday');assert.equal(marketContext(quote,quote.date,new Date('2026-11-11T08:00:00Z')).phase,'awaiting-close');
 assert.equal(marketContext({...quote,markets:[{...quote.markets[0],asOf:'2026-11-11T07:00:00Z'}]},quote.date,new Date('2026-11-11T08:00:00Z')).phase,'close-observed');
});
test('24:00是统计上界而不是虚构报价时间，午夜15分钟后才定稿',()=>{
 assert.equal(dayCutoff('2026-11-10'),'2026-11-10T16:00:00.000Z');assert(!pastDayReady('2026-11-10',new Date('2026-11-10T16:14:59Z')));assert(pastDayReady('2026-11-10',new Date('2026-11-10T16:15:00Z')));
});
test('午夜补采纳入截止前晚间新闻，排除次日标题，封存行情时间不改写',async()=>{
 let now=new Date('2026-11-10T15:29:00Z');const archive=new DailyArchive({directory:root,clock:()=>now});await archive.init();
 const date='2026-11-10',market={...snapshot,date,collectedAt:now.toISOString(),markets:snapshot.markets.map(m=>({...m,asOf:old})),sectors:[]};
 const first={id:'a',title:'央行发布金融市场政策',date,publishedAt:'2026-11-10T15:20:00Z',sourceId:'cls',source:'财联社',sourceUrl:'https://www.cls.cn/detail/a',attention:0,emphasis:0};
 const late={...first,id:'b',title:'财政部发布经济政策',publishedAt:'2026-11-10T15:58:00Z',sourceUrl:'https://www.cls.cn/detail/b'};
 const next={...first,id:'c',date:'2026-11-11',publishedAt:'2026-11-10T16:01:00Z'};
 await archive.capture(date,{snapshot:market,news:{items:[first],asOf:now.toISOString()}});
 now=new Date('2026-11-10T16:05:00Z');await archive.sealPast();
 const payload={date,items:[late,first,next],asOf:now.toISOString()},collector={status:[{status:'error',lastSuccessAt:'2026-11-10T15:00:00Z'}],payload:async()=>payload};
 assert.equal(await completePreviousDay(archive,collector,now),null);
 const reports=new DailyReports({directory:root,clock:()=>now});await atomic(path.join(root,'news',date+'.json'),{records:[first],asOf:now.toISOString()});await reports.refreshAll();assert.equal((await reports.get(date)).status,'closing');
 now=new Date('2026-11-10T16:16:00Z');payload.asOf=now.toISOString();await atomic(path.join(root,'news',date+'.json'),{records:[late,first,next],asOf:now.toISOString()});
 assert.equal(await completePreviousDay(archive,collector,now),null);assert(!(await archive.get(date)).dayEnd);collector.status=[{status:'ok',lastSuccessAt:now.toISOString()}];
 const saved=await completePreviousDay(archive,collector,now);assert.equal(saved.news.items.length,2);assert.deepEqual(saved.snapshot,(await archive.get(date)).snapshot);assert.equal(saved.snapshot.collectedAt,market.collectedAt);assert.equal(saved.cutoffAt,dayCutoff(date));assert.equal(saved.dayEnd.newsCollectedAt,now.toISOString());
 await reports.refreshAll();const report=await reports.get(date);assert.equal(report.status,'final');assert.equal(report.news.items.length,2);assert(report.news.items.some(n=>n.id!==first.id));assert.equal(report.cutoffAt,dayCutoff(date));assert.equal(report.dayEndCompletedAt,now.toISOString());
 payload.items=[];await completePreviousDay(archive,collector,now);assert.deepEqual(await archive.get(date),saved);
});
