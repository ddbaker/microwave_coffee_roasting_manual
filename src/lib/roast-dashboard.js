import { graphSvg, mmss, escape } from './roast-graph.js';
const $=id=>document.getElementById(id);
const ja=$('main').dataset.lang==='ja';
const tr=(en,jp)=>ja?jp:en;
const keys=['country','origin','suborigin','month','day'];
let profiles=[], selected=null, controller=null, loadController=null;
const detailsCache=new Map();
const instructions=tr('Hover or focus a point for its recorded value. On small screens, scroll the graph horizontally.','点にカーソルを重ねるかフォーカスすると記録値を確認できます。小さい画面ではグラフを横にスクロールできます。');
async function request(url,signal){
  const response=await fetch(url,{signal});
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  return response.json();
}
function clearProfile(){
  controller?.abort(); selected=null;
  $('profile-heading').textContent=''; $('profile-summary').textContent='';
  $('graph').replaceChildren(); $('source-rows').replaceChildren(); $('quality-flags').replaceChildren();
  $('source-path').textContent=''; $('source-hash').textContent=''; $('point-detail').textContent='';
  $('download-png').hidden=true; $('source-details').hidden=true;
  $('profile').setAttribute('aria-busy','false');
}
function filterRows(){
  let rows=profiles.filter(p=>p.graph_eligible);
  for(const key of keys){
    const select=$(key), previous=select.value;
    const values=[...new Set(rows.map(p=>p[key]).filter(Boolean))].sort();
    if(key==='month')values.reverse();
    select.replaceChildren(new Option(tr('All','すべて'),''),...values.map(v=>new Option(v,v)));
    select.value=values.includes(previous)?previous:'';
    if(select.value)rows=rows.filter(p=>p[key]===select.value);
  }
  $('result-count').textContent=tr(`${rows.length} matching roasting logs`,`${rows.length} 件の焙煎ログ`);
  $('profile-list').innerHTML=rows.map(p=>`<tr><td><button type="button" data-roast-id="${escape(p.roast_id)}" aria-pressed="${selected?.profile.roast_id===p.roast_id}" aria-label="${escape((p.roast_date||'—')+' '+p.country+' '+p.origin+' '+p.filename)}">${escape(p.roast_date||'—')}</button></td><td>${escape(p.country)}</td><td>${escape(p.origin+(p.suborigin==='指定なし'?'':' / '+p.suborigin))}</td><td>${escape(p.filename)}</td></tr>`).join('');
  if(!rows.some(p=>p.roast_id===selected?.profile.roast_id)){
    clearProfile();
    const reference=rows.find(p=>p.filename==='coffee_roast_26Jul25.ods'&&p.origin==='Gesha Village');
    if(rows.length)showProfile((reference||rows[0]).roast_id);
    else $('profile-summary').textContent=tr('No records match these filters.','条件に一致する記録はありません。');
  }
}
async function showProfile(id){
  clearProfile();
  controller=new AbortController();
  const current=controller;
  $('profile').setAttribute('aria-busy','true');
  $('profile-summary').textContent=tr('Loading selected record…','選択した記録を読み込み中…');
  for(const button of document.querySelectorAll('[data-roast-id]'))button.setAttribute('aria-pressed',String(button.dataset.roastId===id));
  try{
    const detail=detailsCache.get(id)||await request(`/api/roasts/${id}`,current.signal);
    if(current.signal.aborted)return;
    // Do not mix obsolete catalog eligibility with a refreshed source record.
    if(!detail.profile.graph_eligible)throw Error('Record is no longer graph eligible. Reload the catalog.');
    detailsCache.set(id,detail); selected=detail;
    const p=detail.profile;
    $('profile-heading').textContent=`${p.roast_date||'—'} · ${p.country} · ${p.origin}${p.suborigin==='指定なし'?'':' / '+p.suborigin}`;
    $('profile-summary').textContent=tr(`${p.step_count} irradiation steps · Irradiation ${mmss(p.heating_seconds)} · Elapsed ${mmss(p.elapsed_seconds)} · Total energy ${p.energy_kj??'—'} kJ`,`${p.step_count} 照射ステップ · 照射累計 ${mmss(p.heating_seconds)} · 経過 ${mmss(p.elapsed_seconds)} · 投入合計 ${p.energy_kj??'—'} kJ`);
    $('graph').innerHTML=graphSvg(detail);
    $('download-png').hidden=false; $('source-details').hidden=false; $('point-detail').textContent=instructions;
    $('source-path').textContent=`Source: ${detail.source.path} · sheet: plots`;
    $('source-hash').textContent=`SHA-256: ${detail.source.sha256} · ${detail.source.parser_version}`;
    $('quality-flags').innerHTML=detail.flags.map(f=>`<li>${escape(f.source_row?'Row '+f.source_row+': ':'')}${escape(f.detail)}</li>`).join('');
    $('source-rows').innerHTML=detail.steps.map(s=>`<tr>${[s.step_id,s.source_row,s.duration_s,s.pause_used_s,s.power_w,s.energy_kj,s.volume_raw,s.volume_ml,s.elapsed_end_s,s.note_ja].map(v=>`<td>${escape(v??'—')}</td>`).join('')}</tr>`).join('');
  }catch(error){
    if(current.signal.aborted)return;
    $('profile-summary').textContent=tr('This record could not be loaded. Select it again to retry.','記録を読み込めませんでした。もう一度選択してください。');
  }finally{if(!current.signal.aborted)$('profile').setAttribute('aria-busy','false');}
}
async function load(){
  loadController?.abort(); loadController=new AbortController();
  $('retry').hidden=true; $('explorer').hidden=true;
  $('load-status').textContent=tr('Loading roasting logs…','ログを読み込み中…');
  try{
    const data=await request('/api/roasts/',loadController.signal);
    profiles=data.profiles; detailsCache.clear(); clearProfile();
    const excluded=profiles.filter(p=>!p.graph_eligible).length;
    $('load-status').textContent=tr(`Latest import: ${data.sources.map(s=>s.name).join(', ')} · ${data.updated_at.slice(0,10)}`,`最終取込：${data.sources.map(s=>s.name).join(', ')} · ${data.updated_at.slice(0,10)}`);
    $('excluded-summary').textContent=tr(`${profiles.length} source files retained. ${excluded} records without usable volume / elapsed-time observations are excluded from this graph list.`,`元ファイル ${profiles.length} 件を保持。体積・経過時間の有効な観測がない ${excluded} 件はグラフ一覧から除外しています。`);
    $('explorer').hidden=false; filterRows();
  }catch(error){
    if(error.name==='AbortError')return;
    $('load-status').textContent=tr('Roasting data is currently unavailable. Please try again later.','焙煎データを読み込めません。時間をおいて再度お試しください。');
    $('retry').hidden=false;
  }
}
for(const [index,key] of keys.entries())$(key).addEventListener('change',()=>{for(const next of keys.slice(index+1))$(next).value='';filterRows();});
$('reset-filters').addEventListener('click',()=>{for(const key of keys)$(key).value='';filterRows();});
$('retry').addEventListener('click',load);
$('profile-list').addEventListener('click',event=>{const b=event.target.closest('[data-roast-id]');if(b)showProfile(b.dataset.roastId);});
for(const event of ['mouseover','focusin'])$('graph').addEventListener(event,e=>{const p=e.target.closest('[data-series]');if(p)$('point-detail').textContent=p.getAttribute('aria-label');});
for(const event of ['mouseleave','focusout'])$('graph').addEventListener(event,()=>$('point-detail').textContent=instructions);
$('download-png').addEventListener('click',async()=>{
  const record=selected; if(!record)return;
  let svgUrl,downloadUrl;
  try{
    svgUrl=URL.createObjectURL(new Blob([graphSvg(record)],{type:'image/svg+xml;charset=utf-8'}));
    const image=new Image();image.src=svgUrl;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=2400;canvas.height=1555;
    canvas.getContext('2d').drawImage(image,0,0);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw Error('PNG export failed');
    downloadUrl=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=downloadUrl;a.download=`${record.profile.roast_date}_${record.profile.lot}_volume_energy.png`;a.click();
  }catch(error){$('point-detail').textContent=tr('PNG export failed. Please try again.','PNGを保存できませんでした。もう一度お試しください。');}
  finally{if(svgUrl)URL.revokeObjectURL(svgUrl);if(downloadUrl)setTimeout(()=>URL.revokeObjectURL(downloadUrl),1000);}
});
load();
