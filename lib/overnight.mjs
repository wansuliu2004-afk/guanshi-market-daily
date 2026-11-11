import path from 'node:path';
import {DATA_DIR,atomic,jsonFile,chinaDate} from './collector.mjs';
import {marketJSON} from './market-request.mjs';

const specs=[['sp','us.INX','标普 500','SPX'],['nas','us.IXIC','纳斯达克','IXIC'],['dji','us.DJI','道琼斯','DJI']];
const usIds=new Set(specs.map(s=>s[0]));
const dayDate=date=>new Date(date+'T12:00:00Z');
const dayString=date=>date.toISOString().slice(0,10);
const shift=(date,days)=>dayString(new Date(dayDate(date).getTime()+days*86400000));
const nthWeekday=(year,month,weekday,n)=>{const first=new Date(Date.UTC(year,month-1,1,12));return dayString(new Date(Date.UTC(year,month-1,1+(weekday-first.getUTCDay()+7)%7+7*(n-1),12)));};
const observed=date=>dayDate(date).getUTCDay()===6?shift(date,-1):dayDate(date).getUTCDay()===0?shift(date,1):date;
function easter(year){const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;return dayString(new Date(Date.UTC(year,month-1,day,12)));}
export function isUSSession(date){
 const year=Number(date.slice(0,4));if([0,6].includes(dayDate(date).getUTCDay()))return false;
 // NYSE 常规全年休市规则；突发休市或源缺目标日时不使用更早日期顶替。
 const newYear=`${year}-01-01`,holidays=new Set([dayDate(newYear).getUTCDay()===0?shift(newYear,1):newYear,nthWeekday(year,1,1,3),nthWeekday(year,2,1,3),shift(easter(year),-2),nthWeekday(year,9,1,1),nthWeekday(year,11,4,4),observed(`${year}-07-04`),observed(`${year}-12-25`)]);
 if(year>=2022)holidays.add(observed(`${year}-06-19`));
 const lastMay=new Date(Date.UTC(year,5,0,12));holidays.add(shift(dayString(lastMay),-(lastMay.getUTCDay()-1+7)%7));
 return !holidays.has(date);
}
export function previousUSSession(aShareDate){let date=shift(aShareDate,-1);while(!isUSSession(date))date=shift(date,-1);return date;}
const nyParts=now=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
export function overnightReady(date,now=new Date()){
 const target=previousUSSession(date),p=nyParts(now),nyDate=`${p.year}-${p.month}-${p.day}`;
 // 源日K不提供逐条完成标记。当前美东日期需过常规收盘一小时才读取其收盘字段。
 return nyDate>target||nyDate===target&&Number(p.hour)>=17;
}
const finite=n=>n!==null&&n!==''&&Number.isFinite(Number(n));
export function parseOvernight(response,spec,aShareDate,collectedAt){
 const [id,symbol,name,code]=spec,target=previousUSSession(aShareDate),rows=response.data?.[symbol]?.day;
 if(response.code!==0||!Array.isArray(rows))throw Error(`${name}日 K 结构变化`);
 const dates=rows.map(r=>r[0]);if(new Set(dates).size!==dates.length||dates.some((date,i)=>i>0&&date<dates[i-1]))throw Error(`${name}日 K 日期重复或乱序`);
 const index=rows.findIndex(r=>r[0]===target),row=rows[index],previous=rows[index-1];
 if(!row||!previous||previous[0]!==previousUSSession(target))throw Error(`${name}缺少目标交易日 ${target} 或前一交易日，等待原源补齐`);
 if(![row[1],row[2],row[3],row[4],previous[2]].every(v=>finite(v)&&Number(v)>0)||Number(row[2])>Number(row[3])||Number(row[2])<Number(row[4]))throw Error(`${name}日 K 收盘字段无效`);
 const value=Number(row[2]),previousClose=Number(previous[2]);
 return {id,name,code,category:'全球',group:'美股',rawValue:value,value:value.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),change:+((value/previousClose-1)*100).toFixed(2),previousClose,quoteDate:target,tradeDate:target,exchangeQuoteDate:target,exchangeTimezone:'America/New_York',frequency:'daily-close',overnight:true,status:'overnight-close',asOf:null,time:target.slice(5)+' 收盘 · 日K',collectedAt,source:'腾讯财经日 K',sourceUrl:'https://gu.qq.com/'+symbol,trend:[],confirmation:'来源已完成交易日日K收盘字段；并非交易所实时直连'};
}
export async function collectOvernight(dates,{directory=DATA_DIR,now=new Date(),request=marketJSON}={}){
 const pending=[];
 for(const date of dates){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||[0,6].includes(dayDate(date).getUTCDay())||date>chinaDate(now)||!overnightReady(date,now))continue;
  const existing=await jsonFile(path.join(directory,'overnight',date+'.json'));
  if(!existing?.lockedAt)pending.push(date);
 }
 if(!pending.length)return [];
 const responses=await Promise.allSettled(specs.map(async spec=>request('https://web.ifzq.gtimg.cn/appstock/app/usfqkline/get?param='+spec[1]+',day,,,60,qfq'))),saved=[],errors=[];
 for(const date of pending){
  const file=path.join(directory,'overnight',date+'.json');
  // 已锁定的隔夜数据永不被当晚盘中价或之后的源修订覆盖。
  if((await jsonFile(file))?.lockedAt)continue;
  try{
  const collectedAt=now.toISOString(),markets=specs.map((spec,i)=>{if(responses[i].status==='rejected')throw responses[i].reason;return parseOvernight(responses[i].value,spec,date,collectedAt);});
  const value={version:1,aShareDate:date,usTradeDate:previousUSSession(date),policy:'previous-us-session-close',lockedAt:collectedAt,markets,calendarSource:'https://www.nyse.com/markets/hours-calendars'};
  await atomic(file,value);saved.push(value);
  }catch(error){errors.push(`${date}: ${error.message}`);await atomic(file,{version:1,aShareDate:date,usTradeDate:previousUSSession(date),status:'error',lastAttemptAt:now.toISOString(),message:error.message});}
 }
 if(errors.length)throw Error('隔夜收盘采集：'+errors.join('；'));
 return saved;
}
export async function dailyMarketSnapshot(snapshot,{directory=DATA_DIR}={}){
 if(!snapshot||snapshot.demo)return snapshot;
 const date=snapshot.date,target=previousUSSession(date),saved=await jsonFile(path.join(directory,'overnight',date+'.json'));
 if(!(snapshot.markets||[]).some(m=>usIds.has(m.id))&&!saved)return snapshot;
 const locked=saved?.lockedAt&&saved.usTradeDate===target&&saved.markets?.length===3;
 const usMarkets=locked?saved.markets:specs.map(([id,symbol,name,code])=>({id,name,code,category:'全球',group:'美股',value:'—',rawValue:null,change:null,asOf:null,quoteDate:target,expectedTradeDate:target,overnight:true,status:'unavailable',frequency:'daily-close',time:'隔夜收盘待确认',source:'腾讯财经日 K',sourceUrl:'https://gu.qq.com/'+symbol,trend:[]}));
 const byId=new Map(usMarkets.map(m=>[m.id,m])),markets=(snapshot.markets||[]).map(m=>usIds.has(m.id)?byId.get(m.id):m);
 for(const market of usMarkets)if(!markets.some(m=>m.id===market.id))markets.push(market);
 return {...snapshot,markets,overnight:{policy:'previous-us-session-close',aShareDate:date,usTradeDate:target,status:locked?'locked':saved?.status==='error'?'error':'waiting',lockedAt:locked?saved.lockedAt:null},sources:[...(snapshot.sources||[]).filter(s=>s.id!=='overnight'),{id:'overnight',name:'腾讯财经 · 隔夜日 K 收盘',status:locked?'ok':saved?.status==='error'?'error':'waiting',lastSuccessAt:locked?saved.lockedAt:null,...(saved?.message?{message:saved.message}:{})}]};
}
export function mergeOvernightOverview(existing,next){
 if(!existing)return next;if(!next?.overnight||JSON.stringify(existing.overnight)===JSON.stringify(next.overnight))return existing;
 return {...existing,overnight:next.overnight,scope:next.scope,markets:[...existing.markets.filter(m=>!usIds.has(m.id)),...next.markets.filter(m=>usIds.has(m.id))],sources:[...(existing.sources||[]).filter(s=>s.id!=='overnight'),...(next.sources||[]).filter(s=>s.id==='overnight')]};
}
