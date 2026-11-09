// 所有数值、事件与归因均为产品演示样例，不是实际市场记录。
export const DEMO_DATE = '2026-11-09';
export const AVAILABLE_DATES = ['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06',DEMO_DATE];
export const sectors = [
  {name:'半导体',value:1920,change:3.26,flow:42.8,reason:'国产替代预期升温'},
  {name:'人工智能',value:1580,change:2.71,flow:35.6,reason:'算力需求预期改善'},
  {name:'新能源',value:1210,change:1.84,flow:18.2,reason:'产业需求边际回暖'},
  {name:'有色金属',value:980,change:1.32,flow:12.4,reason:'商品价格预期抬升'},
  {name:'消费电子',value:780,change:2.05,flow:16.8,reason:'新品周期催化'},
  {name:'银行',value:1350,change:-0.68,flow:-21.3,reason:'防御资金轮动流出'},
  {name:'医药生物',value:880,change:-1.12,flow:-28.6,reason:'前期涨幅消化'},
  {name:'房地产',value:660,change:-1.57,flow:-16.4,reason:'政策预期分化'},
  {name:'食品饮料',value:620,change:-0.46,flow:-9.8,reason:'增量资金偏向成长'},
  {name:'传媒',value:510,change:0.94,flow:7.5,reason:'内容应用预期升温'}
];
export function makeNews() { return []; }
const baseMarkets = [
 ['sh','上证指数','000001.SH','3,426.18',0.82,'A股','15:00'],
 ['sz','深证成指','399001.SZ','11,087.52',1.36,'A股','15:00'],
 ['cy','创业板指','399006.SZ','2,298.64',1.92,'A股','15:00'],
 ['kc','科创 50','000688.SH','1,042.36',2.48,'A股','15:00'],
 ['hk','恒生指数','HSI','21,326.84',0.64,'全球','15:30'],
 ['sp','标普 500','SPX · 隔夜','5,987.26',0.38,'全球','11-07 05:00'],
 ['nas','纳斯达克','IXIC · 隔夜','19,286.78',0.74,'全球','11-07 05:00'],
 ['nk','日经 225','N225','39,482.15',-0.43,'全球','14:00'],
 ['oil','布伦特原油','USD / 桶','74.82',-0.62,'商品汇率','15:30'],
 ['gold','现货黄金','USD / 盎司','2,684.50',0.28,'商品汇率','15:30'],
 ['copper','LME 铜','USD / 吨','9,456.00',1.12,'商品汇率','15:30'],
 ['fx','美元 / 人民币','USD / CNY','7.1236',-0.08,'商品汇率','15:30'],
 ['bond','中国 10Y 国债','收益率 · %','2.124',-0.014,'商品汇率','15:30']
];
function random(seed) { let x=seed;return ()=>{ x=(x*1664525+1013904223)>>>0;return x/4294967296;}; }
export function getSnapshot(date=DEMO_DATE) {
 if (!AVAILABLE_DATES.includes(date)) return null;
 const index=AVAILABLE_DATES.indexOf(date), rnd=random(52+index);
 const intraday=[]; let p=3398+index*2;
 for(let i=0;i<50;i++) {
   const min=i<25?570+i*5:780+(i-25)*5;
   p+= (rnd()-.42)*4.5+(i===9?9:0)+(i===36?-12:0)+(i===40?13:0);
   intraday.push({time:`${Math.floor(min/60).toString().padStart(2,'0')}:${(min%60).toString().padStart(2,'0')}`,value:+p.toFixed(2),volume:Math.round(25+rnd()*100+(i<4?55:0))});
 }
 const last=intraday.at(-1).value;
 intraday.forEach(d=>{d.value=+(d.value+3426.18-last-(5-index)*6.4).toFixed(2)});
 const candles=[];p=3280;
 for(let i=0;i<32;i++){
   const d=new Date(`${date}T00:00:00Z`);d.setUTCDate(d.getUTCDate()-(31-i));
   if([0,6].includes(d.getUTCDay()))continue;
   const open=p,close=p+(rnd()-.39)*65;
   candles.push({date:d.toISOString().slice(5,10),values:[+open.toFixed(2),+close.toFixed(2),+(Math.min(open,close)-rnd()*22).toFixed(2),+(Math.max(open,close)+rnd()*22).toFixed(2)],volume:Math.round(900+rnd()*1000)});p=close;
 }
 const finalCandle=candles.at(-1), finalPrice=intraday.at(-1).value;
 finalCandle.values[1]=finalPrice;finalCandle.values[2]=Math.min(finalCandle.values[2],finalPrice-8);finalCandle.values[3]=Math.max(finalCandle.values[3],finalPrice+8);
 const daySectors=sectors.map((s,i)=>({...s,change:+(s.change+(5-index)*((i%2?-.13:.11))).toFixed(2),flow:+(s.flow*(.8+index*.04)).toFixed(1)}));
 const overnightDate=new Date(`${date}T12:00:00Z`);if(overnightDate.getUTCDay()===1)overnightDate.setUTCDate(overnightDate.getUTCDate()-2);
 return {
   date,demo:true,timezone:'Asia/Shanghai',version:'1.0',status:'final',asOf:`${date}T15:30:00+08:00`,newsAsOf:`${date}T15:42:08+08:00`,
   markets:baseMarkets.map((m,i)=>({id:m[0],name:m[1],code:m[2],value:i===0?intraday.at(-1).value.toLocaleString('en-US',{minimumFractionDigits:2}):index===5?m[3]:(Number(m[3].replaceAll(',',''))*(1-(5-index)*.002)).toLocaleString('en-US',{minimumFractionDigits:i===11?4:i===12?3:2,maximumFractionDigits:i===11?4:i===12?3:2}),change:+(m[4]-(5-index)*(i%2?.07:.04)).toFixed(3),category:m[5],time:[5,6].includes(i)?`${overnightDate.toISOString().slice(5,10)} 05:00`:m[6],trend:Array.from({length:23},(_,j)=>40+(m[4]>0?j:-j)*1.3+(rnd()-.5)*18)})),
   intraday,candles,sectors:daySectors,news:makeNews(date),
   events:[{time:'10:15',name:'政策预期升温',sector:'半导体',newsIndex:8},{time:'14:00',name:'指数短暂回落',sector:'银行',newsIndex:3},{time:'14:20',name:'科技方向走强',sector:'半导体',newsIndex:2}],
   sentiment:{up:3486-index*17,down:1562+index*14,flat:216,moneyEffect:1.24,percentile:72,limitUp:78,limitDown:6,height:5,brokenRate:21.4},
   recap:{regime:index===1?'震荡整理':'震荡偏强',summary:'科技领跑，量能温和回升',turnover:'1.62',turnoverDelta:'+8.6%',mainline:'科技成长',support:3400,resistance:3450,
     paragraphs:[
       {title:'盘面回顾',brief:'指数震荡上行，科技方向贡献主要涨幅；两市成交 1.62 万亿元，较前一日放量 8.6%。',full:`样例盘面呈现早盘企稳、午后修复的节奏。上证指数上涨 ${(0.82-(5-index)*.04).toFixed(2)}%，创业板指上涨 ${(1.92-(5-index)*.04).toFixed(2)}%，成长风格相对占优。上涨家数明显多于下跌家数，赚钱效应从少数权重扩散至产业链。`},
       {title:'主线归因',brief:'政策预期与产业催化共振，半导体、人工智能成为资金关注方向。',full:'10:15 的政策情境带动先进制造预期升温，午后半导体表现较强，消费电子随之修复。需要留意：消息与价格变化发生在同一时段不等于已证实因果，归因仍需结合原文、成交及资金验证。'},
       {title:'明日观察',brief:'观察 3,400 点支撑与 3,450 点压力，重点跟踪科技主线的量能持续性。',full:'下一交易日先看开盘承接与成交额能否延续，再看半导体内部强度是否扩散。若指数失守 3,400 点或主线出现放量分歧，样例中的偏强判断需要重新评估。海外波动与政策消息偏差也属于观察项，点位仅为演示。'}
     ]},
   sources:[{name:'行情样例',status:'demo',asOf:`${date} 15:30:00`},{name:'新闻样例',status:'demo',asOf:`${date} 15:42:08`},{name:'收盘复盘',status:'final',asOf:`${date} 15:30:00`}]
 };
}
