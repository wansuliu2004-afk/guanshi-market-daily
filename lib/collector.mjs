import {readFile,writeFile,mkdir,rename,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const DATA_DIR=process.env.DATA_DIR?path.resolve(process.env.DATA_DIR):path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../data');
export const INTERVAL_MS=300_000;
export const chinaDate=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const iso=()=>new Date().toISOString();
export const NEWS_SOURCES=[
 {id:'cls',name:'财联社',home:'https://www.cls.cn/telegraph',kind:'快讯'},
 {id:'eastmoney',name:'东方财富',home:'https://kuaixun.eastmoney.com/',kind:'快讯'},
 {id:'wallstreet',name:'华尔街见闻',home:'https://wallstreetcn.com/live/global',kind:'快讯'},
 {id:'cctv',name:'央视新闻联播',home:'https://tv.cctv.com/lm/xwlb/',kind:'权威发布'}
];
const ALLOWED_HOSTS=['cls.cn','eastmoney.com','wallstreetcn.com','cctv.com'];
export function safeSourceURL(value){try{const u=new URL(value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||!ALLOWED_HOSTS.some(h=>u.hostname===h||u.hostname.endsWith('.'+h)))return null;u.hash='';return u.href;}catch{return null;}}
export const plainTitle=s=>String(s||'').replace(/<[^>]*>/g,'').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim().slice(0,220);
const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,20);
const validNumber=v=>Number.isFinite(Number(v))?Number(v):0;
export const isFinanceTitle=title=>/(财经|金融|经济|市场|股|债|汇|银行|保险|基金|证券|交易|投资|融资|财政|央行|货币|利率|降息|加息|通胀|贸易|关税|出口|进口|消费|购物|免税|产业|工业|制造|生产|工厂|企业|公司|业绩|利润|营收|订单|并购|收购|上市|减持|增持|回购|评级|目标价|资本|监管|证监|发改委|统计局|国资|税|零售|房|能源|原油|石油|油价|天然气|煤|钢|铜|金价|黄金|贵金属|有色|锂|半导体|芯片|算力|人工智能|科技|电商|汽车|新能|光伏|电池|电力|药|医疗|生物|农业|粮|乳粉|进博|GDP|CPI|PMI|AI|ETF|IPO)/i.test(title);
async function jsonFile(file,fallback=null){try{return JSON.parse(await readFile(file,'utf8'));}catch{return fallback;}}
async function atomic(file,data){await mkdir(path.dirname(file),{recursive:true});const temp=file+'.tmp';await writeFile(temp,JSON.stringify(data,null,2));await rename(temp,file);}
export async function publicText(url,{encoding='utf-8',referer,timeout=12_000}={}){
 const response=await fetch(url,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json,text/html,*/*',Referer:referer||new URL(url).origin+'/'},signal:AbortSignal.timeout(timeout)});
 if(!response.ok)throw Error(`HTTP ${response.status}`);
 return new TextDecoder(encoding).decode(await response.arrayBuffer());
}
async function requestJSON(url,options){const text=await publicText(url,options);return JSON.parse(text);}

// 数据商响应可带正文，适配器只投影允许的元数据；原始响应不写磁盘、不转发浏览器。
function record(sourceId,{title,url,publishedAt,attention=0,emphasis=0}){
 const source=NEWS_SOURCES.find(s=>s.id===sourceId),clean=plainTitle(title),link=safeSourceURL(url),stamp=new Date(publishedAt);
 if(!clean||clean.length<5||!link||Number.isNaN(stamp.getTime()))return null;
 return {id:`${sourceId}-${hash(link)}`,title:clean,source:source.name,sourceId,sourceUrl:link,publishedAt:stamp.toISOString(),date:chinaDate(stamp),observedAt:iso(),attention:Math.max(0,validNumber(attention)),emphasis:Math.max(0,Math.min(1,validNumber(emphasis)))};
}
async function collectCLS(){
 const d=await requestJSON('https://www.cls.cn/api/cache?name=telegraph&rn=50',{referer:'https://www.cls.cn/telegraph'});
 if(Number(d.errno)!==0||!Array.isArray(d.data?.roll_data))throw Error('公开列表结构变化');
 return d.data.roll_data.filter(n=>n.title).map(n=>record('cls',{title:n.title,url:`https://www.cls.cn/detail/${n.id}`,publishedAt:Number(n.ctime)*1000,attention:validNumber(n.reading_num)+validNumber(n.share_num)*20+validNumber(n.comment_num)*5,emphasis:n.level==='A'?1:n.level==='B'?.65:0})).filter(Boolean);
}
async function collectEastmoney(){
 const text=await publicText('https://newsapi.eastmoney.com/kuaixun/v1/getlist_102_ajaxResult_100_1_.html');
 // JSONP 仅提取 JSON，不执行远程脚本。
 const d=JSON.parse(text.replace(/^\s*var\s+ajaxResult\s*=\s*/,'').replace(/;\s*$/,''));
 if(!Array.isArray(d.LivesList))throw Error('公开列表结构变化');
 return d.LivesList.map(n=>record('eastmoney',{title:n.title,url:n.url_w||n.url_unique,publishedAt:String(n.showtime).replace(' ','T')+'+08:00',attention:n.commentnum,emphasis:String(n.titlestyle)==='1'?1:0})).filter(Boolean);
}
async function collectWallstreet(){
 const d=await requestJSON('https://api-one.wallstcn.com/apiv1/content/lives?channel=global-channel&client=pc&limit=100&first_page=true&accept=live,vip-live');
 if(d.code!==20000||!Array.isArray(d.data?.items))throw Error('公开列表结构变化');
 return d.data.items.filter(n=>!n.is_priced&&(n.title||n.article?.title)).map(n=>record('wallstreet',{title:n.title||n.article?.title,url:n.title?n.uri:n.article?.uri,publishedAt:Number(n.display_time)*1000,attention:n.comment_count,emphasis:Number(n.score)>=2?.65:0})).filter(Boolean);
}
async function collectCCTV(){
 const html=await publicText('https://tv.cctv.com/lm/xwlb/');
 const list=html.match(/<ul[^>]*id="content"[^>]*>([\s\S]*?)<\/ul>/)?.[1];
 if(!list)throw Error('公开列表结构变化');
 const seen=new Set(),out=[];
 for(const m of list.matchAll(/<a[^>]*href="(https:\/\/tv\.cctv\.com\/(\d{4})\/(\d{2})\/(\d{2})\/[^"<>]+)"[^>]*>([\s\S]*?)<\/a>/g)){
  const title=plainTitle(m[5]).replace(/^\[视频\]/,'');if(!title||seen.has(m[1])||!/(经济|金融|贸易|进博|产业|投资|消费|企业|财政|货币|收购|出口|进口|油|科技|制造|数据)/.test(title))continue;
  seen.add(m[1]);const r=record('cctv',{title,url:m[1],publishedAt:`${m[2]}-${m[3]}-${m[4]}T19:00:00+08:00`});if(r)out.push(r);
 }return out;
}
const adapters={cls:collectCLS,eastmoney:collectEastmoney,wallstreet:collectWallstreet,cctv:collectCCTV};
const normalized=s=>s.toLowerCase().replace(/^(?:财联社|央视新闻|东方财富|华尔街见闻)[：:]/,'').replace(/[^\p{L}\p{N}]/gu,'');
const bigrams=s=>new Set(Array.from({length:Math.max(0,s.length-1)},(_,i)=>s.slice(i,i+2)));
function similar(a,b){
 if(a===b)return true;if(Math.min(a.length,b.length)<12||Math.min(a.length,b.length)/Math.max(a.length,b.length)<.72)return false;
 const x=bigrams(a),y=bigrams(b);let common=0;for(const v of x)if(y.has(v))common++;
 return 2*common/(x.size+y.size)>=.84;
}
export function classify(title){
 const sectors=[['半导体',/半导体|芯片|晶圆|集成电路/],['人工智能',/人工智能|算力|英伟达|大模型|\bAI\b/i],['新能源',/新能源|光伏|锂电|储能|风电/],['有色金属',/铜|黄金|有色|铝|稀土/],['消费电子',/消费电子|苹果|手机/],['银行',/银行|利率|货币|降息/],['医药生物',/医药|药品|医疗|生物|制药/],['房地产',/地产|房地产|住房|房贷/],['食品饮料',/食品|饮料|乳粉|白酒|消费/],['传媒',/传媒|电影|游戏|出版/]];
 return {category:/国务院|央行|证监|监管|财政部|政策|征求意见|发改委/.test(title)?'政策':/GDP|CPI|PMI|经济|通胀|利率|国债|财政|货币/.test(title)?'宏观':/美股|欧洲|日本|美国|韩国|港股|恒生|美联储|全球|海外/.test(title)?'海外':/公司|股东|业绩|股份|公告|增持|减持/.test(title)?'公司':'行业',sectors:sectors.filter(([,re])=>re.test(title)).map(([name])=>name)};
}
export const RANKING={name:'平台热度',description:'平台综合排序，非全网真实阅读量。先筛选财经相关标题，再跨来源近似去重；按跨站覆盖 35%、源内互动分位 30%、时效 25%、来源重点标记 10%计算。没有互动数据时该项计 0；排序只基于已采集到的候选。',weights:{coverage:35,engagement:30,recency:25,emphasis:10}};
export const DAILY_RANKING={name:'全日重要度',description:'从所选北京时间日期内全部已采集的财经标题筛选前 20：跨站覆盖 35%、源内互动分位 25%、来源重点标记 25%、宏观政策及行业影响关键词 15%。不做时效衰减，早间重要消息与晚间消息使用相同口径；跨站近似去重后保留出处。算法筛选并非人工定论，也不代表全网完整覆盖。缺少的互动信号计 0。',weights:{coverage:35,engagement:25,emphasis:25,impact:15,recency:0}};
const impactScore=title=>/央行|降准|降息|加息|国务院|货币政策|财政政策|证监会|美联储|GDP|CPI|PMI|非农|关税/i.test(title)?1:/财政部|发改委|统计局|监管|国债|经济|利率|贸易|出口|进口|并购|产业政策/.test(title)?.8:/半导体|芯片|人工智能|算力|新能源|黄金|原油|房地产|银行|金融|行业/.test(title)?.5:.2;
export function rankNews(records,at=Date.now(),{profile='live'}={}){
 const daily=profile==='daily';
 const groups=[];
 const relevant=records.filter(r=>isFinanceTitle(r.title));
 for(const r of relevant){const key=normalized(r.title);let g=groups.find(g=>g.url===r.sourceUrl||similar(g.key,key));if(!g){g={key,url:r.sourceUrl,items:[]};groups.push(g);}g.items.push(r);}
 const sourceAttention=new Map();for(const r of relevant){if(!sourceAttention.has(r.sourceId))sourceAttention.set(r.sourceId,[]);sourceAttention.get(r.sourceId).push(r.attention);}
 const ranked=groups.map(g=>{
  const sorted=[...g.items].sort((a,b)=>(b.emphasis-a.emphasis)||Date.parse(b.publishedAt)-Date.parse(a.publishedAt)),lead=sorted[0];
  const refs=[...new Map(sorted.map(r=>[r.sourceId,{name:r.source,url:r.sourceUrl}])).values()];
  const coverage=Math.min(1,(refs.length-1)/2),engagement=Math.max(...g.items.map(r=>r.attention>0?sourceAttention.get(r.sourceId).filter(n=>n<r.attention).length/sourceAttention.get(r.sourceId).length:0));
  const age=Math.max(0,(at-Math.max(...g.items.map(r=>Date.parse(r.publishedAt))))/3_600_000),recency=Math.exp(-age/12),emphasis=Math.max(...g.items.map(r=>r.emphasis));
  const impact=impactScore(lead.title),score=+(daily?coverage*35+engagement*25+emphasis*25+impact*15:coverage*35+engagement*30+recency*25+emphasis*10).toFixed(1);
  const tags=classify(lead.title),t=new Date(lead.publishedAt);const time=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(t);
  return {id:'topic-'+hash(g.key),title:lead.title,source:lead.source,sourceId:lead.sourceId,sourceUrl:lead.sourceUrl,publishedAt:lead.publishedAt,date:lead.date,time,relatedSources:refs,sourceCount:refs.length,score,signals:{coverage:+(coverage*35).toFixed(1),engagement:+(engagement*(daily?25:30)).toFixed(1),recency:daily?0:+(recency*25).toFixed(1),emphasis:+(emphasis*(daily?25:10)).toFixed(1),...(daily?{impact:+(impact*15).toFixed(1)}:{})},...tags};
 }).sort((a,b)=>b.score-a.score||(daily?Date.parse(a.publishedAt)-Date.parse(b.publishedAt):Date.parse(b.publishedAt)-Date.parse(a.publishedAt)));
 return ranked.slice(0,20).map((r,i)=>({...r,rank:i+1,importance:i<3?'重磅':i<10?'关注':'一般'}));
}

export class Collector{
 constructor(){this.listeners=new Set();this.busy=null;this.timer=null;this.status=[];}
 async init(){await mkdir(path.join(DATA_DIR,'news'),{recursive:true});this.status=await jsonFile(path.join(DATA_DIR,'sources.json'),[]);}
 async dates(){const files=await readdir(path.join(DATA_DIR,'news')).catch(()=>[]);return files.filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n)).map(n=>n.slice(0,-5)).sort();}
 async payload(date=chinaDate()){
  const archive=await jsonFile(path.join(DATA_DIR,'news',`${date}.json`),null);
  return {items:rankNews(archive?.records||[],date===chinaDate()?Date.now():Date.parse(`${date}T23:59:59+08:00`)),asOf:archive?.asOf||null,collectedAt:archive?.asOf||null,latestPublishedAt:archive?.records?.length?new Date(Math.max(...archive.records.map(r=>Date.parse(r.publishedAt)))).toISOString():null,totalCandidates:archive?.records?.length||0,financeCandidates:archive?.records?.filter(r=>isFinanceTitle(r.title)).length||0,sources:date===chinaDate()?this.status:archive?.sources||[],ranking:RANKING,mode:'aggregate',demo:false,date,intervalSeconds:INTERVAL_MS/1000};
 }
 async refresh(){if(this.busy)return this.busy;this.busy=this.run().finally(()=>{this.busy=null});return this.busy;}
 async run(){
  const now=iso();
  const results=await Promise.allSettled(NEWS_SOURCES.map(async source=>({source,items:await adapters[source.id]()})));
  const batches=new Map();let success=false;
  this.status=results.map((result,i)=>{
   const s=NEWS_SOURCES[i],previous=this.status.find(x=>x.id===s.id);
   if(result.status==='rejected')return {...s,status:'error',checkedAt:now,lastSuccessAt:previous?.lastSuccessAt||null,count:0,message:String(result.reason.message).slice(0,120)};
   success=true;const items=result.value.items;for(const r of items){if(!batches.has(r.date))batches.set(r.date,[]);batches.get(r.date).push(r);}
   return {...s,status:items.length?'ok':'empty',checkedAt:now,lastSuccessAt:now,count:items.length,message:items.length?'仅提取标题及原文链接':'暂无带独立标题的可用条目'};
  });
  if(success&&!batches.has(chinaDate()))batches.set(chinaDate(),[]);
  for(const [date,items] of batches){
   const file=path.join(DATA_DIR,'news',date+'.json'),existing=await jsonFile(file,{records:[]});
   const records=new Map(existing.records.map(r=>[r.id,r]));for(const r of items){const old=records.get(r.id);records.set(r.id,{...r,observedAt:old?.observedAt||r.observedAt,attention:Math.max(old?.attention||0,r.attention),emphasis:Math.max(old?.emphasis||0,r.emphasis)});}
   await atomic(file,{date,asOf:now,records:[...records.values()].sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt)),sources:this.status});
  }
  await atomic(path.join(DATA_DIR,'sources.json'),this.status);
  const payload=await this.payload();for(const listener of this.listeners){try{listener(payload)}catch{}}
  return payload;
 }
 start(){this.timer=setInterval(()=>this.refresh().catch(console.error),INTERVAL_MS);this.timer.unref();}
 stop(){clearInterval(this.timer);}
}
export {atomic,jsonFile};
