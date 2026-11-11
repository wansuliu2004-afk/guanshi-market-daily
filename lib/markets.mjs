import path from 'node:path';
import {DATA_DIR,publicText,atomic,jsonFile,chinaDate} from './collector.mjs';
import {withMarketSources} from './market-sources.mjs';
import {collectBreadth,retainBreadth} from './sentiment.mjs';

const quoteSpecs=[['sh','sh000001','上证指数','000001.SH','A股'],['sz','sz399001','深证成指','399001.SZ','A股'],['cy','sz399006','创业板指','399006.SZ','A股'],['kc','sh000688','科创 50','000688.SH','A股'],['hk','hkHSI','恒生指数','HSI · 延迟','全球'],['sp','us.INX','标普 500','SPX · 隔夜','全球'],['nas','us.IXIC','纳斯达克','IXIC · 隔夜','全球'],['hs300','sh000300','沪深 300','000300.SH','A股'],['sz50','sh000016','上证 50','000016.SH','A股'],['zz500','sh000905','中证 500','000905.SH','A股'],['zz1000','sh000852','中证 1000','000852.SH','A股'],['bj50','bj899050','北证 50','899050.BJ','A股'],['hktech','hkHSTECH','恒生科技','HSTECH · 延迟','全球'],['dji','us.DJI','道琼斯','DJI · 隔夜','全球']];
const isFiniteValue=n=>n!==null&&n!==''&&n!=='-'&&Number.isFinite(Number(n));
const num=n=>isFiniteValue(n)?Number(n):null;
const fmt=(n,d=2)=>Number(n).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
const signed=(n,d=2)=>`${n>=0?'+':''}${Number(n).toFixed(d)}`;
const emptyMarket=(id,name,code,category)=>({id,name,code,category,value:'—',change:null,time:'未取得报价',trend:[],status:'unavailable',source:null,asOf:null});
function isoLocal(text,zone='Asia/Shanghai'){
 const p=String(text).replace(/[/:]/g,'-').replace(' ','-').match(/\d+/g);if(!p||p.length<6)return null;
 const n=p.map(Number), utc=Date.UTC(n[0],n[1]-1,n[2],n[3],n[4],n[5]);
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(utc));
 const v=Object.fromEntries(parts.map(p=>[p.type,p.value]));const represented=Date.UTC(+v.year,+v.month-1,+v.day,+v.hour,+v.minute,+v.second);
 return new Date(utc-(represented-utc)).toISOString();
}
const quoteStamp=(raw,id)=>{if(/^\d{14}$/.test(raw))raw=raw.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/,'$1-$2-$3 $4:$5:$6');return isoLocal(raw,['sp','nas','dji'].includes(id)?'America/New_York':'Asia/Shanghai');};
const localTime=stamp=>stamp?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(stamp)):'时间未知';
const json=async url=>JSON.parse(await publicText(url));
const poolURL=(type,date)=>`https://push2ex.eastmoney.com/getTopic${type}Pool?ut=7eea3edcaed734bea9cbfc24409ed989&dpt=wz.ztzt&Pageindex=0&pagesize=100&sort=fbt:asc&date=${date.replaceAll('-','')}`;
async function quotes(){
 const text=await publicText('https://qt.gtimg.cn/q='+[...quoteSpecs.map(s=>s[1]),'hf_OIL','hf_GC','hf_CAD'].join(','),{encoding:'gb18030',referer:'https://gu.qq.com/'});
 const rows=new Map([...text.matchAll(/v_([^=]+)="([^"]*)";/g)].map(m=>[m[1],m[2]]));
 const markets=quoteSpecs.map(([id,symbol,name,code,category])=>{
  const raw=rows.get(symbol);if(!raw)return emptyMarket(id,name,code,category);const f=raw.split('~');if(!isFiniteValue(f[3]))return emptyMarket(id,name,code,category);
  const stamp=quoteStamp(f[30],id);return {id,name,code,category,value:fmt(f[3]),rawValue:Number(f[3]),change:num(f[32]),time:stamp?(chinaDate(new Date(stamp))===chinaDate()?'':chinaDate(new Date(stamp)).slice(5)+' ')+localTime(stamp):'时间未知',asOf:stamp,source:'腾讯财经',status:['hk','hktech'].includes(id)?'delayed':'quoted',trend:[],turnoverYuan:['sh','sz'].includes(id)?num(f[37])*10000:null};
 });
 for(const [id,key,name,code] of [['oil','hf_OIL','布伦特原油','USD / 桶 · 期货'],['gold','hf_GC','纽约黄金','USD / 盎司 · 期货'],['copper','hf_CAD','LME 铜','USD / 吨']]){
  const raw=rows.get(key),f=raw?.split(',');if(!f||!isFiniteValue(f[0])){markets.push(emptyMarket(id,name,code,'商品汇率'));continue;}
  const stamp=isoLocal(`${f[12]} ${f[6]}`);markets.push({id,name,code,category:'商品汇率',value:fmt(f[0]),rawValue:Number(f[0]),change:num(f[1]),time:localTime(stamp),asOf:stamp,source:'腾讯财经',status:'quoted',trend:[]});
 }
 return markets;
}
async function extraQuotes(){
 const d=await json('https://push2.eastmoney.com/api/qt/ulist.np/get?secids=100.N225,133.USDCNH&fltt=2&fields=f12,f14,f2,f3,f4,f124');
 if(!Array.isArray(d.data?.diff))throw Error('跨市场报价暂不可用');
 return d.data.diff.map(r=>{const id=r.f12==='N225'?'nk':'fx',stamp=num(r.f124)?new Date(Number(r.f124)*1000).toISOString():null;return {id,name:id==='nk'?'日经 225':'美元 / 离岸人民币',code:id==='nk'?'N225':'USD / CNH',category:id==='nk'?'全球':'商品汇率',value:isFiniteValue(r.f2)?fmt(r.f2,id==='fx'?4:2):'—',change:num(r.f3),time:localTime(stamp),asOf:stamp,source:'东方财富',status:'quoted',trend:[]};});
}
export function parseBondYield(response,date){
 const rows=response.result?.data?.filter(row=>/^\d{4}-\d{2}-\d{2}/.test(row.SOLAR_DATE)&&row.SOLAR_DATE.slice(0,10)<=date&&isFiniteValue(row.EMM00166466)).sort((a,b)=>b.SOLAR_DATE.localeCompare(a.SOLAR_DATE));
 if(!rows?.length)throw Error('中国10年国债日度收益率暂不可用');
 const value=Number(rows[0].EMM00166466),previous=rows[1],quoteDate=rows[0].SOLAR_DATE.slice(0,10);
 return {id:'bond',name:'中国 10Y 国债',code:'到期收益率 · 日度',category:'商品汇率',value:fmt(value,4)+'%',rawValue:value,change:previous?+(value-Number(previous.EMM00166466)).toFixed(4):null,time:quoteDate.slice(5)+' · 日度',asOf:null,quoteDate,frequency:'daily',source:'东方财富',status:'daily',trend:[]};
}
async function bondYield(date){return parseBondYield(await json('https://datacenter.eastmoney.com/api/data/v1/get?reportName=RPTA_WEB_TREASURYYIELD&columns=ALL&sortColumns=SOLAR_DATE&sortTypes=-1&pageSize=10&pageNumber=1'),date);}
async function miniTrends(){
 const entries=await Promise.allSettled(quoteSpecs.slice(0,4).map(async([id,symbol])=>{
  const d=await json(`https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${symbol}`);
  const values=d.data?.[symbol]?.data?.data;if(!Array.isArray(values))throw Error('分钟线暂不可用');
  return [id,{date:String(d.data[symbol].data.date||'').replace(/^(\d{4})(\d{2})(\d{2})$/,'$1-$2-$3'),points:values.filter((_,i)=>i%8===0).map(v=>Number(v.split(' ')[1])).filter(Number.isFinite)}];
 }));
 const available=entries.filter(r=>r.status==='fulfilled').map(r=>r.value);
 if(!available.some(([,value])=>value.points.length))throw Error('分钟线暂不可用');
 return Object.fromEntries(available);
}
async function intraday(){
 const d=await json('https://push2his.eastmoney.com/api/qt/stock/trends2/get?secid=1.000001&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ndays=1&iscr=0');
 if(!Array.isArray(d.data?.trends))throw Error('分时暂不可用');
 return {asOf:num(d.data.time)?new Date(Number(d.data.time)*1000).toISOString():null,previousClose:num(d.data.preClose),points:d.data.trends.map(s=>{const f=s.split(',');return {date:f[0].slice(0,10),time:f[0].slice(11,16),value:Number(f[2]),volume:+(Number(f[6])/1e8).toFixed(2)};})};
}
async function candles(date){
 const d=await json(`https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.000001&klt=101&fqt=0&lmt=40&end=${date.replaceAll('-','')}&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61`);
 if(!Array.isArray(d.data?.klines))throw Error('日 K 暂不可用');
 return d.data.klines.map(s=>{const f=s.split(',');return {date:f[0].slice(5),tradeDate:f[0],values:[Number(f[1]),Number(f[2]),Number(f[4]),Number(f[3])],volume:+(Number(f[6])/1e8).toFixed(2)};});
}
async function boards(){
 const d=await json('https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=100&po=1&np=1&fltt=2&invt=2&fid=f6&fs=m:90+t:2&fields=f12,f14,f2,f3,f6,f62,f124');
 if(!Array.isArray(d.data?.diff))throw Error('板块数据暂不可用');
 // 只展示接口按成交额返回的行业板块样本，不冒充全部行业统计。
 return d.data.diff.filter(s=>num(s.f6)>0&&num(s.f3)!==null&&!/[ⅡⅢ]$/.test(s.f14)).map(s=>({id:s.f12,name:s.f14,value:+(Number(s.f6)/1e8).toFixed(2),change:Number(s.f3),flow:num(s.f62)===null?null:+(Number(s.f62)/1e8).toFixed(2),source:'东方财富',asOf:num(s.f124)?new Date(Number(s.f124)*1000).toISOString():null}));
}
async function limitPool(type,date){const d=await json(poolURL(type,date));if(!d.data||String(d.data.qdate)!==date.replaceAll('-',''))throw Error('当日涨跌停数据暂无');return {total:d.data.tc,pool:d.data.pool||[]};}
export class MarketCollector{
 constructor(){this.busy=null;this.timer=null;this.latest=null;}
 async init(){this.latest=await jsonFile(path.join(DATA_DIR,'market-latest.json'));}
 async dates(){const data=await jsonFile(path.join(DATA_DIR,'market-dates.json'),[]);return data;}
 async get(date=chinaDate()){if(this.latest?.date===date)return withMarketSources(this.latest);return withMarketSources(await jsonFile(path.join(DATA_DIR,'markets',date+'.json')));}
 async refresh(){if(this.busy)return this.busy;this.busy=this.run().finally(()=>{this.busy=null});return this.busy;}
 async run(){
  const today=chinaDate(),now=new Date().toISOString(),previous=this.latest?.date===today?this.latest:null;
  const beforeOpen=localTime(now)<'09:30:00';
  const tasks=[['quotes','腾讯财经',quotes],['trends','腾讯财经分钟线',miniTrends],['extra','东方财富跨市场',extraQuotes],['intraday','东方财富分时',intraday],['candles','东方财富日 K',()=>candles(today)],['sectors','东方财富板块',boards],['up','东方财富涨停池',()=>limitPool('ZT',today)],['down','东方财富跌停池',()=>limitPool('DT',today)],['broken','东方财富炸板池',()=>limitPool('ZB',today)],['bond','东方财富国债收益率',()=>bondYield(today)],['breadth','东方财富全 A 股情绪',async()=>retainBreadth(await collectBreadth({date:today}))]];
  const results=await Promise.allSettled(tasks.map(t=>beforeOpen&&['up','down','broken','breadth'].includes(t[0])?Promise.resolve({pending:true}):t[2]())),values={},statuses=[];
  results.forEach((r,i)=>{const [id,name]=tasks[i];if(r.status==='fulfilled'&&r.value?.pending){statuses.push({id,name,status:'waiting',lastSuccessAt:null,message:'开盘前等待当日数据'});}else if(r.status==='fulfilled'){values[id]=r.value;statuses.push({id,name,status:'ok',lastSuccessAt:now});}else{statuses.push({id,name,status:'error',lastSuccessAt:previous?.sources?.find(s=>s.id===id)?.lastSuccessAt||null,message:r.reason.message});}});
  const markets=values.quotes||previous?.markets?.filter(m=>m.source==='腾讯财经')||quoteSpecs.map(([id,,name,code,category])=>emptyMarket(id,name,code,category));
  markets.push(...(values.extra||previous?.markets?.filter(m=>['nk','fx'].includes(m.id))||[emptyMarket('nk','日经 225','N225','全球'),emptyMarket('fx','美元 / 离岸人民币','USD / CNH','商品汇率')]));
  markets.push(values.bond||previous?.markets?.find(m=>m.id==='bond')||emptyMarket('bond','中国 10Y 国债','到期收益率 · 日度','商品汇率'));
  const points=values.intraday?.points||previous?.intraday||[],priceDate=points.at(-1)?.date||today;
  const sh=markets.find(m=>m.id==='sh'),sz=markets.find(m=>m.id==='sz');
  for(const m of markets)if(values.trends?.[m.id]?.date===today)m.trend=values.trends[m.id].points;
  if(sh&&points.length){sh.trend=points.filter((_,i)=>i%8===0).map(p=>p.value);}
  const tradeTime=sh?.asOf&&chinaDate(new Date(sh.asOf))===today?localTime(sh.asOf):null;
  const status=tradeTime&&tradeTime>='15:00:00'?'close-observed':'intraday';
  const topBoards=values.sectors||previous?.sectors||[],actual=points.filter(p=>p.date===today);
  const turnover=sh?.turnoverYuan&&sz?.turnoverYuan?((sh.turnoverYuan+sz.turnoverYuan)/1e12).toFixed(2):null;
  const limitUp=values.up?.total??previous?.sentiment?.limitUp??null,broken=values.broken?.total??null;
  const themes=values.up?Object.entries(values.up.pool.reduce((o,s)=>{o[s.hybk||'其他']=(o[s.hybk||'其他']||0)+1;return o},{})).sort((a,b)=>b[1]-a[1]).map(([name,count])=>({name,count})):previous?.limitThemes||[];
  const leaders=[...topBoards].sort((a,b)=>b.change-a.change).slice(0,3);
  const recap={regime:'事实快照',summary:status==='intraday'?'盘中数据已接入，收盘复盘待定稿':'收盘报价已取得，复盘待确认',turnover:turnover||'—',turnoverDelta:'',mainline:null,support:null,resistance:null,paragraphs:[
    {title:'盘面事实',brief:sh?.change!==null?`上证指数 ${sh?.value}，涨跌幅 ${signed(sh.change)}%。${turnover?`沪深指数口径成交额合计约 ${turnover} 万亿元。`:''}报价时间 ${sh?.asOf?chinaDate(new Date(sh.asOf))+' '+localTime(sh.asOf):'未知'} 北京时间。`:'行情源暂不可用，等待下一次采集。',full:''},
    {title:'板块观察',brief:leaders.length?`已采集的行业板块样本中，${leaders.map(s=>`${s.name} ${signed(s.change)}%`).join('、')}。数据来自东方财富，不作为因果结论。`:'板块源暂不可用，保留上次成功数据。',full:''},
    {title:'明日观察',brief:'等待收盘数据完整并确认复盘后发布。关键位、情绪历史分位和主线归因暂不生成。',full:''}
  ]};recap.paragraphs.forEach(p=>p.full=p.brief);
  const breadth=values.breadth||previous?.sentiment?.breadth||null;
  const snapshot={date:today,demo:false,status,version:'live',asOf:sh?.asOf||previous?.asOf||null,collectedAt:now,timezone:'Asia/Shanghai',markets,intraday:actual.length?actual:[],candles:values.candles||previous?.candles||[],sectors:topBoards,events:[],news:[],sources:statuses,limitThemes:themes,sentiment:{up:breadth?.up??null,down:breadth?.down??null,flat:breadth?.flat??null,moneyEffect:breadth?.moneyEffect??null,temperature:breadth?.temperature??null,percentile:breadth?.percentile??null,breadth,limitUp,limitDown:values.down?.total??previous?.sentiment?.limitDown??null,height:values.up?.pool.length?Math.max(...values.up.pool.map(s=>Number(s.lbc)||1)):previous?.sentiment?.height??null,brokenRate:limitUp!==null&&broken!==null&&limitUp+broken>0?+(broken/(limitUp+broken)*100).toFixed(1):null},recap};
  this.latest=withMarketSources(snapshot);await atomic(path.join(DATA_DIR,'market-latest.json'),this.latest);await atomic(path.join(DATA_DIR,'markets',today+'.json'),this.latest);
  const dates=new Set(await this.dates());dates.add(today);await atomic(path.join(DATA_DIR,'market-dates.json'),[...dates].sort());return snapshot;
 }
 start(){this.timer=setInterval(()=>this.refresh().catch(console.error),300_000);this.timer.unref();}
 stop(){clearInterval(this.timer);}
}
