import {setTimeout as pause} from 'node:timers/promises';
import {publicText} from './collector.mjs';

function temporaryFailure(error){
 const status=Number(/^HTTP (\d{3})$/.exec(error?.message)?.[1]);
 return status===408||status===429||status>=500&&status<=599
  ||['TimeoutError','AbortError'].includes(error?.name)
  ||error instanceof TypeError&&error.message==='fetch failed';
}
// 仅重试临时传输故障；权限拒绝、响应解析与字段变化不靠重试掩盖。
export async function retryMarketRequest(request,{sleep=pause}={}){
 for(let attempt=0;;attempt++){
  try{return await request();}
  catch(error){if(attempt>=2||!temporaryFailure(error))throw error;await sleep([500,1500][attempt]);}
 }
}
export const marketText=(url,options={})=>retryMarketRequest(()=>publicText(url,{timeout:8000,...options}));
export const marketJSON=async url=>JSON.parse(await marketText(url));

// 小接口限制并发，全 A 分页仍由其自身的并发与总时限管理。
export async function settleMarketTasks(tasks,{concurrency=3}={}){
 const results=new Array(tasks.length);let next=0;
 await Promise.all(Array.from({length:Math.min(concurrency,tasks.length)},async()=>{
  while(next<tasks.length){const index=next++;
   try{results[index]={status:'fulfilled',value:await tasks[index]()};}
   catch(reason){results[index]={status:'rejected',reason};}
  }
 }));
 return results;
}
