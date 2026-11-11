const finite=value=>typeof value==='number'&&Number.isFinite(value);
export const isUSMarket=market=>['sp','nas','dji'].includes(market.id);
const partsAt=(stamp,timeZone)=>Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(stamp)).map(p=>[p.type,p.value]));
export function usQuoteContext(market){
 if(!isUSMarket(market))return null;
 if(market.overnight){const date=market.tradeDate||market.expectedTradeDate||market.quoteDate;return {date,time:null,phase:market.status==='unavailable'?'隔夜收盘待确认':'隔夜收盘',label:`隔夜 · 美东 ${date?.slice(5)||'未知'} ${market.status==='unavailable'?'待确认':'收盘'}`,detail:`按 A 股日期固定绑定此前最近美股交易日 ${date} 的来源日 K 收盘。采集时间 ${market.collectedAt||'尚未成功'}；保存后不再被盘中价覆盖。`};}
 if(!market.asOf||!Number.isFinite(Date.parse(market.asOf)))return {label:'美东日期未知',detail:'没有有效的来源报价时间；不判断交易时段。'};
 const p=partsAt(market.asOf,'America/New_York'),date=`${p.year}-${p.month}-${p.day}`,time=`${p.hour}:${p.minute}:${p.second}`,minute=+p.hour*60+(+p.minute);
 const weekday=new Date(date+'T12:00:00Z').getUTCDay();
 const phase=[0,6].includes(weekday)?'非工作日时段':minute<570?'常规开盘前时段':minute<960?'常规盘中时段':'常规收盘后时段';
 return {date,time,phase,label:`美东 ${date.slice(5)} · ${phase}`,detail:`美东报价日期 ${date} ${time}（America/New_York，自动处理夏令时）。按常规 09:30–16:00 判断时段，不据此确认节假日、提前收盘或官方收盘价。`};
}

const mix=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
export function heatColor(change,{dark=false}={}){
 const neutral=dark?[57,67,78]:[235,238,241],value=finite(change)?change:0;
 const t=Math.max(0,Math.min(1,(Math.abs(value)-.05)/4.95));
 const rgb=mix(neutral,value<0?[0,109,88]:[168,38,53],t),lum=luminance(rgb),ink=[0,0,0];
 const whiteContrast=1.05/(lum+.05),inkContrast=(lum+.05)/(luminance(ink)+.05);
 return {background:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join(''),text:whiteContrast>=inkContrast?'#ffffff':'#000000',contrast:Math.max(whiteContrast,inkContrast)};
}

export function intradayReference(snapshot){
 if(!snapshot)return null;
 const sh=snapshot.markets?.find(m=>m.id==='sh');
 if(finite(snapshot.previousClose)&&snapshot.previousClose>0)return {value:snapshot.previousClose,source:'分时 / 报价来源昨收'};
 if(finite(sh?.previousClose)&&sh.previousClose>0)return {value:sh.previousClose,source:'指数报价来源昨收'};
 const previous=(snapshot.candles||[]).filter(c=>c.tradeDate&&c.tradeDate<snapshot.date&&finite(c.values?.[1])&&c.values[1]>0).sort((a,b)=>a.tradeDate.localeCompare(b.tradeDate)).at(-1);
 return previous?{value:previous.values[1],source:`${previous.tradeDate} 日 K 收盘`}:null;
}
export function intradayExtent(points,reference){
 if(!reference)return {};
 const distance=Math.max(...points.map(p=>Math.abs(p.value/reference.value-1)*100).filter(Number.isFinite),0);
 const span=Math.max(1,Math.ceil((distance+.05)*2)/2);
 return {min:reference.value*(1-span/100),max:reference.value*(1+span/100),interval:reference.value*span/200};
}
