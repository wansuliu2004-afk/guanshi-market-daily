import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {mkdtemp,readdir,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {summarizeBreadth,collectBreadth,retainBreadth,enrichCloseSentiment} from '../lib/sentiment.mjs';
import {parseBondYield} from '../lib/markets.mjs';
import {DailyReports,marketOverview} from '../lib/reports.mjs';
import {atomic} from '../lib/collector.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'guanshi-markets-'));
after(()=>rm(root,{recursive:true,force:true}));
const date='2026-11-10',stamp='2026-11-10T07:10:00.000Z';
const row=(id,change=1)=>({f12:String(id),f13:0,f2:100+change,f3:change,f18:100,f5:100,f124:Date.parse(stamp)/1000});
const summarize=rows=>summarizeBreadth(rows,{total:rows.length,date,collectedAt:stamp});
test('全 A 样本按量价和日期剔除无效股票，计算中位数与上涨占比',()=>{
 const metrics=summarize([row(1,-2),row(2,0),row(3,1),row(4,2),row(5,3),row(6,4),row(7,5),row(8,6),{...row(9),f5:0},{...row(10),f124:Date.parse('2026-11-09T07:00:00Z')/1000}]);
 assert.equal(metrics.up,6);assert.equal(metrics.down,1);assert.equal(metrics.flat,1);assert.equal(metrics.moneyEffect,2.5);assert.equal(metrics.temperature,75);
 assert.equal(metrics.sampleCount,8);assert.equal(metrics.excludedCount,2);assert(metrics.isCloseSample);
 assert.equal(summarize([row(1,-1),row(2,2),row(3,3)]).moneyEffect,2);
 assert.throws(()=>summarize([row(1),row(1)]),/重复/);
 assert.throws(()=>summarize([row(1),{...row(2),f2:'-'}]),/不足/);
 assert.throws(()=>summarizeBreadth([row(1)],{total:2,date}),/不完整/);
});
test('分页完整并去重才发布，页缺失、重复或总数变化拒绝计算',async()=>{
 const request=mode=>async url=>{const page=Number(new URL(url).searchParams.get('pn'));return {data:{total:mode==='total'&&page===2?6:5,diff:page===1?[row(1),row(2)]:page===2?mode==='missing'?[]:[row(mode==='duplicate'?2:3),row(4)]:[row(5)]}};};
 const metrics=await collectBreadth({date,request:request('ok'),now:()=>new Date(stamp)});assert.equal(metrics.sampleCount,5);
 for(const mode of ['missing','duplicate','total'])await assert.rejects(collectBreadth({date,request:request(mode),now:()=>new Date(stamp)}));
});
test('情绪只保存聚合，首份盘后样本固定，未满250日不计算分位',async()=>{
 const directory=path.join(root,'sentiment'),metrics=summarize([row(1),row(2,-1)]);
 let retained=await retainBreadth({...metrics,isCloseSample:false},{directory});assert.equal(retained.historyCount,0);assert.equal(retained.percentile,null);
 retained=await retainBreadth(metrics,{directory});assert.equal(retained.historyCount,1);assert.equal(retained.percentile,null);
 const file=path.join(directory,'sentiment',date+'.json'),first=await readFile(file,'utf8');
 await retainBreadth({...metrics,temperature:99},{directory});assert.equal(await readFile(file,'utf8'),first);assert(!first.includes('f12'));
 for(let i=1;i<250;i++){const day=new Date(Date.parse(date+'T00:00:00Z')-i*86400000).toISOString().slice(0,10);await atomic(path.join(directory,'sentiment',day+'.json'),{complete:true,finalizedAt:stamp,temperature:40});}
 retained=await retainBreadth(metrics,{directory});assert.equal(retained.historyCount,250);assert.equal(retained.percentile,99.8);
 assert.equal((await readdir(path.join(directory,'sentiment'))).length,250);
});
test('只有同日完整盘后情绪可补入既有收盘，价格与原统计保持',()=>{
 const close={snapshot:{markets:[{id:'sh',value:'100'}],sentiment:{up:null,limitUp:93},sources:[]}};
 const snapshot={sentiment:{breadth:summarize([row(1),row(2,-1)])},sources:[{id:'breadth',status:'ok'}]};
 for(const changes of [{date:'2026-11-09'},{isCloseSample:false},{complete:false}])assert.equal(enrichCloseSentiment(close,{...snapshot,sentiment:{breadth:{...snapshot.sentiment.breadth,...changes}}},date),close);
 const next=enrichCloseSentiment(close,snapshot,date);assert.deepEqual(next.snapshot.markets,close.snapshot.markets);assert.equal(next.snapshot.sentiment.limitUp,93);assert.equal(next.snapshot.sentiment.up,1);assert.equal(next.sentimentAddedAt,stamp);assert.equal(next.snapshot.sources[0].id,'breadth');
 assert.equal(enrichCloseSentiment(next,snapshot,date),next);
});
test('国债按真实日度日期展示，变化单位为百分点，不使用未来数据',()=>{
 const response={result:{data:[{SOLAR_DATE:'2026-11-11',EMM00166466:99},{SOLAR_DATE:date,EMM00166466:1.5965},{SOLAR_DATE:'2026-11-09',EMM00166466:1.5874}]}};
 const bond=parseBondYield(response,date);assert.equal(bond.value,'1.5965%');assert.equal(bond.change,.0091);assert.equal(bond.quoteDate,date);assert.equal(bond.asOf,null);assert.equal(bond.frequency,'daily');
 assert.equal(parseBondYield(response,'2026-11-09').change,null);assert.throws(()=>parseBondYield(response,'2026-11-08'));
});
test('日报从同日归档补齐全市场，封存后不变更收盘价格或新闻名次',async()=>{
 const directory=path.join(root,'reports'),snapshot={date,collectedAt:stamp,markets:[{id:'sh',category:'A股',value:'100'},{id:'hk',value:'200'},{id:'bond',value:'1.5%'}],sectors:[],sentiment:{breadth:summarize([row(1),row(2,-1)])}};
 const original={date,finalizedAt:'2026-11-11T00:00:00Z',news:{items:[{id:'first',score:90,rank:1}]},close:{capturedAt:stamp,snapshot:{markets:[{id:'sh',value:'99'}],sentiment:{up:null},sources:[]}}};
 await atomic(path.join(directory,'site.json'),{startedDate:date});await atomic(path.join(directory,'archive',date+'.json'),{snapshot});await atomic(path.join(directory,'reports',date+'.json'),original);
 const reports=new DailyReports({directory,clock:()=>new Date('2026-11-11T01:00:00Z')});await reports.refreshAll();const saved=await reports.get(date);
 assert.equal(saved.marketOverview.markets.length,3);assert.equal(saved.marketOverview.markets[1].group,'港股');assert.equal(saved.marketOverview.markets[2].group,'利率');assert.deepEqual(saved.news,original.news);assert.deepEqual(saved.close.snapshot.markets,original.close.snapshot.markets);assert.equal(saved.close.snapshot.sentiment.up,1);
 await atomic(path.join(directory,'archive',date+'.json'),{snapshot:{...snapshot,markets:[]}});await reports.refreshAll();assert.deepEqual(await reports.get(date),saved);
 assert.equal(marketOverview({...snapshot,date:'2026-11-11'},date),null);
});
test('当日概览可补充海外报价，收盘锁定；跨日后概览也固定',async()=>{
 const directory=path.join(root,'lifecycle'),snapshot={date,collectedAt:stamp,markets:['sh','sz','cy','kc'].map(id=>({id,category:'A股',rawValue:100,value:'100',change:1,asOf:stamp})),intraday:[{date,time:'15:00',value:100}],candles:[{tradeDate:date,values:[99,100,98,101]}],sectors:[],sources:[],recap:{paragraphs:[]},sentiment:{}};
 snapshot.markets.push({id:'hk',value:'200',change:1});
 await atomic(path.join(directory,'site.json'),{startedDate:date});await atomic(path.join(directory,'archive',date+'.json'),{snapshot});
 let now=new Date(stamp);const reports=new DailyReports({directory,clock:()=>now});await reports.refreshAll();const first=await reports.get(date);assert.equal(first.close.snapshot.markets.length,4);
 snapshot.markets.at(-1).value='210';await atomic(path.join(directory,'archive',date+'.json'),{snapshot});await reports.refreshAll();const next=await reports.get(date);assert.deepEqual(next.close,first.close);assert.equal(next.marketOverview.markets.at(-1).value,'210');
 now=new Date('2026-11-11T01:00:00Z');await reports.refreshAll();const final=await reports.get(date);assert(final.finalizedAt);
 snapshot.markets.at(-1).value='220';await atomic(path.join(directory,'archive',date+'.json'),{snapshot});await reports.refreshAll();assert.deepEqual(await reports.get(date),final);
});
