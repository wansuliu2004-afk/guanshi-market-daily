export const MARKET_LINKS={
 sh:'https://gu.qq.com/sh000001',sz:'https://gu.qq.com/sz399001',cy:'https://gu.qq.com/sz399006',kc:'https://gu.qq.com/sh000688',
 hk:'https://gu.qq.com/hkHSI',sp:'https://gu.qq.com/us.INX',nas:'https://gu.qq.com/us.IXIC',
 oil:'https://gu.qq.com/hf_OIL',gold:'https://gu.qq.com/hf_GC',copper:'https://gu.qq.com/hf_CAD',
 nk:'https://quote.eastmoney.com/gb/zsN225.html',fx:'https://quote.eastmoney.com/forex/USDCNH.html'
};
export const MODULE_LINKS={price:{name:'东方财富 · 上证指数',url:'https://quote.eastmoney.com/zs000001.html'},sectors:{name:'东方财富 · 行业板块',url:'https://quote.eastmoney.com/center/boardlist.html#industry_board'},flows:{name:'东方财富 · 行业资金',url:'https://data.eastmoney.com/bkzj/hy.html'},limits:{name:'东方财富 · 涨停板池',url:'https://quote.eastmoney.com/ztb/detail#type=ztgc'}};
export function withMarketSources(snapshot){
 if(!snapshot||snapshot.demo)return snapshot;
 return {...snapshot,sourceLinks:MODULE_LINKS,markets:snapshot.markets.map(m=>({...m,sourceUrl:MARKET_LINKS[m.id]||null})),sectors:snapshot.sectors.map(s=>({...s,sourceUrl:s.id?`https://quote.eastmoney.com/bk/90.${s.id}.html`:MODULE_LINKS.sectors.url}))};
}
