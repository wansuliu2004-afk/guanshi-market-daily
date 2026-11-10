import assert from 'node:assert/strict';
import {after, test} from 'node:test';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root=await mkdtemp(path.join(os.tmpdir(),'guanshi-summaries-'));
process.env.DATA_DIR=root;
const {atomic,chinaDate,Collector,plainSummary,rankNews}=await import('../lib/collector.mjs');
const {DailyReports}=await import('../lib/reports.mjs');
after(()=>rm(root,{recursive:true,force:true}));

test('摘要只清理来源短字段并限制长度',()=>{
 assert.equal(plainSummary('【央行政策】利率调整说明<b>市场解读</b>','央行政策'),'利率调整说明市场解读');
 assert.equal(plainSummary('央行政策','央行政策'),null);
 assert.equal(plainSummary('   '),null);
 assert.equal(Array.from(plainSummary('市'.repeat(180))).length,140);
});

test('多源合并时保留短摘要来源，不影响排名或透传正文',()=>{
 const title='央行发布重要金融政策';
 const records=[
  {id:'cls-1',title,source:'财联社',sourceId:'cls',sourceUrl:'https://www.cls.cn/detail/1',publishedAt:'2026-11-10T02:00:00.000Z',date:'2026-11-10',attention:80,emphasis:1,content:'不应保存的全文'},
  {id:'em-1',title,source:'东方财富',sourceId:'eastmoney',sourceUrl:'https://finance.eastmoney.com/a/1.html',publishedAt:'2026-11-10T02:01:00.000Z',date:'2026-11-10',attention:30,emphasis:.5,summary:'政策安排的来源短摘要'}
 ];
 const withSummary=rankNews(records,Date.parse('2026-11-10T03:00:00Z'))[0];
 const withoutSummary=rankNews(records.map(({summary,...item})=>item),Date.parse('2026-11-10T03:00:00Z'))[0];
 assert.equal(withSummary.summary,'政策安排的来源短摘要');
 assert.equal(withSummary.summarySource,'东方财富');
 assert.equal(withSummary.sourceCount,2);
 assert.equal(withSummary.score,withoutSummary.score);
 assert.equal(withSummary.rank,withoutSummary.rank);
 assert(!JSON.stringify(withSummary).includes('不应保存的全文'));
});

test('历史日报只回填来源摘要，不改定稿名次和分数',async()=>{
 const directory=path.join(root,'history-fixture');
 const date='2026-11-10',url='https://finance.eastmoney.com/a/1.html';
 await atomic(path.join(directory,'site.json'),{startedDate:date});
 await atomic(path.join(directory,'archive',date+'.json'),{snapshot:null});
 await atomic(path.join(directory,'news',date+'.json'),{records:[{sourceUrl:url,source:'东方财富',summary:'存档的独立短摘要'}]});
 const report={version:1,date,createdAt:'2026-11-10T10:00:00.000Z',updatedAt:'2026-11-10T10:00:00.000Z',finalizedAt:'2026-11-11T00:00:00.000Z',news:{date,status:'final',items:[{id:'topic-1',title:'财经标题',source:'财联社',sourceUrl:'https://www.cls.cn/detail/1',relatedSources:[{name:'东方财富',url}],rank:1,score:91}],ranking:{name:'全日重要度'}}};
 await atomic(path.join(directory,'reports',date+'.json'),report);
 const reports=new DailyReports({directory,clock:()=>new Date('2026-11-11T01:00:00.000Z')});
 await reports.refreshAll();
 const saved=await reports.get(date);
 assert.equal(saved.news.items[0].summary,'存档的独立短摘要');
 assert.equal(saved.news.items[0].summarySource,'东方财富');
 assert.equal(saved.news.items[0].rank,1);
 assert.equal(saved.news.items[0].score,91);
 assert.equal(saved.news.ranking.name,'全日重要度');
 const {summary,summarySource,...originalItem}=saved.news.items[0];
 assert.deepEqual(originalItem,report.news.items[0]);
 assert.equal(saved.finalizedAt,report.finalizedAt);
 await reports.refreshAll();assert.deepEqual(await reports.get(date),saved);
});

test('来源适配器只保存独立摘要，缺少摘要不回退正文，暂缺字段保留上次摘要',async t=>{
 const date=chinaDate(),stamp=Date.parse(date+'T10:00:00+08:00')/1000;let includeSummary=true;
 t.mock.method(globalThis,'fetch',async url=>{
  if(String(url).includes('cls.cn'))return Response.json({errno:0,data:{roll_data:[{id:101,title:'央行公布金融市场政策',ctime:stamp,brief:includeSummary?'【央行公布金融市场政策】<b>来源独立短摘要</b>。':'',content:'CLS_FULL_BODY_SENTINEL'},{id:102,title:'半导体公司公布季度业绩',ctime:stamp,content:'CLS_NO_SUMMARY_BODY_SENTINEL'}]}});
  if(String(url).includes('eastmoney.com'))return new Response('var ajaxResult = '+JSON.stringify({LivesList:[{title:'原油市场发布行情报告',url_w:'https://finance.eastmoney.com/a/summary-fixture.html',showtime:date+' 10:05:00',digest:'',simdigest:'东方财富的独立短摘要。',body:'EASTMONEY_FULL_BODY_SENTINEL'}]})+';');
  if(String(url).includes('wallstcn.com'))return Response.json({code:20000,data:{items:[{title:'海外金融市场每日观察',uri:'https://wallstreetcn.com/livenews/101',display_time:stamp,content:'WALLSTREET_FULL_BODY_SENTINEL',content_text:'WALLSTREET_CONTENT_TEXT_SENTINEL'}]}});
  return new Response('<ul id="content"><a href="https://tv.cctv.com/'+date.replaceAll('-','/')+'/fixture.shtml">[视频]经济数据发布观察</a></ul>');
 });
 const collector=new Collector();await collector.init();await collector.refresh();
 const file=path.join(root,'news',date+'.json'),first=JSON.parse(await readFile(file,'utf8'));
 const cls=first.records.find(r=>r.id.startsWith('cls-')&&r.sourceUrl.endsWith('/101'));
 assert.equal(cls.summary,'来源独立短摘要。');
 assert.equal(first.records.find(r=>r.sourceId==='eastmoney').summary,'东方财富的独立短摘要。');
 assert(first.records.filter(r=>['wallstreet','cctv'].includes(r.sourceId)).every(r=>!r.summary));
 assert(!first.records.find(r=>r.sourceUrl.endsWith('/102')).summary);
 assert(!JSON.stringify(first).includes('BODY_SENTINEL'));assert(!JSON.stringify(first).includes('CONTENT_TEXT_SENTINEL'));
 includeSummary=false;await collector.refresh();const next=JSON.parse(await readFile(file,'utf8'));
 assert.equal(next.records.find(r=>r.id===cls.id).summary,cls.summary);
 const payload=await collector.payload(date);assert(payload.items.some(r=>r.summary));assert(!JSON.stringify(payload).includes('BODY_SENTINEL'));
});
