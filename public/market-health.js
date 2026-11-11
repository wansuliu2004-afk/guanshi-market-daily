const coreIds=new Set(['sh','sz','cy','kc']);
export const marketQuoteSource=market=>market.overnight?'overnight':market.id==='bond'?'bond':['nk','fx'].includes(market.id)?'extra':'quotes';
const hasQuote=market=>market.status!=='unavailable'&&Boolean(market.value)&&market.value!=='—';

// 仅描述当前可见卡片依赖的失败来源；报价与分钟走势分别判断缓存。
export function marketOverviewHealth(snapshot,markets){
 return (snapshot?.sources||[]).filter(source=>source.status==='error').flatMap(source=>{
  const trend=source.id==='trends';
  const affected=markets.filter(m=>trend
   ?coreIds.has(m.id)&&!(m.id==='sh'&&snapshot.sources.some(s=>s.id==='intraday'&&s.status==='ok')&&m.trend?.length>1)
   :marketQuoteSource(m)===source.id);
  if(!affected.length)return [];
  const cached=affected.filter(m=>trend?m.trend?.length>1:hasQuote(m));
  return [{source,kind:trend?'分钟走势':'报价',cached:cached.map(m=>m.name),missing:affected.filter(m=>!cached.includes(m)).map(m=>m.name)}];
 });
}
