// 同一交易日判断供采集端与页面共用；所有日期均为北京时间。
export const chinaDateOf=value=>value?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value)):null;
const chinaTime=value=>new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value));
const aIds=new Set(['sh','sz','cy','kc','hs300','sz50','zz500','zz1000','bj50']);
export const isAShare=market=>market.category==='A股'||aIds.has(market.id);
export function marketContext(snapshot,date=snapshot?.date,now=new Date()){
 const sh=snapshot?.markets?.find(m=>m.id==='sh'),quoteDate=chinaDateOf(sh?.asOf),sameDay=quoteDate===date;
 const current=chinaDateOf(now),time=current===date?chinaTime(now):'23:59',weekend=[0,6].includes(new Date(date+'T12:00:00Z').getUTCDay());
 if(snapshot?.status==='daily-close')return {phase:'closed',label:'当日收盘已保存',hasTodayQuote:true,quoteDate};
 if(!sameDay)return {phase:weekend?'non-trading':current===date&&time<'09:30'?'preopen':'awaiting-data',label:weekend?'周末 · 暂无当日交易数据':current===date&&time<'09:30'?'今日 A 股未开盘':'今日 A 股行情尚未取得',hasTodayQuote:false,quoteDate,message:quoteDate?`仅有 ${quoteDate} 报价，属于上一交易日参考，不代表 ${date} 行情。`:'尚未取得所选日期的 A 股报价，不使用其他日期代替。'};
 const quoteTime=chinaTime(sh.asOf);
 if(time<'09:30')return {phase:'auction',label:'开盘前 / 集合竞价',hasTodayQuote:true,quoteDate};
 if(quoteTime<'15:00'&&time>='15:00')return {phase:'awaiting-close',label:'等待当日完整收盘数据',hasTodayQuote:true,quoteDate};
 return {phase:quoteTime>='15:00'?'close-observed':time>='11:30'&&time<'13:00'?'midday':'intraday',label:quoteTime>='15:00'?'当日收盘报价':time>='11:30'&&time<'13:00'?'午间休市 · 保留上午行情':'当日盘中采样',hasTodayQuote:true,quoteDate};
}
export function normalizeMarketSnapshot(snapshot){
 if(!snapshot||snapshot.demo)return snapshot;
 const date=snapshot.date,context=marketContext(snapshot,date,snapshot.collectedAt||new Date());
 const markets=(snapshot.markets||[]).map(m=>{
  const quoteDate=m.quoteDate||chinaDateOf(m.asOf),reference=isAShare(m)&&quoteDate!==date;
  return {...m,quoteDate,reference,quoteLabel:reference?(quoteDate?'上一交易日参考 · '+quoteDate:'尚无当日报价'):m.frequency==='daily'?'日度 · '+quoteDate:isAShare(m)?context.label:'报价 · '+(quoteDate||'日期未知'),...(reference?{trend:[],turnoverYuan:null}:{})};
 });
 const sectors=(snapshot.sectors||[]).filter(s=>s.asOf&&chinaDateOf(s.asOf)===date);
 const current=context.hasTodayQuote;
 const noSession=context.phase==='preopen'||context.phase==='non-trading';
 const sentiment=!noSession?snapshot.sentiment:{...snapshot.sentiment,up:null,down:null,flat:null,moneyEffect:null,temperature:null,percentile:null,breadth:null,limitUp:null,limitDown:null,height:null,brokenRate:null};
 const recap=current?snapshot.recap:{...snapshot.recap,regime:context.phase==='preopen'?'未开盘':'等待当日行情',summary:context.label,turnover:'—',turnoverDelta:'',paragraphs:[{title:'今日盘面',brief:context.label+'。'+context.message,full:context.label+'。'+context.message},{title:'板块观察',brief:'当日板块数据尚未产生时保持空白，报价到齐后自动显示。',full:'当日板块数据尚未产生时保持空白，报价到齐后自动显示。'},{title:'收盘记录',brief:'等待所选日期收盘，不沿用上一交易日的收盘结论。',full:'等待所选日期收盘，不沿用上一交易日的收盘结论。'}]};
 return {...snapshot,markets,sectors,intraday:(snapshot.intraday||[]).filter(p=>p.date===date),sentiment,limitThemes:current?snapshot.limitThemes:[],marketContext:context,status:snapshot.status==='daily-close'?'daily-close':context.phase==='preopen'?'preopen':!current?'awaiting-data':snapshot.status,recap};
}
