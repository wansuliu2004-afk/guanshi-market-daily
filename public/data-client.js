// 同一界面支持本机 API 与云端定时生成的静态 JSON。
const boot=JSON.parse(document.querySelector('#bootstrap').textContent);
export const staticMode=boot.staticMode===true;
export const siteRoot=new URL('./',import.meta.url);
export const todayInChina=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export async function dataFetch(route,options={}){
 if(!staticMode)return fetch(route,{...options,signal:options.signal||AbortSignal.timeout(16000),cache:'no-store'});
 const request=new URL(route,location.origin),date=request.searchParams.get('date')||todayInChina();
 let file;
 if(request.pathname==='/api/dates')file='feed/catalogue.json';
 else if(request.pathname==='/api/runtime')file='feed/runtime.json';
 else if(/^\d{4}-\d{2}-\d{2}$/.test(date)){
  if(request.pathname==='/api/snapshot')file=request.searchParams.get('mode')==='demo'?`demo/daily/${date}/snapshot.json`:date===todayInChina()?'feed/market-live.json':`daily/${date}/snapshot.json`;
  if(request.pathname==='/api/report')file=`daily/${date}/report.json`;
  if(['/api/news','/api/news/refresh'].includes(request.pathname))file=`daily/${date}/news.json`;
 }
 if(!file)throw Error('不支持的静态数据请求');
 const url=new URL(file,siteRoot);url.searchParams.set('_t',String(Date.now()));
 if(file==='feed/market-live.json')url.searchParams.set('date',date);
 const response=await fetch(url,{signal:options.signal||AbortSignal.timeout(16000),cache:'no-store'});
 if(file==='feed/market-live.json'&&response.ok&&(await response.clone().json())?.date!==date)return new Response(JSON.stringify({error:'NO_CURRENT_SNAPSHOT',date}),{status:404,headers:{'Content-Type':'application/json'}});
 if(response.status===404&&request.pathname.startsWith('/api/news'))return new Response(JSON.stringify({date,items:[],asOf:null,sources:[],mode:'aggregate'}),{headers:{'Content-Type':'application/json'}});
 return response;
}
