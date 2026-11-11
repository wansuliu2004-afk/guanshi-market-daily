import assert from 'node:assert/strict';
import {test} from 'node:test';
import {heatColor,usQuoteContext,intradayReference,intradayExtent} from '../public/market-display.js';
import {marketObservations} from '../public/market-observations.js';
import {withMarketSources} from '../lib/market-sources.mjs';

test('美股明确美东报价日期与常规时段，北京观察日不冒充美国收盘日',()=>{
 const quote=asOf=>usQuoteContext({id:'sp',asOf});
 assert.deepEqual([quote('2026-11-09T15:42:00Z').date,quote('2026-11-09T15:42:00Z').time],['2026-11-09','10:42:00']);
 assert.match(quote('2026-11-09T15:42:00Z').phase,/盘中/);
 assert.equal(quote('2026-11-10T22:00:31Z').date,'2026-11-10');
 assert.match(quote('2026-11-10T22:00:31Z').phase,/收盘后/);
 assert.match(quote('2026-11-10T22:00:31Z').detail,/不据此确认/);
 assert.match(quote('2026-11-09T14:29:00Z').phase,/开盘前/);
 assert.match(quote('2026-11-09T14:30:00Z').phase,/盘中/);
 assert.match(quote('2026-11-09T21:00:00Z').phase,/收盘后/);
 assert.match(quote('2026-11-08T15:00:00Z').phase,/非工作日/);
 assert.match(usQuoteContext({id:'nas'}).label,/未知/);
 assert.equal(usQuoteContext({id:'sh'}),null);
});
test('美股按 IANA 时区处理夏令时，开盘边界随季节变化',()=>{
 assert.equal(usQuoteContext({id:'sp',asOf:'2026-07-06T13:30:00Z'}).time,'09:30:00');
 assert.equal(usQuoteContext({id:'sp',asOf:'2026-11-09T14:30:00Z'}).time,'09:30:00');
 assert.equal(usQuoteContext({id:'sp',asOf:'2026-11-10T02:00:00Z'}).date,'2026-11-09');
});
test('留存数据补充美东元数据，保留原始数值与UTC时间，不把北京时间当美国报价日',()=>{
 const market={id:'sp',name:'标普500',code:'SPX · 隔夜',rawValue:7520.93,value:'7,520.93',asOf:'2026-11-10T22:00:31Z'};
 const snapshot={date:'2026-11-11',markets:[market],sectors:[],recap:{paragraphs:[]}};
 const projected=withMarketSources(snapshot).markets[0];
 assert.equal(projected.exchangeQuoteDate,'2026-11-10');assert.equal(projected.quoteDate,'2026-11-11');
 assert.equal(projected.rawValue,market.rawValue);assert.equal(projected.asOf,market.asOf);assert.doesNotMatch(projected.code,/隔夜/);
 assert.equal(market.code,'SPX · 隔夜');
});
test('热力图连续对称映射、零附近中性、端点截断，所有色阶文字达到4.5对比度',()=>{
 for(const dark of [false,true]){
  for(let i=-600;i<=600;i++)assert(heatColor(i/100,{dark}).contrast>=4.5);
  assert.notEqual(heatColor(.46,{dark}).background,heatColor(.91,{dark}).background);
  assert.notEqual(heatColor(-.23,{dark}).background,heatColor(-.81,{dark}).background);
  assert.equal(heatColor(-.04,{dark}).background,heatColor(.04,{dark}).background);
  assert.equal(heatColor(9,{dark}).background,heatColor(5,{dark}).background);
  assert.equal(heatColor(-9,{dark}).background,heatColor(-5,{dark}).background);
 }
});
test('分时昨收取真实来源或前一根日K，不能拿今收或四舍五入涨幅倒算',()=>{
 const snapshot={date:'2026-11-09',markets:[{id:'sh',rawValue:3660.79,change:.32}],candles:[{tradeDate:'2026-11-06',values:[1,3649.18,1,1]},{tradeDate:'2026-11-09',values:[1,3660.79,1,1]}]};
 assert.equal(intradayReference(snapshot).value,3649.18);
 assert.equal(intradayReference({...snapshot,previousClose:3650}).value,3650);
 assert.equal(intradayReference({...snapshot,candles:[]}),null);
 const extent=intradayExtent([{value:3679.09},{value:3653.05}],intradayReference(snapshot));
 assert(Math.abs((extent.max-3649.18)-(3649.18-extent.min))<1e-8);
 assert(Math.abs(extent.max/3649.18-1)>=.0099);
});
test('规则观察呈现可重算的分化、行业名称归类及价格资金背离，不改原记录',()=>{
 const snapshot={date:'2026-11-11',collectedAt:'2026-11-11T07:10:00Z',markets:[{id:'sh',change:.5}],sources:[{id:'sectors',status:'error',lastSuccessAt:'2026-11-11T07:00:00Z'}],recap:{turnover:'1.48',paragraphs:[]},sentiment:{breadth:{date:'2026-11-11',complete:true,temperature:35,moneyEffect:-.8,sampleCount:5000,collectedAt:'2026-11-11T07:05:00Z'},brokenRate:45},sectors:[{name:'半导体',change:4,flow:-2},{name:'通信',change:3,flow:1},{name:'煤炭',change:2,flow:1}]};
 const original=structuredClone(snapshot),recap=marketObservations(snapshot);
 assert.match(recap.regime,/分化/);assert.match(recap.paragraphs.find(p=>p.title==='强势方向').brief,/2 项.*电子与通信/);
 assert.match(recap.paragraphs.find(p=>p.title==='资金印证').brief,/半导体.*净流出/);
 assert.match(recap.paragraphs.find(p=>p.title==='资金印证').evidence,/缓存/);
 assert.match(recap.paragraphs.at(-1).brief,/≥40%/);assert.equal(recap.turnover,'1.48');assert.deepEqual(snapshot,original);
 const early={...snapshot,marketContext:{hasTodayQuote:false}};assert.equal(marketObservations(early),snapshot.recap);
 const incomplete=marketObservations({...snapshot,sentiment:{},sectors:[]});assert.equal(incomplete.paragraphs.length,1);assert(!incomplete.paragraphs.some(p=>p.title==='市场结构'));
 const mostlyFlat=marketObservations({...snapshot,markets:[{id:'sh',change:0}],sentiment:{breadth:{...snapshot.sentiment.breadth,temperature:20,moneyEffect:0,flat:4000}}});
 assert.match(mostlyFlat.summary,/上涨个股.*不超过三成/);assert.doesNotMatch(mostlyFlat.summary,/多数.*下跌/);
});
