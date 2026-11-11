const finite=value=>typeof value==='number'&&Number.isFinite(value);
const signed=(value,d=2)=>(value>=0?'+':'−')+Math.abs(value).toFixed(d);
const stamp=value=>value?new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(value)):'时间未知';
const sourceStamp=(snapshot,id)=>{const source=snapshot.sources?.find(s=>s.id===id);return `${source?.status==='error'?'缓存 · ':''}采集 ${stamp(source?.lastSuccessAt||snapshot.collectedAt)} 北京时间`;};
const families=[['电子与通信',/电子|半导体|电路板|通信|元件|光学|光模块/],['能源',/煤炭|石油|油气|燃气/],['医药医疗',/医药|医疗|生物制品|化学制药/],['有色金属',/有色|黄金|贵金属|工业金属|稀土/]];

// 所有陈述均可由当前快照重算，不用新闻共现来推断价格变化的原因。
export function marketObservations(snapshot){
 if(!snapshot||snapshot.demo||snapshot.marketContext?.hasTodayQuote===false)return snapshot?.recap;
 const paragraphs=[],breadth=snapshot.sentiment?.breadth,sh=snapshot.markets?.find(m=>m.id==='sh');
 let regime='样本观察',summary='观察行业强弱与资金是否同向';
 const validBreadth=breadth?.complete&&breadth.date===snapshot.date;
 if(validBreadth&&finite(breadth.temperature)){
  const ratio=breadth.temperature,median=breadth.moneyEffect;
  const divided=finite(sh?.change)&&finite(median)&&sh.change*median<0;
  regime=divided?'指数与个股分化':ratio>=70?'上涨覆盖较广':ratio<=30?'上涨覆盖较窄':'涨跌分布交错';
  summary=divided?'指数方向与个股中位数相反':ratio>=70?'多数有效成交个股上涨':ratio<=30?'上涨个股占有效成交样本不超过三成':'个股表现未形成普遍同向';
  paragraphs.push({title:'市场结构',brief:`${regime}。有效成交样本中上涨占 ${ratio.toFixed(1)}%，${finite(median)?`个股涨跌幅中位数 ${signed(median)}%。`:''}`,full:`${regime}。上涨占比 ${ratio.toFixed(1)}%，${finite(median)?`个股涨跌幅中位数 ${signed(median)}%；`:''}基于 ${breadth.sampleCount} 个有效成交样本，未把停牌或缺报价股票算成平盘。${divided?'这说明指数方向不能代表典型个股的表现。':''}样本采集 ${stamp(breadth.collectedAt)} 北京时间。`,evidence:sourceStamp(snapshot,'breadth')});
 }
 const sectors=(snapshot.sectors||[]).filter(s=>finite(s.change)),leaders=[...sectors].sort((a,b)=>b.change-a.change).slice(0,3);
 if(leaders.length){
  const family=families.map(([name,re])=>({name,count:leaders.filter(s=>re.test(s.name)).length})).find(f=>f.count>=2);
  const description=family?`涨幅居前三的样本中，${family.count} 项名称属于${family.name}方向。`:'涨幅居前的行业样本方向较分散。';
  paragraphs.push({title:'强势方向',brief:description+leaders.map(s=>`${s.name} ${signed(s.change)}%`).join('、')+'。',full:description+`按涨跌幅排序，前三项为 ${leaders.map(s=>`${s.name} ${signed(s.change)}%`).join('、')}。范围为本次已采集的 ${sectors.length} 项行业板块样本；来源可能混含不同层级，名称归类不能视为完整行业排名或因果结论。`,evidence:sourceStamp(snapshot,'sectors')});
  const withFlow=leaders.filter(s=>finite(s.flow)),against=withFlow.filter(s=>s.change>0&&s.flow<0);
  if(withFlow.length)paragraphs.push({title:'资金印证',brief:against.length?`${against.map(s=>s.name).join('、')}上涨，但来源主力资金口径为净流出，价格与资金并不同向。`:`涨幅居前三的样本中，${withFlow.filter(s=>s.flow>0).length}/${withFlow.length} 项主力资金为净流入。`,full:withFlow.map(s=>`${s.name}：涨跌 ${signed(s.change)}%，主力净流入 ${signed(s.flow,1)} 亿元。`).join(' ')+'“主力”沿用数据源分类，不能等同于机构实际交易或资金去向。',evidence:sourceStamp(snapshot,'sectors')});
 }
 const anomalies=[];
 if(validBreadth&&finite(breadth.temperature)&&(breadth.temperature>=80||breadth.temperature<=20))anomalies.push(`上涨占比${breadth.temperature>=80?'达到八成以上':'不超过两成'}，下一交易时段关注覆盖面能否维持或修复`);
 const broken=snapshot.sentiment?.brokenRate;
 if(finite(broken)&&broken>=40)anomalies.push(`炸板率 ${broken.toFixed(1)}%（≥40% 观察阈值），跟踪涨停封板稳定性`);
 if(finite(sh?.change)&&Math.abs(sh.change)>=2)anomalies.push(`指数涨跌超过 ±2%，留意后续波动`);
 paragraphs.push({title:anomalies.length?'风险与跟踪':'后续跟踪',brief:anomalies.length?anomalies.join('；')+'。':leaders.length?'跟踪强势方向是否继续获得净流入，以及个股上涨覆盖面是否扩散。':'继续积累当日有效样本，数据齐备后观察个股覆盖面和板块资金。',full:(anomalies.length?anomalies.join('；')+'。':'后续同时检查行业相对强弱、来源主力净流入方向及个股上涨覆盖面，避免只凭指数判断。')+'以上为规则生成的观察线索，不预测涨跌。未满 20 个可比较的交易日不计算成交额历史分位；新闻与板块共现不作为主线归因。'});
 return {...snapshot.recap,regime,summary,paragraphs,method:'规则观察 v1 · 使用所选日留存样本'};
}
