import assert from 'node:assert/strict';
import {after,test} from 'node:test';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {previousUSSession,overnightReady,collectOvernight,dailyMarketSnapshot,parseOvernight,mergeOvernightOverview} from '../lib/overnight.mjs';
import {DailyArchive} from '../lib/archive.mjs';
import {atomic,jsonFile} from '../lib/collector.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'guanshi-overnight-'));after(()=>rm(root,{recursive:true,force:true}));
const now=new Date('2026-11-11T06:00:00Z');
const row=(date,close)=>[date,String(close-1),String(close),String(close+5),String(close-5),'100'];
const rows=[row('2026-11-04',95),row('2026-11-05',98),row('2026-11-06',100),row('2026-11-09',103),row('2026-11-10',101),row('2026-11-11',999)];
const response=(symbol,data=rows)=>({code:0,data:{[symbol]:{day:data}}});
const request=async url=>{const symbol=new URL(url).searchParams.get('param').split(',')[0];return response(symbol);};

test('隔夜按交易日顺延周末及常规休市日，不把日历前一天当交易日',()=>{
 assert.equal(previousUSSession('2026-11-09'),'2026-11-06');
 assert.equal(previousUSSession('2026-11-10'),'2026-11-09');
 assert.equal(previousUSSession('2026-11-27'),'2026-11-25');
 assert.equal(previousUSSession('2026-11-30'),'2026-11-27');
 assert.equal(previousUSSession('2026-04-06'),'2026-04-02');
 assert.equal(previousUSSession('2026-07-06'),'2026-07-02');
 assert.equal(previousUSSession('2026-06-22'),'2026-06-18');
 assert.equal(previousUSSession('2027-01-04'),'2026-12-31');
});
test('冬夏令时均等到目标日常规收盘后一小时才锁定，不用盘中日K',()=>{
 assert(!overnightReady('2026-11-10',new Date('2026-11-09T21:59:00Z')));
 assert(overnightReady('2026-11-10',new Date('2026-11-09T22:00:00Z')));
 assert(!overnightReady('2026-07-07',new Date('2026-07-06T20:59:00Z')));
 assert(overnightReady('2026-07-07',new Date('2026-07-06T21:00:00Z')));
 assert(overnightReady('2026-11-09',new Date('2026-11-08T20:00:00Z')));
});
test('指定交易日日K提取收盘及涨跌，不采用当前行或伪造收盘时间',()=>{
 const market=parseOvernight(response('us.INX'),['sp','us.INX','标普500','SPX'],'2026-11-10',now.toISOString());
 assert.equal(market.rawValue,103);assert.equal(market.change,3);assert.equal(market.tradeDate,'2026-11-09');assert.equal(market.asOf,null);assert.equal(market.collectedAt,now.toISOString());
 assert.throws(()=>parseOvernight(response('us.INX',rows.filter(r=>r[0]!=='2026-11-09')),['sp','us.INX','标普500','SPX'],'2026-11-10',now.toISOString()),/缺少目标交易日/);
});
test('首次齐备即锁定，后续源修订和实时盘中价均不能覆盖隔夜',async()=>{
 const directory=path.join(root,'locked');let calls=0;
 await collectOvernight(['2026-11-09','2026-11-10','2026-11-11'],{directory,now,request:async url=>{calls++;return request(url);}});
 assert.equal(calls,3);const file=path.join(directory,'overnight','2026-11-09.json'),original=await readFile(file,'utf8');
 await collectOvernight(['2026-11-09','2026-11-10','2026-11-11'],{directory,now:new Date('2026-11-12T07:00:00Z'),request:()=>{throw Error('不得再请求已锁定记录');}});
 assert.equal(await readFile(file,'utf8'),original);
 const live={date:'2026-11-09',markets:[{id:'sh',value:'3660.79'},{id:'sp',value:'99999',rawValue:99999,asOf:'2026-11-09T15:42:00Z'}],sources:[]};
 const daily=await dailyMarketSnapshot(live,{directory});assert.equal(live.markets[1].rawValue,99999);assert.equal(daily.markets.find(m=>m.id==='sp').rawValue,100);assert.equal(daily.overnight.usTradeDate,'2026-11-06');assert.equal(daily.markets.filter(m=>m.overnight).length,3);
});
test('目标日缺数时保持待确认，单日失败不阻止其他日期锁定',async()=>{
 const directory=path.join(root,'missing');
 await assert.rejects(collectOvernight(['2026-11-09','2026-11-10'],{directory,now,request:async url=>{const symbol=new URL(url).searchParams.get('param').split(',')[0];return response(symbol,rows.filter(r=>r[0]!=='2026-11-09'));}}),/2026-11-10/);
 assert((await jsonFile(path.join(directory,'overnight','2026-11-09.json'))).lockedAt);
 const daily=await dailyMarketSnapshot({date:'2026-11-10',markets:[{id:'sp',value:'100',rawValue:100}],sources:[]},{directory});assert.equal(daily.overnight.status,'error');assert(daily.markets.every(m=>m.value==='—'));
});
test('旧日档迁移只替换美股字段，保留封存时间、A股价格及新闻名次',async()=>{
 const directory=path.join(root,'migration'),date='2026-11-09',stamp='2026-11-09T15:42:00Z';
 await atomic(path.join(directory,'site.json'),{startedDate:date});
 const aShare={id:'sh',value:'3660.79',asOf:'2026-11-09T07:00:00Z'},news={items:[{id:'news',rank:1,score:90}]};
 await atomic(path.join(directory,'archive',date+'.json'),{date,sealedAt:stamp,news,snapshot:{date,markets:[aShare,{id:'sp',value:'99999'}],sources:[]}});
 await collectOvernight([date],{directory,now,request});const archive=new DailyArchive({directory,clock:()=>now});await archive.init();await archive.applyOvernightBindings();
 const saved=await jsonFile(path.join(directory,'archive',date+'.json'));assert.deepEqual(saved.news,news);assert.equal(saved.sealedAt,stamp);assert.deepEqual(saved.snapshot.markets[0],aShare);assert.equal(saved.snapshot.markets.find(m=>m.id==='sp').rawValue,100);
 const previous={markets:[aShare,{id:'sp',value:'99999'}],sources:[]},merged=mergeOvernightOverview(previous,saved.snapshot);assert.deepEqual(merged.markets[0],aShare);assert.equal(merged.markets.find(m=>m.id==='sp').rawValue,100);assert.equal(mergeOvernightOverview(merged,saved.snapshot),merged);
});
