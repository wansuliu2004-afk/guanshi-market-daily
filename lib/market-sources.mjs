import {normalizeMarketSnapshot} from '../public/market-context.js';
export const MARKET_LINKS={
 sh:'https://gu.qq.com/sh000001',sz:'https://gu.qq.com/sz399001',cy:'https://gu.qq.com/sz399006',kc:'https://gu.qq.com/sh000688',
 hk:'https://gu.qq.com/hkHSI',sp:'https://gu.qq.com/us.INX',nas:'https://gu.qq.com/us.IXIC',
 oil:'https://gu.qq.com/hf_OIL',gold:'https://gu.qq.com/hf_GC',copper:'https://gu.qq.com/hf_CAD',
 nk:'https://quote.eastmoney.com/gb/zsN225.html',fx:'https://quote.eastmoney.com/forex/USDCNH.html',
 hs300:'https://gu.qq.com/sh000300',sz50:'https://gu.qq.com/sh000016',zz500:'https://gu.qq.com/sh000905',zz1000:'https://gu.qq.com/sh000852',bj50:'https://gu.qq.com/bj899050',hktech:'https://gu.qq.com/hkHSTECH',dji:'https://gu.qq.com/us.DJI',bond:'https://data.eastmoney.com/cjsj/zmgzsyl.html'
};
export const MODULE_LINKS={price:{name:'东方财富 · 上证指数',url:'https://quote.eastmoney.com/zs000001.html'},sectors:{name:'东方财富 · 行业板块',url:'https://quote.eastmoney.com/center/boardlist.html#industry_board'},flows:{name:'东方财富 · 行业资金',url:'https://data.eastmoney.com/bkzj/hy.html'},limits:{name:'东方财富 · 涨停板池',url:'https://quote.eastmoney.com/ztb/detail#type=ztgc'}};
export function withMarketSources(snapshot){
 if(!snapshot||snapshot.demo)return snapshot;
 snapshot=normalizeMarketSnapshot(snapshot);
 return {...snapshot,sourceLinks:MODULE_LINKS,markets:snapshot.markets.map(m=>({...m,group:marketGroup(m),sourceUrl:MARKET_LINKS[m.id]||null})),sectors:snapshot.sectors.map(s=>({...s,sourceUrl:s.id?`https://quote.eastmoney.com/bk/90.${s.id}.html`:MODULE_LINKS.sectors.url}))};
}
export function marketGroup(m){return m.category==='A股'?'A股':['hk','hktech'].includes(m.id)?'港股':['sp','nas','dji'].includes(m.id)?'美股':m.id==='nk'?'亚太':['oil','gold','copper'].includes(m.id)?'商品':m.id==='fx'?'汇率':m.id==='bond'?'利率':m.category;}
