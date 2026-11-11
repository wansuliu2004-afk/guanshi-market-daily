import {dataFetch,staticMode,siteRoot,todayInChina} from './data-client.js?v=1.7.0';
import {marketContext,normalizeMarketSnapshot,chinaDateOf,isAShare} from './market-context.js?v=1.7.0';
const $=(s,scope=document)=>scope.querySelector(s);
const $$=(s,scope=document)=>[...scope.querySelectorAll(s)];
const icons={
 layout:'<rect x="3" y="3" width="7" height="7" rx="1.3"/><rect x="14" y="3" width="7" height="7" rx="1.3"/><rect x="3" y="14" width="7" height="7" rx="1.3"/><rect x="14" y="14" width="7" height="7" rx="1.3"/>',
 news:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h4v4H7zM15 8h2M15 12h2M7 16h10"/>',
 chart:'<path d="M4 3v17h17M7 14l4-5 4 3 5-7"/>',bookmark:'<path d="M6 4a1 1 0 011-1h10a1 1 0 011 1v17l-6-4-6 4z"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M16 16l5 5"/>',
 moon:'<path d="M20.8 13A9 9 0 1111 3.2 7 7 0 0020.8 13z"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3M12 14v3"/>',
 chevronLeft:'<path d="M15 5l-7 7 7 7"/>',chevronRight:'<path d="M9 5l7 7-7 7"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M7 15h2M13 15h2"/>',
 arrowRight:'<path d="M4 12h16M14 6l6 6-6 6"/>',zap:'<path d="M13 2L4 14h7l-1 8 10-12h-7z"/>',radio:'<circle cx="12" cy="12" r="2"/><path d="M6.3 6.3a8 8 0 000 11.4M17.7 6.3a8 8 0 010 11.4M3.5 3.5a12 12 0 000 17M20.5 3.5a12 12 0 010 17"/>',
 pause:'<path d="M8 5v14M16 5v14"/>',play:'<path d="M7 4l13 8-13 8z"/>',sort:'<path d="M4 6h16M7 12h10M10 18h4"/>',refresh:'<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0113 3M5 15a8 8 0 0013 3"/>',
 checkCircle:'<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>',link:'<path d="M10 13a4 4 0 006 0l4-4a4 4 0 00-6-6l-2 2M14 11a4 4 0 00-6 0l-4 4a4 4 0 006 6l2-2"/>',
 mouse:'<rect x="5" y="2" width="14" height="20" rx="7"/><path d="M12 6v4"/>',grid:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 11h18M12 11v10M9 3v8M17 3v8"/>',
 activity:'<path d="M2 12h5l3-8 4 16 3-8h5"/>',file:'<path d="M14 2H5v20h14V7zM14 2v5h5M8 12h8M8 16h8"/>',download:'<path d="M12 3v12M7 10l5 5 5-5M4 16v5h16v-5"/>',
 eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',external:'<path d="M14 3h7v7M21 3L10 14M10 3H3v18h18v-7"/>',
 close:'<path d="M6 6l12 12M18 6L6 18"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',inbox:'<path d="M4 4h16l2 13v3H2v-3zM2 14h6l2 3h4l2-3h6"/>',cloud:'<path d="M7 18H6a4 4 0 010-8 6 6 0 0111-3 5 5 0 011 11h-1M9 15l6 6M15 15l-6 6"/>'
};
const icon=(name)=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.info}</svg>`;
function hydrateIcons(root=document){$$('[data-icon]',root).forEach(e=>e.outerHTML=icon(e.dataset.icon));}
hydrateIcons();document.documentElement.classList.add('js-ready');
const esc=(x)=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed=(n,d=2)=>n===null||n===undefined||!Number.isFinite(Number(n))?'—':`${n>=0?'+':'−'}${Math.abs(n).toFixed(d)}`;
const changeClass=n=>n>=0?'positive':'negative';
const safeGet=(k,fallback)=>{try{const v=localStorage.getItem(k);return v?JSON.parse(v):fallback}catch{return fallback}};
const safeSet=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch{}};
const boot=JSON.parse($('#bootstrap').textContent);
const demoMode=boot.demoMode===true;
let currentDate=staticMode?todayInChina():boot.currentDate||boot.demoDate;
const params=new URLSearchParams(location.search);
const pathDate=location.pathname.match(/\/daily\/(\d{4}-\d{2}-\d{2})/)?.[1];
const initialDate=params.get('date')||pathDate||currentDate;
let followToday=initialDate===currentDate,pollBusy=false,lastPageSyncAt=null;
const state={snapshot:null,date:initialDate,edition:!demoMode&&(params.get('edition')==='report'||(!params.has('edition')&&initialDate<currentDate))?'report':'live',report:null,news:[],newsMeta:null,category:'全部',market:'全部',query:'',sector:null,important:false,sort:'heat',chartMode:'intraday',reading:'brief',sectorView:'heatmap',selectedNews:null,favoritesOnly:false,favorites:new Set(safeGet('guanshi-saved-v2',[])),view:'overview',paused:false,stale:false,snapshotStale:false,newsAsOf:null};
let catalogue=boot.catalogue||{dates:boot.availableDates,entries:[],startedDate:null},runtime=null;
const safeMarketURL=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&['gu.qq.com','quote.eastmoney.com','data.eastmoney.com'].includes(u.hostname)?u.href:null;}catch{return null;}};
function marketAnchor(url,label,cls='text-button'){const safe=safeMarketURL(url);return safe?'<a class="'+cls+'" href="'+esc(safe)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+icon('external')+'</a>':'';}
let priceChart,sectorChart,stream,loadVersion=0,toastTimer,virtualRows=[],virtualTotal=0,renderScheduled=false;
const scenario=params.get('scenario');
$('.demo-label').textContent=demoMode?'盘面演示':'信息聚合';
$('.disclaimer>p').textContent=demoMode?'盘面为演示样例；新闻为公开来源标题及可用摘要。':'新闻聚合来源标题与独立短摘要；行情来自公开接口，可能存在延迟。';
$('.daily-note strong').textContent='标题回到出处，板块留在视野';
$('.daily-note p').textContent='点击标题打开原文；点击“关联板块”联动盘面。';
$('#newsSort').value='heat';
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2600);}
function formatStamp(value,short=false){if(!value)return '—';const d=new Date(value);return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',...(short?{}:{month:'2-digit',day:'2-digit'}),hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d).replaceAll('/','-');}
function dateName(date){return new Intl.DateTimeFormat('zh-CN',{timeZone:'UTC',weekday:'long'}).format(new Date(`${date}T12:00:00Z`));}
function skeleton(){ $('#newsCanvas').innerHTML=Array.from({length:5},()=>'<div class="skeleton-row"><div><span></span><span></span><span></span></div></div>').join('');$('#chartLoading').classList.remove('hidden');}
function setConnection(label,stale=false){$('#connectionText').textContent=label;$('.status-dot').classList.toggle('stale',stale);}
function updateStamps(){
 $('#newsStamp').textContent=`新闻采集 ${formatStamp(state.newsAsOf)}`;$('#newsFooterTime').textContent=formatStamp(state.newsAsOf,true);
 const s=state.snapshot,context=s?marketContext(s,state.date):null;$('#snapshotStamp').textContent=s?`${s.demo?'演示快照':context.label} · 报价 ${formatStamp(s.asOf)}`:state.edition==='report'?'今日收盘尚未形成':'盘面 · 等待当日数据';
 $('#newsMode').textContent=state.edition==='report'?(state.report?.news?.status==='final'?'全日榜单 · 已定稿':'全日榜单 · 更新中'):state.date===currentDate?(staticMode?'自动聚合 · 定时采集':'5 分钟聚合'):'历史归档';
 $('#dateCaption').textContent=`${dateName(state.date)} · ${s?(s.demo?'演示盘面':context.label):state.edition==='report'?'当日收盘尚未形成':'暂无当日盘面记录'}`;
 $('#datePicker').value=state.date;
 if(!demoMode){$('#datePicker').min=catalogue.startedDate||'';$('#datePicker').max=currentDate;}
 $('#prevDate').disabled=!boot.availableDates.some(d=>d<state.date);$('#nextDate').disabled=!boot.availableDates.some(d=>d>state.date);
 $('#pauseNews').disabled=state.date!==currentDate||state.edition==='report';$('#pauseNews').innerHTML=icon(state.paused?'play':'pause');
 $('#pauseNews').setAttribute('aria-label',state.paused?'恢复页面自动刷新':'暂停页面自动刷新');$('#pauseNews').title=state.paused?'恢复页面自动刷新':'暂停页面自动刷新';
 renderArchiveDates();
 renderEdition();
 renderSyncStatus();
}
function renderEdition(){
 const daily=state.edition==='report',r=state.report;
 $('#marketTabs').classList.remove('hidden');$('#marketTitle').innerHTML='<span class="section-tick"></span>'+(daily?'当日市场概览':'市场速览');
 $('#marketScope').textContent=daily?(r?.close?'A 股核心收盘已锁定；':'A 股收盘记录尚待确认；')+'概览保存各市场当日最后留存报价，含隔夜与日度数据。以卡片日期和来源为准，跨日后固定。':'按市场分类查看最新留存报价；各市场交易时间不同，卡片均标注原报价时间。';
 $$('[data-edition]').forEach(b=>{const selected=b.dataset.edition===state.edition;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));b.disabled=demoMode&&b.dataset.edition==='report';});
 $('#newsTitle').innerHTML=icon(daily?'file':'radio')+(daily?'今日重要财经新闻':'最新新闻热榜')+' <span class="live-badge" id="newsMode">'+(daily?(r?.news?.status==='final'?'全日榜单 · 已定稿':'全日榜单 · 更新中'):state.date===currentDate?(staticMode?'自动聚合 · 定时采集':'5 分钟聚合'):'历史归档')+'</span>';
 $('#newsTitle').nextElementSibling.textContent=daily?'全日已采集候选统一筛选，早间重要消息不因时间衰减':'多站快讯去重聚合，追踪持续变化的新闻热度';
 $('#newsSort option[value="heat"]').textContent=daily?'全日重要度':'平台热度';
 $('.must-section .muted').textContent=daily?'全日重要度前 3 · 点击跳转原文':'平台热度前 3 · 点击跳转原文';
 $('.news-count>span').childNodes[0].textContent=daily?'全日精选 TOP 20 ':'当日 TOP 20 ';
 $('#editionNotice').classList.toggle('is-report',daily);
 if(daily){
  const closed=Boolean(r?.close),final=r?.news?.status==='final';
  $('#editionNotice').innerHTML='<div><span class="edition-state">'+(final?'日报已定稿':r?.status==='closing'?'午夜补采中':'今日日报 · 持续补充')+'</span><strong>'+esc(state.date)+' 每日收盘报</strong><p>'+(closed?'A 股收盘盘面已独立保存。':'今日收盘尚未形成，不展示上一交易日的收盘结论。')+' '+(final?'全日统计截止 '+esc(state.date)+' 24:00（北京时间），榜单已固定。':'新闻覆盖当日 00:00—24:00；跨日后补采截止前标题再定稿。')+(closed?' 盘面实际采集于 '+formatStamp(r.close.dataCollectedAt)+'。':'')+(final?' 新闻最近采集 '+formatStamp(r?.news?.collectedAt||r?.news?.asOf)+'；跨市场报价保留各自实际时间。':'')+'</p></div><div class="edition-metrics"><span><b class="numeric">'+(r?.news?.totalCandidates||0)+'</b> 全日候选</span><span><b class="numeric">'+(r?.news?.items?.length||0)+'</b> 条精选</span><span><b>'+(closed?'已保存':'待形成')+'</b> A 股收盘</span></div>';
 }else $('#editionNotice').innerHTML='<div><span class="edition-state">最新动态</span><p>新闻与报价按计划更新；全日重点和固定的 A 股收盘记录，请切换「每日收盘报」。</p></div>';
 $('.daily-note strong').textContent=daily?'全日重点与收盘事实，分别留存':'标题回到出处，板块留在视野';
 $('.daily-note p').textContent=daily?'全日榜单不做时效衰减；A 股核心收盘盘面锁定，跨市场概览另存。':'点击标题打开原文；点击“关联板块”联动盘面。';
}
function emptyHTML(title,body,button=''){return `<div class="empty-state">${icon('inbox')}<strong>${esc(title)}</strong><p>${esc(body)}</p>${button}</div>`;}
function renderArchiveDates(){
 const dates=demoMode?boot.availableDates:catalogue.dates||[];
 $('#archiveSummary').innerHTML=icon('calendar')+(demoMode?'盘面演示日期':`建站 ${esc(catalogue.startedDate||'—')} · 已保留 ${dates.length} 天记录 · 北京时间`);
 $('#archiveDateList').innerHTML=dates.length?dates.slice().reverse().map(date=>{const day=catalogue.entries?.find(e=>e.date===date);return '<button class="archive-date '+(date===state.date?'selected':'')+'" data-archive-date="'+date+'"><strong class="numeric">'+date+'</strong><span>'+(date===currentDate?'今日 · 自动更新':'已归档')+'</span><small>'+(day?`${day.newsCount} 条榜单标题 · ${day.hasMarket?'含盘面':'暂无盘面'}`:'演示记录')+'</small></button>';}).join(''):'<span class="muted">首次采集成功后出现记录。</span>';
}
async function refreshCatalogue(){
 try{const res=await dataFetch('/api/dates'+(demoMode?'?mode=demo':''));if(!res.ok)throw Error();const d=await res.json();catalogue=d;boot.availableDates=demoMode?boot.availableDates:d.dates;currentDate=staticMode?todayInChina():d.currentDate;renderArchiveDates();updateStamps();}catch{renderArchiveDates();}
}
function renderRuntime(failed=false){
 const button=$('#runtimeStatus'),delayed=publicationDelayed();button.classList.toggle('runtime-offline',failed||delayed);
 const label=failed?(staticMode?'状态暂不可用 · 保留记录':'服务未连接 · 自动采集暂停'):delayed?'更新延迟 · 展示最后记录':runtime?.state==='degraded'?'采集部分异常 · 保留记录':runtime?.state==='collecting'?'正在自动采集':`自动更新 · 每 ${Math.round((runtime?.intervalSeconds||(staticMode?1800:300))/60)} 分钟 · ${staticMode?'云端定时':'本地服务'}`;
 button.innerHTML='<i class="tiny-dot"></i><span>'+label+'</span>'+icon('info');
 button.title=staticMode?`上次完成 ${formatStamp(runtime?.lastCycleAt)}；云端定时采集，不受个人电脑开关影响；任务可能延迟。`:(failed?'请启动本地服务以恢复采集':`上次完成 ${formatStamp(runtime?.lastCycleAt)}；下次 ${formatStamp(runtime?.nextRunAt)}。关闭浏览器不影响，关机或停止服务后暂停。`);
}
function publicationDelayed(){return staticMode&&runtime?.lastCycleAt&&Date.now()-Date.parse(runtime.lastCycleAt)>Math.max(600_000,(runtime.intervalSeconds||300)*2000);}
function renderSyncStatus(){
 const label=$('#autoSyncStatus');if(!label)return;
 label.textContent=state.paused?'自动同步已暂停':publicationDelayed()?'云端更新延迟 · 页面自动重试':state.date<currentDate&&state.report?.status==='final'?'历史定稿 · 自动检查':'每 30 秒自动同步';
 label.classList.toggle('sync-delayed',Boolean(publicationDelayed()));label.title='上次页面同步 '+formatStamp(lastPageSyncAt)+'；上次云端采集 '+formatStamp(runtime?.lastCycleAt)+'。无需手动刷新。';
}
async function refreshRuntime(){try{const r=await dataFetch('/api/runtime',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();runtime=await r.json();if(boot.appVersion&&runtime.appVersion&&boot.appVersion!==runtime.appVersion){location.reload();return;}renderRuntime();renderSyncStatus();}catch{renderRuntime(true);}}
function showRuntime(){dialog('自动更新与历史保存','<span class="regime-tag">无需每天手动更新</span><h2>'+(staticMode?'云端自动采集，电脑关机也能访问。':'服务运行，数据就会继续积累。')+'</h2><p>'+(staticMode?'每 5 分钟计划触发新闻与行情采集，页面每 30 秒自动同步，由 GitHub Actions 执行，GitHub Pages 提供公开网页。个人电脑关机和关闭网页均不影响。':'当前每 5 分钟自动采集一次新闻与行情，关闭网页不影响后台采集。当前运行方式：本机 Node 服务。')+'</p><table class="source-table"><tbody><tr><td>建站日期</td><td>'+esc(catalogue.startedDate||'—')+'（北京时间）</td></tr><tr><td>上次采集完成</td><td>'+formatStamp(runtime?.lastCycleAt)+'</td></tr><tr><td>'+(staticMode?'下次计划（可能延迟）':'下次计划')+'</td><td>'+formatStamp(runtime?.nextRunAt)+'</td></tr><tr><td>历史记录</td><td>'+(catalogue.dates?.length||0)+' 天，'+(staticMode?'保存在云端历史分支':'保存在服务器 data/archive/')+'</td></tr></tbody></table><h3>明天回看今天</h3><p>当天新闻榜单、行情、分时、板块资金和数据时间一起保存。全日统计截止北京时间当日24:00，跨日补采截止前标题后固定；市场价格保留实际报价时间，选回日期即可读取，服务重启也会保留。建站之前的日期不补造数据。</p><h3>'+(staticMode?'免费服务的更新边界':'什么情况下会停')+'</h3><p>'+(staticMode?'定时任务可能排队、延迟或被平台跳过；来源失败时保留最后成功记录。页面超过 10 分钟未取得新批次会显示更新延迟，仍会自动重试。免费服务没有可用性保证，历史记录也可从仓库下载备份。':'电脑关机、休眠、断网或本地服务停止时无法继续抓取；已经保存的历史文件仍在。若要关电脑后也全天自动更新，需要将网站部署到持续在线的服务器，并保留数据目录。')+'</p>');}
async function loadDate(date,{initial=false}={}){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date)))return;
 const version=++loadVersion;stream?.close();state.date=date;state.report=null;state.selectedNews=null;state.sector=null;state.stale=false;state.snapshotStale=false;
 followToday=date===currentDate;
 $('#workspace').classList.remove('hidden');$('#emptyDay').classList.add('hidden');$$('.market-data-status').forEach(note=>note.remove());virtualRows=[];setNewsDegraded(false);skeleton();
 const url=new URL(location.href);url.pathname=siteRoot.pathname;url.searchParams.set('date',date);url.searchParams.set('edition',state.edition);if(demoMode)url.searchParams.set('mode','demo');history.replaceState({},'',url);
 $('#datePicker').value=date;document.title=`${date} 财经日报 · 观市`;
 let snapshot=null,report=null;
 try{
  if(scenario==='offline')throw Error('演示离线');
  if(state.edition==='report'){
   const response=await dataFetch('/api/report?date='+date,{signal:AbortSignal.timeout(16000)});
   if(response.ok){report=await response.json();snapshot=report?.close?.snapshot||null;safeSet('guanshi-report-'+date,report);}
   else if(response.status!==404)throw Error('日报加载失败');
  }
  else if(initial&&!staticMode&&boot.snapshot?.date===date)snapshot=boot.snapshot;
  else{
   const response=await dataFetch(`/api/snapshot?date=${date}${demoMode?'&mode=demo':''}`);if(response.status===404)snapshot=null;else if(!response.ok)throw Error('快照加载失败');else snapshot=await response.json();
  }
  if(snapshot&&state.edition!=='report')safeSet(`guanshi-market-v2-${demoMode?'demo-':''}${date}`,snapshot);
 }catch{if(state.edition==='report'){report=safeGet('guanshi-report-'+date,null);snapshot=report?.close?.snapshot||null;}else snapshot=safeGet(`guanshi-market-v2-${demoMode?'demo-':''}${date}`,null)||(boot.snapshot?.date===date?boot.snapshot:null);state.stale=true;state.snapshotStale=true;}
 if(version!==loadVersion)return;
 snapshot=normalizeMarketSnapshot(snapshot);state.report=report;state.snapshot=snapshot;state.news=[];state.newsMeta=null;state.newsAsOf=null;$('#workspace').classList.toggle('no-market',!snapshot);
 if(!snapshot){
  $('#reviewColumn').classList.add('hidden');renderMarkets();$('#chartLoading').classList.add('hidden');
 }else{$('#reviewColumn').classList.remove('hidden');renderSnapshot();}
 updateStamps();
 if(!demoMode&&catalogue.startedDate&&date<catalogue.startedDate){$('#emptyDay').classList.remove('hidden');$('#emptyDay').innerHTML=emptyHTML('该日期早于建站日',`网站从 ${catalogue.startedDate} 开始保存数据。请选择已有记录的日期。`,`<button class="primary-button" data-archive-date="${esc(catalogue.dates.at(0)||currentDate)}">查看建站日记录</button>`);}
 else if(!demoMode&&!catalogue.dates.includes(date)&&date!==currentDate){$('#emptyDay').classList.remove('hidden');$('#emptyDay').innerHTML=emptyHTML('这一天没有采集记录','服务中断期间无法保存数据；已有记录会持续保留。','<button class="primary-button" data-action="latest">回到今天</button>');}
 if(scenario==='empty')state.news=[];
 renderNews();
 if(state.edition==='report')applyNewsData(report?.news||{items:[],asOf:null,sources:[],date});
 else await refreshNews({silent:true,version});
 if(version!==loadVersion)return;
 renderMustReads();connectStream();
}
function renderMarkets(){
 const overview=state.edition==='report'?(state.report?.marketOverview||state.snapshot):state.snapshot;
 if(!overview){$('#marketQuoteStamp').textContent='';$('#marketSessionNotice').classList.add('hidden');$('#marketStrip').innerHTML=emptyHTML('所选日期暂无行情归档',state.report?.closeMessage||'新闻聚合仍可独立浏览。');return;}
 const context=marketContext(state.snapshot||overview,state.date),notice=$('#marketSessionNotice');
 notice.textContent=state.edition==='report'&&!state.report?.close?'今日收盘尚未形成。A 股今日栏位等待当日数据，上一交易日价格不作为今日收盘。':!context.hasTodayQuote?context.label+'。'+(context.message||''):'';notice.classList.toggle('hidden',!notice.textContent);
 marketDataNotice('marketDataStatus',$('#marketStrip'),['quotes','extra','trends','bond'],overview.markets.some(m=>m.value&&m.value!=='—'),overview);
 const group=m=>m.group||(m.category==='A股'?'A股':['hk','hktech'].includes(m.id)?'港股':['sp','nas','dji'].includes(m.id)?'美股':m.id==='nk'?'亚太':m.id==='fx'?'汇率':m.id==='bond'?'利率':['oil','gold','copper'].includes(m.id)?'商品':m.category);
 const markets=overview.markets.filter(m=>state.market==='全部'||group(m)===state.market);
 $('#marketQuoteStamp').textContent='概览采集 '+formatStamp(overview.collectedAt)+' · 北京时间';
 $('#marketStrip').innerHTML=markets.map(original=>{
  const reference=isAShare(original)&&chinaDateOf(original.asOf)!==state.date;
  const m=state.edition==='report'&&reference?{...original,value:'—',change:null,trend:[],status:'unavailable',quoteLabel:'今日报价尚未形成',time:'等待当日数据'}:original;
  const trend=m.trend||[],min=Math.min(...trend),range=Math.max(...trend)-min||1;
  const points=trend.map((v,i)=>((i/Math.max(1,trend.length-1))*70).toFixed(1)+','+(26-(v-min)/range*23).toFixed(1)).join(' ');
  const unavailable=m.status==='unavailable'||!m.value||m.value==='—',hasChange=Number.isFinite(m.change),color=!unavailable&&hasChange?changeClass(m.change):'muted',link=safeMarketURL(m.sourceUrl);
  const tag=link?'a':'article',linkAttrs=link?' href="'+esc(link)+'" target="_blank" rel="noopener noreferrer" aria-label="查看 '+esc(m.name)+' 来源：'+esc(m.source)+'"':'';
  return '<'+tag+linkAttrs+' class="market-card '+(m.id==='sh'?'selected ':'')+(unavailable?'stale-data':'')+'" title="'+esc(m.name+' · '+(m.source||'待接入')+' · '+(m.asOf||m.time))+'"><div class="market-name">'+esc(m.name)+'<small>'+esc(m.code)+'</small></div><span class="quote-context '+(reference?'reference-quote':'')+'">'+esc(m.quoteLabel||(reference?'上一交易日参考 · '+chinaDateOf(m.asOf):m.frequency==='daily'?'日度数据':'报价日期 '+(chinaDateOf(m.asOf)||'未知')))+'</span><strong class="market-value numeric '+color+'">'+esc(m.value)+'</strong><div class="market-bottom"><span class="market-change numeric '+color+'">'+(unavailable?'等待当日数据':hasChange?signed(m.change,m.id==='bond'?4:2)+(m.id==='bond'?' pp':'%'):'涨跌暂无')+'</span></div>'+(trend.length>1?'<svg class="spark '+color+'" viewBox="0 0 72 30" aria-hidden="true"><polyline points="'+points+'" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>':'<span class="trend-unavailable">'+(m.demo?'演示':m.id==='bond'?'较上期 · 百分点':reference?'待当日走势':'走势待补充')+'</span>')+'<span class="market-origin">'+esc(m.source||'待接入')+(link?' ↗':'')+'</span><span class="market-time numeric">'+esc(unavailable?m.time:m.asOf?formatStamp(m.asOf):m.time)+'</span></'+tag+'>';
 }).join('')||emptyHTML('该分类暂无留存报价','这一天尚未接入该市场，没有使用其他日期的数据补齐。');
}
function renderMustReads(){
 const picked=[...state.news].sort((a,b)=>a.rank-b.rank).slice(0,3);
 $('#mustReads').innerHTML=picked.length?picked.map((n,i)=>'<a class="must-card" href="'+esc(n.sourceUrl)+'" target="_blank" rel="noopener noreferrer"><span class="must-number">0'+(i+1)+'</span><span><span class="must-meta"><span class="must-category">'+esc(n.source)+'</span><span>·</span><span class="numeric">'+n.time+'</span></span><span class="must-title">'+esc(n.title)+'</span>'+(n.summary?'<span class="must-summary">'+esc(n.summary)+'</span>':'')+'<span class="must-detail">'+(state.edition==='report'?'全日重要度 ':'平台热度 ')+esc(n.score)+' · '+n.sourceCount+' 个来源'+icon('external')+'</span></span></a>').join(''):emptyHTML('当日暂无已采集标题','历史归档从服务首次采集后开始积累。');
}
function renderSnapshot(){
 const s=state.snapshot;renderMarkets();
 $('#marketStrip').classList.remove('stale-data');$('#reviewColumn').classList.remove('stale-data');
 const context=marketContext(s,state.date);$('#chartSubtitle').textContent='上证指数 · '+s.date.replaceAll('-','.')+' · '+(s.demo?'演示数据':context.label);
 $('#chartSourceLink').innerHTML=marketAnchor(s.sourceLinks?.price?.url,'图表来源');
 $('#sectorSourceLink').innerHTML=marketAnchor(s.sourceLinks?.[state.sectorView==='flows'?'flows':'sectors']?.url,'数据来源');
 $('#limitSourceLink').innerHTML=marketAnchor(s.sourceLinks?.limits?.url,'来源');
 $('#chartValue').textContent=context.hasTodayQuote||s.demo?s.markets.find(m=>m.id==='sh')?.value||'—':'—';const change=context.hasTodayQuote||s.demo?s.markets.find(m=>m.id==='sh')?.change:null;$('#chartValue').className='numeric '+(Number.isFinite(change)?changeClass(change):'muted');
 $('#chartChange').textContent=signed(change)+(Number.isFinite(change)?'%':'');$('#chartChange').className='numeric '+(Number.isFinite(change)?changeClass(change):'muted');
 $('#chartChange').nextElementSibling.textContent=s.demo?'演示':context.label;
 $('.snapshot-badge').innerHTML=icon(s.status==='daily-close'?'lock':'clock')+(s.demo?'演示':context.label);
 $('#turnover').textContent=s.recap.turnover;$('#turnoverDelta').textContent=s.recap.turnoverDelta||'';
 $('#eventStrip').innerHTML=s.demo?s.events.map((e,i)=>'<button class="event-pill" data-event="'+i+'"><b>'+e.time+'</b><span>'+esc(e.name)+'</span></button>').join(''):'<span class="event-note">标题与板块的关联来自关键词匹配，未验证价格变化的因果关系。</span>';
 const sent=s.sentiment,breadth=sent.breadth,hasBreadth=Number.isFinite(sent.up)&&Number.isFinite(sent.down);
 $('#upCount').textContent=sent.up?.toLocaleString()??'—';$('#downCount').textContent=sent.down?.toLocaleString()??'—';
 $('.breadth-bar').classList.toggle('hidden',!hasBreadth);if(hasBreadth)$('#upBar').style.width=sent.up/Math.max(1,sent.up+sent.down)*100+'%';
 $('#breadthFlat').textContent=Number.isFinite(sent.flat)?'平盘 '+sent.flat.toLocaleString()+' 家':'平盘暂无';
 $('#moneyEffect').innerHTML=Number.isFinite(sent.moneyEffect)?signed(sent.moneyEffect)+'<span>%</span>':'—';$('#moneyEffect').className='metric-value numeric '+(Number.isFinite(sent.moneyEffect)?changeClass(sent.moneyEffect):'muted');
 const temp=sent.temperature??(s.demo&&hasBreadth?+(sent.up/(sent.up+sent.down)*100).toFixed(1):null);
 $('#marketTemperature').innerHTML=Number.isFinite(temp)?temp+'<span> / 100</span>':'—<span> 暂无记录</span>';
 $('#temperatureHistory').textContent=Number.isFinite(sent.percentile)?'近 250 日分位：'+sent.percentile+'%':'近 250 日分位：已积累 '+(breadth?.historyCount||0)+'/250 日';
 $('.mood-tag').textContent=s.demo?'演示情绪':breadth?.complete?'全 A 股样本':'暂无全 A 股记录';
 $('#sentimentSource').innerHTML=breadth?.complete?'<span>'+marketAnchor(breadth.source?.url,'全 A 股来源')+' · 有效 '+breadth.sampleCount.toLocaleString()+' 家 / 候选 '+breadth.totalListed.toLocaleString()+' 家 · 剔除 '+breadth.excludedCount.toLocaleString()+' 家</span><span>采集 '+formatStamp(breadth.collectedAt)+' · 北京时间'+(breadth.isCloseSample?' · 盘后样本':' · 盘中样本')+'</span><span>'+esc(breadth.scope)+'。温度 = 上涨家数 / 有效成交家数 × 100；赚钱效应 = 样本日涨跌幅中位数。采集为分页采样，各股票报价时点可能不同。</span>':'<span>'+(s.demo?'当前为演示样例。':'该日没有保存完整个股样本；涨跌家数、赚钱效应及温度不使用行业样本或其他日期替代。')+'</span>';
 marketDataNotice('sentimentDataStatus',$('#sentimentSource'),['breadth'],Boolean(breadth?.complete));
 $('#limitUp').textContent=sent.limitUp??'—';$('#limitDown').textContent=sent.limitDown??'—';
 const stats=$$('.limit-stats b');stats[2].textContent=sent.height===null?'—':sent.height+' 板';stats[3].textContent=sent.brokenRate===null?'—':sent.brokenRate+'%';
 $('#regimeTag').textContent=s.recap.regime;$('#recapHeadline').textContent=s.recap.summary;renderRecap();
 $('.levels').innerHTML=s.demo?'<span>演示观察</span><span>支撑 <b>3,400</b></span><span>压力 <b>3,450</b></span>':'<span>复盘状态</span><span>事实记录已更新 · 定性结论与关键位待确认</span>';
 requestAnimationFrame(()=>{renderPriceChart();renderSectorChart();});
}
function renderRecap(){if(!state.snapshot)return;$('#recapContent').innerHTML=state.snapshot.recap.paragraphs.map(p=>`<div class="recap-point"><h4>${esc(p.title)}</h4><p>${esc(state.reading==='brief'?p.brief:p.full)}</p></div>`).join('');}
function groupFor(n){return n.time>='15:00'?'盘后 · 收盘跟踪':n.time>='13:00'?'尾盘 · 午后交易':n.time>='11:30'?'午间 · 消息梳理':n.time>='09:30'?'早盘 · 市场交易':'盘前 · 今日前瞻';}
function filteredNews(){
 const q=state.query.trim().toLowerCase();
 return state.news.filter(n=>(state.category==='全部'||n.category===state.category)&&(!state.important||n.rank<=3)&&(!state.sector||n.sectors.includes(state.sector)||n.title.includes(state.sector))&&(!state.favoritesOnly||state.favorites.has(n.id))&&(!q||[n.title,n.source,n.category,...n.sectors].join(' ').toLowerCase().includes(q)))
 .sort((a,b)=>state.sort==='heat'?a.rank-b.rank:state.sort==='asc'?a.publishedAt.localeCompare(b.publishedAt):b.publishedAt.localeCompare(a.publishedAt));
}
function renderFilters(){
 const filters=[];
 if(state.sector)filters.push(`<span class="filter-token">关联板块：${esc(state.sector)}<button data-clear="sector" aria-label="清除板块筛选">×</button></span>`);
 if(state.query)filters.push(`<span class="filter-token">搜索：${esc(state.query)}<button data-clear="query" aria-label="清除搜索">×</button></span>`);
 if(state.favoritesOnly)filters.push('<span class="filter-token">我的收藏<button data-clear="favorites" aria-label="退出收藏">×</button></span>');
 $('#activeFilters').innerHTML=filters.join('');$('#activeFilters').classList.toggle('hidden',!filters.length);
}
function renderNews(reset=true){
 renderFilters();const items=filteredNews();$('#newsCount').textContent=items.length;
 $('#newsFootnote').textContent=state.stale?'部分来源异常 · 保留上次成功记录':'标题与来源摘要 · 点击打开原文';
 $('#rankingStats').textContent='财经候选 '+(state.newsMeta?.financeCandidates||0)+' 条 · 去重后取前 20';
 const canvas=$('#newsCanvas');
 if(!items.length){virtualRows=[];canvas.style.height='auto';canvas.innerHTML=emptyHTML(state.favoritesOnly?'当前条件下没有收藏':'没有匹配的标题',state.news.length?'可清除筛选或尝试其他关键词。':'此日期尚无采集记录，归档从首次采集开始。','<button class="primary-button" data-action="resetFilters">重置筛选</button>');return;}
 virtualRows=[];let top=0,lastGroup=null;
 for(const n of items){const group=state.sort==='heat'?(state.edition==='report'?'全日重要财经新闻 TOP 20':'平台热度 TOP 20'):groupFor(n);if(group!==lastGroup){virtualRows.push({type:'group',group,top,height:38});top+=38;lastGroup=group;}const height=n.summary?232:142;virtualRows.push({type:'news',news:n,top,height});top+=height;}
 virtualTotal=top;canvas.style.height=top+'px';canvas.style.position='relative';
 if(reset)$('#newsViewport').scrollTop=0;renderVirtualRows();
}
function newsHTML(n){
 const saved=state.favorites.has(n.id),related=n.relatedSources||[{name:n.source,url:n.sourceUrl}];
 return '<article class="news-item '+(n.summary?'has-summary ':'')+(state.selectedNews===n.id?'selected':'')+'"><time class="news-time numeric" datetime="'+esc(n.publishedAt)+'">'+n.time+'<b class="news-rank">#'+n.rank+'</b></time><h3><a href="'+esc(n.sourceUrl)+'" target="_blank" rel="noopener noreferrer">'+esc(n.title)+icon('external')+'</a></h3>'+(n.summary?'<p class="summary"><span>来源摘要</span>'+esc(n.summary)+(n.summarySource?' <small>· '+esc(n.summarySource)+'</small>':'')+'</p>':'')+'<div class="origin-links">'+related.map(ref=>'<a href="'+esc(ref.url)+'" target="_blank" rel="noopener noreferrer">'+esc(ref.name)+'</a>').join('<span> / </span>')+'<span class="heat-score" title="平台综合分，非全网阅读量">'+(state.edition==='report'?'重要度 ':'热度 ')+n.score+'</span></div><div class="news-meta"><span class="category">'+esc(n.category)+'</span>'+(n.sourceCount>1?'<span class="cross-source">'+n.sourceCount+' 源报道</span>':'')+'<button class="news-detail" data-link-news="'+esc(n.id)+'">'+icon('link')+'关联板块</button><button class="save-news '+(saved?'saved':'')+'" data-save="'+esc(n.id)+'" aria-label="'+(saved?'取消收藏':'收藏')+'：'+esc(n.title)+'">'+icon('bookmark')+'</button></div></article>';
}
function renderVirtualRows(){
 if(!virtualRows.length)return;
 const viewport=$('#newsViewport'),top=viewport.scrollTop-180,bottom=viewport.scrollTop+viewport.clientHeight+180;
 const visible=virtualRows.filter(r=>r.top+r.height>=top&&r.top<=bottom);
 $('#newsCanvas').innerHTML=visible.map(r=>`<div style="position:absolute;left:0;right:0;top:${r.top}px;height:${r.height}px">${r.type==='group'?`<div class="news-group">${icon('clock')}<span>${esc(r.group)}</span><span>北京时间</span></div>`:newsHTML(r.news)}</div>`).join('');
}
$('#newsViewport').addEventListener('scroll',()=>{if(!renderScheduled){renderScheduled=true;requestAnimationFrame(()=>{renderVirtualRows();renderScheduled=false;});}},{passive:true});
function setNewsDegraded(stale){
 state.stale=stale;$('#newsViewport').classList.toggle('stale-data',stale);
 $('.stale-notice')?.remove();
 if(stale){const notice=document.createElement('div');notice.className='stale-notice';notice.textContent=`资讯源暂不可用 · 保留上次成功快照 ${formatStamp(state.newsAsOf)}`;$('#newsViewport').before(notice);}
}
function applyNewsData(data){
 state.news=scenario==='empty'?[]:data.items;state.newsMeta=data;state.newsAsOf=data.asOf;
 const unavailable=(data.sources||[]).filter(s=>s.status==='error');setNewsDegraded(unavailable.length>0);
 renderNews(false);renderMustReads();updateStamps();
 setConnection(state.edition==='report'?(data.status==='final'?'全日新闻 · 已定稿':'全日新闻 · 持续补充'):state.date!==currentDate?'历史标题归档':state.paused?'页面自动刷新已暂停':unavailable.length?`聚合中 · ${unavailable.length} 源异常`:(staticMode?'云端聚合 · 页面自动同步':'多源聚合 · 5 分钟更新'),state.paused||unavailable.length>0);
 $('#sourceStatus').innerHTML=(data.sources||[]).map(s=>'<button data-action="sources" class="source-pill '+(s.status==='error'?'source-error':'')+'"><i></i>'+esc(s.name)+' '+(s.status==='ok'?s.count:s.status==='empty'?'暂无标题':'暂不可用')+'</button>').join('');
}
async function refreshNews({silent=false,version=loadVersion}={}){
 if(state.edition==='report')return refreshReport({silent,version});
 try{
   if(scenario==='offline')throw Error('离线场景');
   const res=await dataFetch(`/api/news${silent?'':'/refresh'}?date=${state.date}`,{method:silent?'GET':'POST',signal:AbortSignal.timeout(16000)});if(!res.ok)throw Error('新闻暂不可用');
   const data=await res.json();if(version!==loadVersion)return;
   if(!Array.isArray(data.items))throw Error('新闻数据格式错误');
   applyNewsData(data);safeSet(`guanshi-aggregate-${state.date}`,data);if(!silent)toast(staticMode?'已读取云端已发布榜单，采集按计划自动执行':'已获取最新标题榜单');
 }catch{
   if(version!==loadVersion)return;
   const cached=safeGet(`guanshi-aggregate-${state.date}`,null);if(cached){state.news=cached.items;state.newsAsOf=cached.asOf;state.newsMeta=cached;}
   setNewsDegraded(true);setConnection('连接异常 · 保留快照',true);renderNews(false);updateStamps();if(!silent)toast('连接暂不可用，已保留上次成功快照');
 }
}
async function refreshReport({silent=true,version=loadVersion}={}){
 try{
  const date=state.date,r=await dataFetch('/api/report?date='+date,{signal:AbortSignal.timeout(16000)});if(!r.ok)throw Error('日报暂不可用');
  const report=await r.json();if(!report?.news||version!==loadVersion||state.edition!=='report')return;
  state.report=report;state.snapshot=normalizeMarketSnapshot(report.close?.snapshot||null);state.snapshotStale=false;safeSet('guanshi-report-'+date,report);
  $('#workspace').classList.toggle('no-market',!state.snapshot);$('#reviewColumn').classList.toggle('hidden',!state.snapshot);
  if(state.snapshot)renderSnapshot();else renderMarkets();
  applyNewsData(report.news);if(!silent)toast(report.status==='final'?'已读取定稿日报':'已读取全日榜单，新闻将在跨日后定稿');
 }catch{if(version!==loadVersion)return;setConnection('日报连接异常 · 保留记录',true);state.snapshotStale=true;setNewsDegraded(true);if(state.snapshot)renderSnapshot();}
}
function connectStream(){
 if(state.edition==='report'){stream?.close();setConnection(state.report?.status==='final'?'全日新闻 · 已定稿':'全日新闻 · 持续补充');return;}
 stream?.close();if(state.date!==currentDate){setConnection('历史标题 · 已归档');return;}
 if(state.paused){setConnection('新闻连接已暂停',true);return;}
 if(scenario==='offline'){setConnection('离线 · 保留快照',true);return;}
 if(staticMode){setConnection('云端定时采集 · 页面自动同步');return;}
 if(!window.EventSource){setConnection('当前浏览器不支持推送 · 可手动刷新',true);return;}
 const subscribedDate=state.date;
 stream=new EventSource(`/api/news/stream?date=${state.date}`);
 stream.addEventListener('connected',()=>{if(!state.stale)setConnection('多源聚合 · 5 分钟更新');});
 stream.addEventListener('market',e=>{try{const d=JSON.parse(e.data);if(!demoMode&&d.date===state.date&&d.snapshot){state.snapshot=d.snapshot;$('#reviewColumn').classList.remove('hidden');renderSnapshot();updateStamps();}}catch{}});
 stream.addEventListener('heartbeat',()=>{if(!state.stale)setConnection('多源聚合 · 5 分钟更新');});
 stream.addEventListener('news',e=>{
  try{const data=JSON.parse(e.data);refreshCatalogue();refreshRuntime();if(data.date!==state.date){if(state.date===subscribedDate&&data.date>subscribedDate&&!demoMode){currentDate=data.date;boot.availableDates=[...new Set([...boot.availableDates,data.date])].sort();loadDate(data.date);}return;}applyNewsData(data);if(!demoMode)refreshMarket();}catch{setConnection('资讯格式异常 · 保留快照',true);}
 });
 stream.onerror=()=>{renderRuntime(true);setConnection('连接重试中 · 保留快照',true);setNewsDegraded(true);};
}
async function refreshMarket(){
 if(state.edition==='report'||demoMode||state.date!==currentDate)return;
 const version=loadVersion;
 try{const r=await dataFetch('/api/snapshot?date='+state.date,{signal:AbortSignal.timeout(16000)});if(!r.ok)throw Error('盘面暂不可用');const s=await r.json();if(!s||version!==loadVersion)return;state.snapshot=normalizeMarketSnapshot(s);state.snapshotStale=false;$('#reviewColumn').classList.remove('hidden');renderSnapshot();updateStamps();}catch{if(version!==loadVersion)return;state.snapshotStale=true;if(state.snapshot)renderSnapshot();}
}
function marketDataNotice(id,anchor,sourceIds,hasData,snapshot=state.snapshot){
 const failed=(snapshot?.sources||[]).filter(source=>sourceIds.includes(source.id)&&source.status==='error');
 let note=$('#'+id);if(!note){note=document.createElement('p');note.id=id;note.className='market-data-status';note.setAttribute('role','status');anchor.before(note);}
 const message=failed.length?failed.map(source=>source.name+'暂不可用 · '+(hasData?'使用上次成功数据':'暂无可用数据')+(source.lastSuccessAt?' · 上次成功采集 '+formatStamp(source.lastSuccessAt)+'（北京时间）':' · 尚无成功采集记录')).join('；'):state.snapshotStale?'连接异常 · '+(hasData?'使用缓存数据，请核对原行情时间':'暂无可用数据'):'';
 note.textContent=message;note.classList.toggle('hidden',!message);
}
function chartError(container,retryAction){
 container.innerHTML=emptyHTML('图表暂时不可用','其他信息仍可正常浏览；页面自动同步时会重试此图表。',`<button class="primary-button" data-action="${retryAction}">重试图表</button>`);
}
function palette(){const css=getComputedStyle(document.documentElement);return {ink:css.getPropertyValue('--text').trim(),muted:css.getPropertyValue('--muted').trim(),line:css.getPropertyValue('--line').trim(),surface:css.getPropertyValue('--surface').trim(),accent:css.getPropertyValue('--accent').trim(),red:css.getPropertyValue('--red').trim(),green:css.getPropertyValue('--green').trim()};}
function renderPriceChart(force=false){
 if(!state.snapshot||$('#workspace').classList.contains('hidden'))return;
 $('#priceChart').classList.remove('stale-data');marketDataNotice('chartDataStatus',$('#chartPanel .chart-wrap'),[state.chartMode==='candles'?'candles':'intraday'],Boolean(state.snapshot[state.chartMode==='candles'?'candles':'intraday']?.length));
 $('#chartLoading').classList.add('hidden');
 try{
  if(!window.echarts||(scenario==='chart-error'&&!force))throw Error('图表不可用');
  const el=$('#priceChart');if(priceChart){priceChart.dispose();priceChart=null;}el.innerHTML='';priceChart=echarts.init(el,null,{renderer:'canvas'});
  const s=state.snapshot,p=palette(),candles=state.chartMode==='candles',data=candles?s.candles:s.intraday;
  if(candles&&data.length)$('#chartSubtitle').textContent='上证日 K · 截至 '+(data.at(-1).tradeDate||data.at(-1).date)+' · 历史交易日序列';
  if(!data.length){priceChart.dispose();priceChart=null;el.innerHTML=emptyHTML('暂无当日走势',marketContext(s,state.date).label+'；数据产生并采集后会自动显示。');return;}
  const labels=data.map(d=>candles?d.date:d.time),values=data.map(d=>candles?d.values:d.value);
  const width=el.clientWidth, small=width<450;
  const commonAxis={axisLine:{show:false},axisTick:{show:false},axisLabel:{color:p.muted,fontSize:8,fontFamily:'Consolas, monospace'},axisPointer:{label:{backgroundColor:p.accent}}};
  const eventMarks=candles?[]:s.events.map((e,i)=>({name:e.name,coord:[e.time,s.intraday.find(d=>d.time===e.time)?.value],value:String(i+1),symbol:'circle',symbolSize:17,itemStyle:{color:p.surface,borderColor:p.accent,borderWidth:1.5},label:{color:p.accent,fontSize:8,fontWeight:600},eventIndex:i}));
  priceChart.setOption({animationDuration:450,textStyle:{fontFamily:'"Segoe UI","Microsoft YaHei",sans-serif'},grid:[{left:small?44:48,right:22,top:12,height:'57%'},{left:small?44:48,right:22,top:'74%',height:'14%'}],
   tooltip:{trigger:'axis',axisPointer:{type:'cross',link:[{xAxisIndex:'all'}],crossStyle:{color:p.muted}},backgroundColor:p.surface,borderColor:p.line,textStyle:{color:p.ink,fontSize:11},confine:true,formatter:items=>{
    const idx=items[0]?.dataIndex;if(idx===undefined)return '';const d=data[idx];return candles?`${esc(d.date)}<br>开 ${d.values[0]}　收 ${d.values[1]}<br>低 ${d.values[2]}　高 ${d.values[3]}<br>成交额 ${d.volume} 亿`:`<b>${esc(d.time)}</b><br>上证指数　${d.value.toFixed(2)}<br>成交额　${d.volume} 亿<br><span style="font-size:9px">${s.demo?'演示数据':'东方财富'} · 北京时间</span>`;
   }},axisPointer:{link:[{xAxisIndex:'all'}],label:{backgroundColor:p.accent}},
   xAxis:[{...commonAxis,type:'category',data:labels,boundaryGap:candles,axisLabel:{show:false},splitLine:{show:false}},{...commonAxis,type:'category',gridIndex:1,data:labels,boundaryGap:candles,axisLabel:{color:p.muted,fontSize:8,fontFamily:'Consolas',interval:candles?'auto':(i)=>[0,Math.floor(data.length/4),Math.floor(data.length/2),Math.floor(data.length*3/4),data.length-1].includes(i)}}],
   yAxis:[{...commonAxis,type:'value',scale:true,splitNumber:3,splitLine:{lineStyle:{color:p.line,type:'dashed'}},axisLabel:{color:p.muted,fontSize:8,fontFamily:'Consolas',formatter:v=>v.toFixed(0)}},{...commonAxis,type:'value',gridIndex:1,splitNumber:1,splitLine:{show:false},axisLabel:{show:false},name:'成交额',nameTextStyle:{color:p.muted,fontSize:7},nameLocation:'end',nameGap:7}],
   series:[candles?{type:'candlestick',data:values,itemStyle:{color:p.red,color0:p.green,borderColor:p.red,borderColor0:p.green},barMaxWidth:12}:{type:'line',data:values,smooth:.18,symbol:'none',lineStyle:{color:p.red,width:1.8},areaStyle:{color:new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:p.red+'25'},{offset:1,color:p.red+'00'}])},markPoint:{data:eventMarks},markLine:{silent:true,symbol:'none',label:{show:false},lineStyle:{color:p.muted,opacity:.4,type:'dotted'},data:[{type:'average'}]}},
    {type:'bar',xAxisIndex:1,yAxisIndex:1,data:data.map((d,i)=>({value:d.volume,itemStyle:{color:(candles?d.values[1]>=d.values[0]:i===0||d.value>=data[i-1].value)?p.red+'99':p.green+'99'}})),barMaxWidth:candles?12:7}]
  });
  priceChart.on('click',event=>{if(event.componentType==='markPoint'&&event.data?.eventIndex!==undefined)selectEvent(event.data.eventIndex);});
 }catch(error){priceChart?.dispose();priceChart=null;chartError($('#priceChart'),'retryPrice');}
}
function renderSectorChart(force=false){
 if(!state.snapshot)return;
 $('#sectorChart').classList.remove('stale-data');marketDataNotice('sectorDataStatus',$('#sectorPanel .sector-subtitle'),['sectors'],Boolean(state.snapshot.sectors?.length));
 renderFlows();$('#flowList').classList.toggle('hidden',state.sectorView!=='flows');$('#sectorChart').classList.toggle('hidden',state.sectorView==='flows');
 $('#sectorCaption').textContent=state.sectorView==='flows'?'已采集行业样本 · 主力净流入 / 流出 · 亿元':'行业样本 · 面积：成交额 · 颜色：涨跌幅';
 $('#sectorSourceLink').innerHTML=marketAnchor(state.snapshot.sourceLinks?.[state.sectorView==='flows'?'flows':'sectors']?.url,'数据来源');
 $('#clearSector').classList.toggle('hidden',!state.sector);$('#sectorLinkHint').innerHTML=icon('link')+(state.sector?`已联动 ${esc(state.sector)} · 左侧显示关联资讯`:'点击板块，追踪消息来源');
 if(state.sectorView==='flows')return;
 if(!state.snapshot.sectors.length){sectorChart?.dispose();sectorChart=null;$('#sectorChart').innerHTML=emptyHTML('暂无当日板块数据','当日报价产生后自动同步，不使用上一交易日板块冒充今日行情。');return;}
 try{
  if(!window.echarts)throw Error('图表不可用');
  if(sectorChart){sectorChart.dispose();sectorChart=null;}$('#sectorChart').innerHTML='';sectorChart=echarts.init($('#sectorChart'),null,{renderer:'canvas'});
  const p=palette();const selected=state.selectedNews?state.news.find(n=>n.id===state.selectedNews)?.sectors||[]:[];
  sectorChart.setOption({animationDuration:400,tooltip:{backgroundColor:p.surface,borderColor:p.line,textStyle:{color:p.ink,fontSize:11},formatter:x=>`${esc(x.name)}<br>涨跌幅 ${signed(x.data.change)}%<br>成交额 ${x.value} 亿元<br>主力净流入 ${signed(x.data.flow,1)} 亿元<br><span style="font-size:9px">点击筛选标题 · 东方财富</span>`},series:[{type:'treemap',roam:false,nodeClick:false,breadcrumb:{show:false},width:'100%',height:'100%',top:0,left:0,sort:'desc',visibleMin:0,leafDepth:1,label:{show:true,formatter:x=>`${x.name}\n${signed(x.data.change)}%`,fontSize:11,lineHeight:20,color:'#fff'},upperLabel:{show:false},itemStyle:{borderColor:p.surface,borderWidth:2,gapWidth:2,borderRadius:3},emphasis:{itemStyle:{borderColor:p.accent,borderWidth:3},label:{fontWeight:'bold'}},data:state.snapshot.sectors.slice(0,14).map(s=>{const highlight=state.sector===s.name||selected.includes(s.name);return {...s,itemStyle:{color:s.change>0?(s.change>2?'#ce6c72':s.change>1?'#d58689':'#dba6a8'):(s.change< -1?'#5b9e8b':'#7eb39f'),opacity:(state.sector||selected.length)&&!highlight?0.45:1,borderColor:highlight?p.accent:p.surface,borderWidth:highlight?3:2},label:{fontWeight:highlight?700:400}};})}]});
  sectorChart.on('click',e=>{if(e.name)selectSector(e.name);});
 }catch{sectorChart?.dispose();sectorChart=null;chartError($('#sectorChart'),'retrySector');}
}
function renderFlows(){
 const sorted=[...state.snapshot.sectors].filter(s=>s.flow!==null).sort((a,b)=>b.flow-a.flow);
 $('#flowList').innerHTML=[{name:'净流入 TOP 5',list:sorted.filter(s=>s.flow>0).slice(0,5),cls:'positive'},{name:'净流出 BOTTOM 5',list:sorted.filter(s=>s.flow<0).reverse().slice(0,5),cls:'negative'}].map(col=>`<div class="flow-column"><h4 class="${col.cls}">${col.name}</h4>${col.list.map((s,i)=>`<div class="flow-item"><button class="flow-row" data-sector="${esc(s.name)}"><em class="numeric">${i+1}</em><span>${esc(s.name)}</span><b class="numeric ${changeClass(s.flow)}">${signed(s.flow,1)}</b></button>${marketAnchor(s.sourceUrl,'来源','flow-source')}</div>`).join('')}</div>`).join('');
}
function selectSector(name){
 state.sector=state.sector===name?null:name;state.selectedNews=null;renderNews();renderSectorChart();
 if(state.view==='review'){setView('overview');}if(innerWidth<761){$('#newsPanel').scrollIntoView({behavior:'smooth',block:'start'});}
 toast(state.sector?`已显示「${name}」关联资讯`:'已取消板块联动');
}
function selectEvent(i){
 const e=state.snapshot.events[i];if(!state.snapshot.news[e.newsIndex]){toast('演示事件，真实新闻请查看左侧标题榜单');return;}state.selectedNews=state.snapshot.news[e.newsIndex].id;
 $$('[data-event]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.event)===i));
 openNews(state.selectedNews);
}
function dialog(title,body){
 $('#dialogContent').innerHTML=`<div class="dialog-header"><span>${esc(title)}</span><button class="icon-button" data-action="closeDialog" aria-label="关闭详情">${icon('close')}</button></div><div class="dialog-body">${body}</div>`;
 if(!$('#detailDialog').open)$('#detailDialog').showModal();
}
function openNews(id){
 const n=state.news.find(n=>n.id===id);if(!n?.sourceUrl){toast('该事件暂无可跳转原文');return;}
 window.open(n.sourceUrl,'_blank','noopener,noreferrer');
}
function linkNews(id){
 const n=state.news.find(n=>n.id===id);if(!n)return;
 state.selectedNews=state.selectedNews===id?null:id;renderNews(false);renderSectorChart();
 toast(state.selectedNews?(n.sectors.length?'关键词关联：'+n.sectors.join(' / '):'标题暂无可匹配板块'):'已取消联动');
}
function toggleSave(id){
 if(state.favorites.has(id)){state.favorites.delete(id);toast('已取消收藏');}else{state.favorites.add(id);toast('已收藏，可从左侧收藏入口回看');}
 safeSet('guanshi-saved-v2',[...state.favorites]);renderNews(false);
 if($('#detailDialog').open){const b=$('[data-save]', $('#dialogContent'));if(b?.dataset.save===id)b.textContent=state.favorites.has(id)?'取消收藏':'收藏这条资讯';}
}
function setView(view){
 state.view=view;$('#workspace').dataset.view=view;
 $$('[data-view]').forEach(el=>{const active=el.dataset.view===view;el.classList.toggle('active',active);if(el.getAttribute('role')==='tab')el.setAttribute('aria-selected',String(active));});
 requestAnimationFrame(()=>{priceChart?.resize();sectorChart?.resize();renderVirtualRows();});
}
function resetFilters(){state.query='';state.category='全部';state.important=false;state.sector=null;state.favoritesOnly=false;state.selectedNews=null;$('#search').value='';$('#importantOnly').checked=false;$$('[data-category]').forEach(b=>b.classList.toggle('active',b.dataset.category==='全部'));renderNews();renderSectorChart();}
function showSources(){
 const sources=state.newsMeta?.sources||[],market=state.snapshot?.sources||[];
 dialog('数据来源与排序说明','<span class="regime-tag">标题 + 来源摘要</span><h2>信息回到出处。</h2><p>平台展示并保存来源提供的独立短摘要（目前财联社与东方财富有可用字段），不抓取或存储新闻正文。摘要会标注提供来源；来源没有摘要字段时只显示标题和原文链接。点击标题或来源直接跳转原站。</p><h3>采集状态 · '+(staticMode?'5 分钟计划触发':'5 分钟更新')+'</h3><table class="source-table"><thead><tr><th>来源</th><th>状态 / 最近成功</th></tr></thead><tbody>'+sources.map(s=>'<tr><td><a target="_blank" rel="noopener noreferrer" href="'+esc(s.home)+'">'+esc(s.name)+'</a></td><td>'+esc(s.status==='ok'?'可用 · '+s.count+' 条标题':s.status==='empty'?'暂无标题':'暂不可用')+'<br><span class="numeric">'+formatStamp(s.lastSuccessAt)+'</span></td></tr>').join('')+'</tbody></table><h3>'+(state.edition==='report'?'全日重要财经新闻 TOP 20':'平台热度 TOP 20')+'</h3><p>'+esc(state.newsMeta?.ranking?.description||'跨站覆盖、源内互动分位、时效与来源重点标记综合排序。')+'</p><p>排序只覆盖已采集候选。只返回正文、没有独立标题或需要付费的条目会跳过；各站阅读量不直接相加。近似标题归并后保留多个出处链接。</p><h3>盘面数据</h3><p>腾讯财经提供细分指数与商品报价，东方财富提供分时、日 K、行业资金、涨跌停池、全 A 股行情及中国 10 年国债日度收益率。涨跌家数覆盖沪深京 A 股当日有效成交样本，剔除停牌、缺报价及非当日数据；赚钱效应为日涨跌幅中位数，市场温度为上涨家数占比。每个交易日首份完整盘后样本留存，积累 250 日后才显示历史分位。报价可能延迟，页面标注真实采集时间。国债涨跌以百分点 pp 计，日度日期不冒充实时。日报市场概览保留各市场当日最后留存报价，与固定的 A 股收盘盘面分别保存。</p><table class="source-table"><tbody>'+market.map(s=>'<tr><td>'+esc(s.name)+'</td><td>'+esc(s.status||'—')+' · '+formatStamp(s.lastSuccessAt||s.asOf)+'</td></tr>').join('')+'</tbody></table><p class="demo-note">盘面事实不等于已定稿复盘。暂未自动生成主线因果、支撑或压力位。'+(staticMode?'云端按计划采集，个人电脑关机不影响；任务可能延迟。':'服务运行期间持续采集，关闭本地服务后停止。')+'接口失败时保留最后成功记录。</p>');
}
function exportRecap(){
 if(!state.snapshot)return;const s=state.snapshot;
 const text=`# 观市 · ${s.date} 盘面记录\n\n> ${s.demo?'演示数据':'公开接口事实采样，复盘待确认'}。采样：${s.asOf}；时区：北京时间。\n\n## ${s.recap.regime} · ${s.recap.summary}\n\n${s.recap.paragraphs.map(p=>`### ${p.title}\n\n${p.full}`).join('\n\n')}\n\n仅供展示与学习，不构成投资建议。\n`;
 const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`观市-${s.date}-收盘复盘.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('复盘已导出');
}
document.addEventListener('click',e=>{
 const edition=e.target.closest('[data-edition]');if(edition&&!edition.disabled){state.edition=edition.dataset.edition;state.market='全部';$$('[data-market]').forEach(b=>b.classList.toggle('active',b.dataset.market==='全部'));loadDate(state.date);return;}
 if(e.target.closest('.mobile-nav a'))$('.mobile-nav').removeAttribute('open');
 const historyDate=e.target.closest('[data-archive-date]');if(historyDate){loadDate(historyDate.dataset.archiveDate);return;}
 const save=e.target.closest('[data-save]');if(save){e.stopPropagation();toggleSave(save.dataset.save);return;}
 const linked=e.target.closest('[data-link-news]');if(linked){linkNews(linked.dataset.linkNews);return;}
 const sector=e.target.closest('[data-sector]');if(sector){$('#detailDialog').close();selectSector(sector.dataset.sector);return;}
 const news=e.target.closest('[data-news]');if(news){if(news.classList.contains('news-item'))linkNews(news.dataset.news);else openNews(news.dataset.news);return;}
 const view=e.target.closest('[data-view]');if(view?.tagName==='BUTTON'){setView(view.dataset.view);return;}
 const cat=e.target.closest('[data-category]');if(cat){state.category=cat.dataset.category;$$('[data-category]').forEach(b=>b.classList.toggle('active',b===cat));renderNews();return;}
 const market=e.target.closest('[data-market]');if(market){state.market=market.dataset.market;$$('[data-market]').forEach(b=>b.classList.toggle('active',b===market));renderMarkets();return;}
 const chart=e.target.closest('[data-chart]');if(chart){state.chartMode=chart.dataset.chart;$$('[data-chart]').forEach(b=>b.classList.toggle('active',b===chart));renderPriceChart();return;}
 const reading=e.target.closest('[data-reading]');if(reading){state.reading=reading.dataset.reading;$$('[data-reading]').forEach(b=>b.classList.toggle('active',b===reading));renderRecap();return;}
 const mode=e.target.closest('[data-sector-view]');if(mode){state.sectorView=mode.dataset.sectorView;$$('[data-sector-view]').forEach(b=>b.classList.toggle('active',b===mode));renderSectorChart();return;}
 const event=e.target.closest('[data-event]');if(event){selectEvent(Number(event.dataset.event));return;}
 const clear=e.target.closest('[data-clear]');if(clear){if(clear.dataset.clear==='sector'){state.sector=null;state.selectedNews=null;renderSectorChart();}if(clear.dataset.clear==='query'){state.query='';$('#search').value='';}if(clear.dataset.clear==='favorites')state.favoritesOnly=false;renderNews();return;}
 const action=e.target.closest('[data-action]')?.dataset.action;
 if(action==='runtime')showRuntime();
 if(action==='closeDialog')$('#detailDialog').close();if(action==='sources')showSources();if(action==='latest')loadDate(currentDate);if(action==='resetFilters')resetFilters();if(action==='retryPrice')renderPriceChart(true);if(action==='retrySector')renderSectorChart(true);
 if(action==='favorites'){state.favoritesOnly=!state.favoritesOnly;setView('news');renderNews();$('#newsPanel').scrollIntoView({behavior:'smooth'});toast(state.favoritesOnly?'正在查看当前日期的收藏资讯':'已退出收藏筛选');}
});
document.addEventListener('keydown',e=>{
 if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();$('#search').focus();}
 const news=e.target.closest('[data-news]');if(news&&!e.target.closest('button')&&['Enter',' '].includes(e.key)){e.preventDefault();linkNews(news.dataset.news);}
});
$('#search').addEventListener('input',e=>{state.query=e.target.value;if(state.view==='review')setView('overview');renderNews();});
$('#importantOnly').addEventListener('change',e=>{state.important=e.target.checked;renderNews();});
$('#newsSort').addEventListener('change',e=>{state.sort=e.target.value;renderNews();});
$('#datePicker').addEventListener('change',e=>{if(e.target.value)loadDate(e.target.value);});
$('#archiveToggle').addEventListener('click',()=>{const panel=$('#archiveDates');panel.classList.toggle('hidden');$('#archiveToggle').setAttribute('aria-expanded',String(!panel.classList.contains('hidden')));});
$('#backToday').addEventListener('click',()=>loadDate(currentDate));
$('#prevDate').addEventListener('click',()=>{const d=boot.availableDates.filter(d=>d<state.date).at(-1);if(d)loadDate(d);});
$('#nextDate').addEventListener('click',()=>{const d=boot.availableDates.find(d=>d>state.date);if(d)loadDate(d);});
$('#clearSector').addEventListener('click',()=>{state.sector=null;state.selectedNews=null;renderNews();renderSectorChart();});
$('#pauseNews').addEventListener('click',()=>{state.paused=!state.paused;connectStream();updateStamps();toast(state.paused?'已暂停新闻推送连接':'已恢复新闻推送连接');});
$('#allImportant').addEventListener('click',()=>{state.important=false;$('#importantOnly').checked=false;state.sort='heat';$('#newsSort').value='heat';setView('overview');renderNews();$('#newsPanel').scrollIntoView({behavior:'smooth'});});
$('#exportRecap').addEventListener('click',exportRecap);
$('#themeToggle').addEventListener('click',()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=theme;try{localStorage.setItem('guanshi-theme',theme)}catch{}updateThemeIcon();renderPriceChart();renderSectorChart();});
function updateThemeIcon(){const dark=document.documentElement.dataset.theme==='dark';$('#themeToggle').innerHTML=icon(dark?'sun':'moon');$('#themeToggle').setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');$('#themeToggle').title=dark?'切换浅色模式':'切换深色模式';}
$('#detailDialog').addEventListener('click',e=>{if(e.target===$('#detailDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right)$('#detailDialog').close();}});
$('#limitDetails').addEventListener('click',()=>{const s=state.snapshot;if(!s)return;dialog('涨停池 · 行业分布','<span class="regime-tag">东方财富涨停池</span><h2>从数量，看到结构。</h2><p>涨停 '+(s.sentiment.limitUp??'—')+' 家，跌停 '+(s.sentiment.limitDown??'—')+' 家，最高连板 '+(s.sentiment.height??'—')+' 板，炸板率 '+(s.sentiment.brokenRate??'—')+'%。</p><table class="source-table"><thead><tr><th>行业</th><th>池内家数</th></tr></thead><tbody>'+(s.limitThemes||[]).map(t=>'<tr><td>'+esc(t.name)+'</td><td>'+t.count+'</td></tr>').join('')+'</tbody></table><p class="demo-note">分类取自数据源行业字段，未推断涨停原因。炸板率 = 炸板池家数 /（涨停池家数 + 炸板池家数）。接口池内统计可能延迟。</p>');});
const resizeObserver=new ResizeObserver(()=>{if(priceChart&&!priceChart.isDisposed())priceChart.resize();if(sectorChart&&!sectorChart.isDisposed())sectorChart.resize();});resizeObserver.observe($('#reviewColumn'));
window.addEventListener('online',()=>{pollPublished().then(connectStream)});window.addEventListener('offline',()=>{stream?.close();setNewsDegraded(true);setConnection('离线 · 保留快照',true);});
window.addEventListener('pagehide',()=>stream?.close());
try{for(const k of Object.keys(localStorage))if(/^guanshi-(news|snapshot)-/.test(k))localStorage.removeItem(k);}catch{}
updateThemeIcon();await refreshCatalogue();await loadDate(state.date,{initial:true});await refreshRuntime();lastPageSyncAt=new Date().toISOString();renderSyncStatus();
async function pollPublished(){
 if(pollBusy||!navigator.onLine)return;pollBusy=true;
 try{
  await Promise.allSettled([refreshRuntime(),refreshCatalogue()]);
  if(state.paused)return;
  if(followToday&&state.date!==currentDate&&!demoMode){await loadDate(currentDate);return;}
  if(state.edition==='report'){await refreshReport();return;}
  if(state.date===currentDate)await Promise.allSettled([refreshNews({silent:true}),refreshMarket()]);
 }finally{lastPageSyncAt=new Date().toISOString();pollBusy=false;renderSyncStatus();}
}
setInterval(pollPublished,30000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)pollPublished();});
window.addEventListener('focus',pollPublished);window.addEventListener('pageshow',pollPublished);
