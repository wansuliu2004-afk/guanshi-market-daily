import assert from 'node:assert/strict';
import {test} from 'node:test';
import {retryMarketRequest,settleMarketTasks} from '../lib/market-request.mjs';
import {marketOverviewHealth} from '../public/market-health.js';

const markets=[{id:'sh',name:'上证指数',value:'3654.88',change:1,trend:[1,2]},
 {id:'nk',name:'日经225',value:'60942.48',change:0.8},
 {id:'fx',name:'离岸人民币',value:'—',status:'unavailable'},
 {id:'bond',name:'中国10Y国债',value:'1.59%',frequency:'daily'}];
const snapshot={markets,sources:[{id:'quotes',status:'ok'},
 {id:'extra',status:'error',lastSuccessAt:'2026-11-11T02:38:41Z'},
 {id:'sectors',status:'error'}]};

test('跨市场来源失败仅提示日经和汇率，不影响A股、利率或板块状态',()=>{
 assert.deepEqual(marketOverviewHealth(snapshot,[markets[0],markets[3]]),[]);
 const warnings=marketOverviewHealth(snapshot,markets);
 assert.equal(warnings.length,1);assert.equal(warnings[0].source.id,'extra');
 assert.deepEqual(warnings[0].cached,['日经225']);assert.deepEqual(warnings[0].missing,['离岸人民币']);
 assert.equal(warnings[0].source.lastSuccessAt,'2026-11-11T02:38:41Z');
 assert.deepEqual(marketOverviewHealth({...snapshot,sources:[{id:'extra',status:'ok'}]},markets),[]);
});
test('分钟走势失败与最新报价分开，已有分时替代时不上报上证走势图失败',()=>{
 const data={sources:[{id:'quotes',status:'ok'},{id:'trends',status:'error'},{id:'intraday',status:'ok'}]};
 assert.deepEqual(marketOverviewHealth(data,[markets[0]]),[]);
 const warnings=marketOverviewHealth(data,[{id:'sz',name:'深证成指',value:'100',trend:[]},{id:'cy',name:'创业板指',value:'200',trend:[1,2]}]);
 assert.equal(warnings[0].kind,'分钟走势');assert.deepEqual(warnings[0].missing,['深证成指']);assert.deepEqual(warnings[0].cached,['创业板指']);
});
test('临时网络失败在有限退避后恢复，保留返回结果',async()=>{
 let attempts=0;const delays=[];
 const result=await retryMarketRequest(async()=>{if(++attempts<3)throw new TypeError('fetch failed');return 'recovered';},{sleep:async delay=>delays.push(delay)});
 assert.equal(result,'recovered');assert.equal(attempts,3);assert.deepEqual(delays,[500,1500]);
});
test('超时和服务端错误最多三次，不对权限拒绝或数据结构变化重试',async()=>{
 for(const error of [new DOMException('timeout','TimeoutError'),new Error('HTTP 503'),new Error('HTTP 429'),new Error('HTTP 403'),new SyntaxError('JSON invalid'),new Error('板块结构变化')]){
  let attempts=0;await assert.rejects(retryMarketRequest(async()=>{attempts++;throw error;},{sleep:async()=>{}}),e=>e===error);
  assert.equal(attempts,/TimeoutError/.test(error.name)||/HTTP (503|429)/.test(error.message)?3:1);
 }
});
test('行情任务限制并发，单源失败不影响其他源或结果顺序',async()=>{
 let active=0,maxActive=0;const failure=new Error('source unavailable');
 const results=await settleMarketTasks(Array.from({length:8},(_,index)=>async()=>{
  active++;maxActive=Math.max(maxActive,active);await new Promise(resolve=>setTimeout(resolve,5));active--;
  if(index===2)throw failure;return index;
 }));
 assert.equal(maxActive,3);assert.equal(results[2].reason,failure);
 assert.deepEqual(results.filter(r=>r.status==='fulfilled').map(r=>r.value),[0,1,3,4,5,6,7]);
});
