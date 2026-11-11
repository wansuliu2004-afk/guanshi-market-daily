export const DAY_END_GRACE_MS=15*60_000;
export function dayCutoff(date){return new Date(Date.parse(date+'T00:00:00+08:00')+86400000).toISOString();}
export const pastDayReady=(date,now=new Date())=>now.getTime()>=Date.parse(dayCutoff(date))+DAY_END_GRACE_MS;
export async function completePreviousDay(archive,collector,now=new Date()){
 const date=new Date(Date.parse(archive.today()+'T12:00:00Z')-86400000).toISOString().slice(0,10);
 if(!pastDayReady(date,now)||date<archive.site.startedDate)return null;
 // 来源全部失败时不将旧缓存当成成功的午夜补采，留到下一轮自动重试。
 const statuses=collector.status||[];
 if(!statuses.some(s=>['ok','empty'].includes(s.status)&&Date.parse(s.lastSuccessAt)>=Date.parse(dayCutoff(date))))return null;
 return archive.completeDayEnd(date,{news:await collector.payload(date)});
}
