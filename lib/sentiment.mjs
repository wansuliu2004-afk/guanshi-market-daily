import path from 'node:path';
import {readdir} from 'node:fs/promises';
import {DATA_DIR,atomic,chinaDate,jsonFile,publicText} from './collector.mjs';

export const BREADTH_SOURCE={name:'东方财富 · 全 A 股行情',url:'https://quote.eastmoney.com/center/gridlist.html#hs_a_board'};
export const BREADTH_SCOPE='沪深京 A 股当日有成交且报价有效的股票；剔除停牌、无有效报价与非当日行情';
const stockFilter='m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048';
const finite=value=>value!==null&&value!==undefined&&value!==''&&value!=='-'&&Number.isFinite(Number(value));
const localTime=stamp=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(stamp));
export function summarizeBreadth(rows,{total,date,collectedAt=new Date().toISOString(),startedAt=collectedAt}={}){
 if(!Number.isInteger(total)||total<1||rows.length!==total)throw Error('全 A 股分页不完整，未计算情绪指标');
 const unique=new Set(rows.map(row=>row.f13+'.'+row.f12));if(unique.size!==total)throw Error('全 A 股分页有重复，未计算情绪指标');
 const active=rows.filter(row=>finite(row.f2)&&Number(row.f2)>0&&finite(row.f18)&&Number(row.f18)>0&&finite(row.f3)&&Number(row.f5)>0&&finite(row.f124)&&Number(row.f124)>0&&chinaDate(new Date(Number(row.f124)*1000))===date);
 if(active.length<total*.8)throw Error('有效当日报价不足，未计算情绪指标');
 let up=0,down=0,flat=0;for(const row of active){const change=Number(row.f2)-Number(row.f18);if(change>0)up++;else if(change<0)down++;else flat++;}
 const returns=active.map(row=>Number(row.f3)).sort((a,b)=>a-b),middle=Math.floor(returns.length/2);
 const moneyEffect=returns.length%2?returns[middle]:(returns[middle-1]+returns[middle])/2;
 const stamps=active.map(row=>Number(row.f124)*1000),asOf=new Date(Math.max(...stamps)).toISOString(),oldestQuoteAt=new Date(Math.min(...stamps)).toISOString();
 const isCloseSample=chinaDate(new Date(collectedAt))===date&&localTime(collectedAt)>='15:05'&&localTime(asOf)>='15:00';
 return {date,up,down,flat,moneyEffect:+moneyEffect.toFixed(3),temperature:+(up/active.length*100).toFixed(1),sampleCount:active.length,totalListed:total,excludedCount:total-active.length,complete:true,asOf,oldestQuoteAt,collectedAt,collectionStartedAt:startedAt,isCloseSample,source:BREADTH_SOURCE,scope:BREADTH_SCOPE,method:'日涨跌幅中位数；市场温度 = 上涨家数 / 有效成交家数 × 100'};
}

export async function collectBreadth({date=chinaDate(),request,concurrency=4,now=()=>new Date()}={}){
 const startedAt=now().toISOString(),deadline=Date.now()+90_000;
 const getPage=async page=>{
  let lastError;
  for(let attempt=0;attempt<2;attempt++){
   if(Date.now()>deadline)throw Error('全 A 股采集超时，保留上次成功指标');
   try{
    const url='https://push2.eastmoney.com/api/qt/clist/get?'+new URLSearchParams({pn:String(page),pz:'100',po:'1',np:'1',fltt:'2',invt:'2',fid:'f12',fs:stockFilter,fields:'f12,f13,f14,f2,f3,f18,f5,f124'});
    const response=request?await request(url):JSON.parse(await publicText(url,{timeout:6000}));
    if(!Number.isInteger(response.data?.total)||!Array.isArray(response.data?.diff))throw Error('全 A 股列表结构变化');
    return response.data;
   }catch(error){lastError=error;}
  }
  throw lastError;
 };
 const first=await getPage(1),pageSize=first.diff.length;
 if(first.total<1||pageSize<1||first.total>20000)throw Error('全 A 股候选数量异常');
 const pages=Math.ceil(first.total/pageSize),parts=[first.diff];let next=2,failed=null;
 await Promise.allSettled(Array.from({length:Math.min(concurrency,pages-1)},async()=>{
  try{while(!failed&&next<=pages){const page=next++,result=await getPage(page);if(result.total!==first.total)throw Error('采集期间上市总数变化，等待下轮重试');parts[page-1]=result.diff;}}
  catch(error){failed??=error;}
 }));
 if(failed)throw failed;
 return summarizeBreadth(parts.flat(),{total:first.total,date,startedAt,collectedAt:now().toISOString()});
}

export async function retainBreadth(metrics,{directory=DATA_DIR}={}){
 // 仅持久化聚合数值，不保存数千只股票的逐条行情。每日首份完整盘后样本用于历史比较。
 const file=path.join(directory,'sentiment',metrics.date+'.json'),saved=await jsonFile(file);
 if(metrics.isCloseSample&&!saved?.finalizedAt)await atomic(file,{...metrics,finalizedAt:metrics.collectedAt});
 const files=(await readdir(path.join(directory,'sentiment')).catch(()=>[])).filter(name=>/^\d{4}-\d{2}-\d{2}\.json$/.test(name)&&name.slice(0,-5)<=metrics.date).sort().slice(-250);
 const history=(await Promise.all(files.map(name=>jsonFile(path.join(directory,'sentiment',name))))).filter(item=>item?.finalizedAt&&item.complete&&Number.isFinite(item.temperature));
 const percentile=history.length===250?+((history.filter(item=>item.temperature<metrics.temperature).length+history.filter(item=>item.temperature===metrics.temperature).length*.5)/history.length*100).toFixed(1):null;
 return {...metrics,percentile,historyCount:history.length,historyWindow:250};
}

export function enrichCloseSentiment(close,snapshot,date){
 const breadth=snapshot?.sentiment?.breadth;
 if(!close||close.snapshot?.sentiment?.breadth?.complete||!breadth?.complete||!breadth.isCloseSample||breadth.date!==date)return close;
 const sentiment={...close.snapshot.sentiment,...Object.fromEntries(['up','down','flat','moneyEffect','temperature','percentile'].map(key=>[key,breadth[key]??null])),breadth};
 const source=snapshot.sources?.find(s=>s.id==='breadth');
 const sources=[...(close.snapshot.sources||[]).filter(s=>s.id!=='breadth'),...(source?[source]:[])];
 return {...close,snapshot:{...close.snapshot,sentiment,sources},sentimentAddedAt:breadth.collectedAt};
}
