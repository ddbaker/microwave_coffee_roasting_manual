// Reference geometry: coffee_roast_volume_energy_dual_time_axes_EN_warm.png.
// SVG is resolution-independent and exports at the original 2400 x 1555 size.
export const mmss = n => n == null ? '—' : `${Math.floor(Math.round(n)/60)}:${String(Math.round(n)%60).padStart(2,'0')}`;
export const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BLUE='#16728f', ORANGE='#c45716', INK='#244353', MUTED='#607785', GRID='#d7e2e8', PAUSE='#eaf0f3', ON='#fff0e4';
const W=2400,H=1555,L=190,R=2190,T=500,B=1225,AX=421;
const ticks=(lo,hi,step)=>Array.from({length:Math.floor((hi-lo)/step)+1},(_,i)=>lo+i*step);
const text=(x,y,s,color=INK,size=25,anchor='start')=>`<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}">${escape(s)}</text>`;
const line=(x1,y1,x2,y2,color=GRID,width=2,extra='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${extra}/>`;
const rect=(x,y,w,h,color,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${color}" ${extra}/>`;

export function graphSvg({profile:p,steps}) {
  if (!p.graph_eligible) return '';
  const knownEnd=Math.max(0,...steps.map(s=>s.elapsed_end_s??s.irradiation_end_s??0));
  const xmax=(p.elapsed_seconds??knownEnd)||60;
  const vols=steps.filter(s=>s.volume_ml!=null&&s.elapsed_end_s!=null);
  const energies=steps.filter(s=>s.energy_kj!=null&&s.irradiation_end_s!=null);
  const initial=p.initial_volume_ml;
  const points=[...(initial!=null?[{step:0,step_id:0,volume_ml:initial,elapsed_end_s:0,cumulative_irradiation_s:0,volume_raw:p.initial_volume_raw}]:[]),...vols];
  const lo=Math.min(250,Math.floor(Math.min(...points.map(s=>s.volume_ml),250)/25)*25);
  const hi=Math.max(350,Math.ceil(Math.max(...points.map(s=>s.volume_ml),350)/25)*25);
  const emax=Math.max(30,Math.ceil(Math.max(...energies.map(s=>s.energy_kj),30)/5)*5);
  const x=s=>L+s/xmax*(R-L), yv=v=>B-(v-lo)/(hi-lo)*(B-T), ye=e=>B-e/emax*(B-T);
  let above=false;
  const ret=initial==null?null:vols.find(s=>{if(s.volume_ml>initial){above=true;return false;}return above&&s.volume_ml<=initial;});
  const chosen=[];
  const reference=p.archive_entry==='2026/ethiopia_gesha-villedge_natural_23-24crop-26Jun/coffee_roast_26Jul25.ods';
  if(reference){for(const id of [2,4,6,8,10,12,14,17,20,23,26]){const s=steps.find(s=>s.step_id===id);if(s?.elapsed_end_s!=null)chosen.push(s);}}
  else {
    let prev=L;
    for(const s of steps){if(s.elapsed_end_s==null)continue;const pos=x(s.elapsed_end_s);if(pos-prev>=145&&pos<R-145){chosen.push(s);prev=pos;}}
    const end=steps.filter(s=>s.elapsed_end_s!=null).at(-1);if(end)chosen.push(end);
  }
  const parts=[`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="graph-title graph-description" font-family="Arial, sans-serif">`,
    `<title id="graph-title">${escape(p.roast_date+' '+p.coffee_title)}: volume and energy per irradiation step</title>`,
    '<desc id="graph-description">Volume at pause end, energy at irradiation end. Lower axis includes pauses; upper axis shows cumulative irradiation. Volume is visually estimated.</desc>',
    rect(0,0,W,H,'white'),text(92,88,'Volume and energy input per irradiation step','#203b49',46),
    text(92,142,`${p.coffee_title} | Total elapsed time, including pauses: ${p.elapsed_seconds==null?'not fully recorded':mmss(p.elapsed_seconds)}`,MUTED,29),
    line(190,209,255,209,BLUE,4.5),text(272,213,'Volume (left axis)',BLUE,28),
    line(800,209,865,209,ORANGE,4.5),text(882,213,'Energy per step (right axis)',ORANGE,28),
    rect(1710,196,38,27,PAUSE),text(1764,213,'Pauses',MUTED,28),rect(1950,196,38,27,ON),text(2004,213,'Irradiation',MUTED,28),
    text(190,265,'Volume: assumed at pause end. Energy: at irradiation end; per step, not cumulative.',MUTED,27),
    text(1190,320,'Cumulative irradiation time (min:sec) — selected records aligned at pause end',INK,28,'middle'),
    text(1190,362,'Advances during irradiation and stops during pauses. Short bars mark intervals with the same cumulative time.',MUTED,24,'middle'),
    line(L,AX,R,AX),line(L,AX-6,L,AX+14,INK),text(L,AX-14,'0:00',INK,25,'middle')];
  for(const [cx,color] of [[222,BLUE],[832,ORANGE]])parts.push(`<circle cx="${cx}" cy="209" r="6.5" fill="${color}"/>`);
  for(const s of chosen)parts.push(line(x(s.irradiation_end_s),AX,x(s.elapsed_end_s),AX,s===ret?BLUE:INK,3),line(x(s.irradiation_end_s),AX-6,x(s.irradiation_end_s),AX+5,INK),line(x(s.elapsed_end_s),AX-6,x(s.elapsed_end_s),AX+14,INK),text(x(s.elapsed_end_s),AX-14,mmss(s.cumulative_irradiation_s),s===ret?BLUE:INK,25,'middle'));
  parts.push(text(L,479,'Volume (mL)',BLUE,28),text(R,479,'Energy input per step (kJ)',ORANGE,28,'end'),rect(L,T,R-L,B-T,'white'));
  for(const s of steps.filter(s=>s.elapsed_start_s!=null)){
    parts.push(rect(x(s.elapsed_start_s),T,Math.max(0,x(s.irradiation_end_s)-x(s.elapsed_start_s)),B-T,ON,'data-band="irradiation"'));
    if(s.elapsed_end_s!=null)parts.push(rect(x(s.irradiation_end_s),T,Math.max(0,x(s.elapsed_end_s)-x(s.irradiation_end_s)),B-T,PAUSE,'data-band="pause"'));
  }
  for(const v of ticks(lo,hi,25))parts.push(line(L,yv(v),R,yv(v),GRID,1.8),line(L-9,yv(v),L,yv(v),BLUE),text(L-18,yv(v)+8,v,BLUE,26,'end'));
  for(const v of ticks(0,emax,emax>60?10:5))parts.push(line(R,ye(v),R+9,ye(v),ORANGE),text(R+19,ye(v)+8,v,ORANGE,26));
  parts.push(line(L,T,L,B,BLUE,2.5),line(R,T,R,B,ORANGE,2.5),line(L,B,R,B,INK));
  const tickStep=xmax>2100?300:120;
  for(const t of [...ticks(0,xmax,tickStep).filter(t=>t===0||xmax-t>tickStep*.5),xmax])parts.push(line(x(t),B,x(t),B+12,INK),text(x(t),B+39,mmss(t),INK,25,'middle'));
  parts.push(text(1190,1321,'Elapsed time including pauses (min:sec)',INK,28,'middle'),`<polyline points="${points.map(s=>`${x(s.elapsed_end_s)},${yv(s.volume_ml)}`).join(' ')}" fill="none" stroke="${BLUE}" stroke-width="4.5"/>`);
  for(let i=1;i<steps.length;i++){
    const a=steps[i-1],b=steps[i];
    if(a.energy_kj!=null&&b.energy_kj!=null&&a.irradiation_end_s!=null&&b.irradiation_end_s!=null)parts.push(line(x(a.irradiation_end_s),ye(a.energy_kj),x(b.irradiation_end_s),ye(b.energy_kj),ORANGE,4.5));
  }
  for(const [name,data,y,time,color] of [['volume',points,yv,'elapsed_end_s',BLUE],['energy',energies,ye,'irradiation_end_s',ORANGE]]){
    for(const s of data){
      const label=`ID ${s.step_id??s.step} · Irradiation ${mmss(s.cumulative_irradiation_s)} · Elapsed ${mmss(s.elapsed_end_s)} · Volume ${s.volume_raw||'—'} · ${s.energy_kj??'—'} kJ${s.note_ja?' · '+s.note_ja:''}`;
      parts.push(`<circle data-series="${name}" cx="${x(s[time])}" cy="${y(name==='volume'?s.volume_ml:s.energy_kj)}" r="7.4" fill="${color}" tabindex="0" aria-label="${escape(label)}"><title>${escape(label)}</title></circle>`);
    }
  }
  if(initial!=null)parts.push(text(L+12,Math.min(B-20,yv(initial)+39),`${initial} mL`,BLUE));
  const lastV=vols.at(-1),lastE=energies.at(-1);
  if(lastV)parts.push(text(Math.min(R-26,x(lastV.elapsed_end_s)),Math.max(T+32,yv(lastV.volume_ml)-25),`${lastV.volume_ml} mL (ID ${lastV.step_id})`,BLUE,25,'end'));
  if(lastE)parts.push(text(Math.min(R-12,x(lastE.irradiation_end_s)),Math.min(B-14,ye(lastE.energy_kj)+37),`${lastE.energy_kj} kJ (ID ${lastE.step_id})`,ORANGE,25,'end'));
  if(ret)parts.push(line(x(ret.elapsed_end_s),AX+18,x(ret.elapsed_end_s),yv(ret.volume_ml),BLUE,2,'stroke-dasharray="7 7"'),`<circle cx="${x(ret.elapsed_end_s)}" cy="${yv(ret.volume_ml)}" r="12" fill="none" stroke="${BLUE}" stroke-width="2.5"/>`,line(x(ret.elapsed_end_s),yv(ret.volume_ml)+12,x(ret.elapsed_end_s),1045,BLUE),rect(885,1045,720,108,'white',`rx="7" stroke="${BLUE}" stroke-width="1.8"`),text(906,1081,`Step ${ret.step_id}: ${ret.volume_ml} mL (${ret.volume_ml===initial?'same as':'below'} the initial volume)`,BLUE),text(906,1126,`Cumulative irradiation ${mmss(ret.cumulative_irradiation_s)} / Elapsed ${mmss(ret.elapsed_end_s)}`,BLUE,27));
  parts.push(text(92,1394,`Volume values are visual estimates: slash = midpoint; + = add 5 mL; − = subtract 5 mL.${steps.at(-1)?.volume_ml==null?` No volume recorded for ID ${steps.at(-1)?.step_id}.`:''}`,MUTED,24),text(92,1439,'Lines connect recorded points. The two vertical axes use different scales. Heat retained in the beans is not shown.',MUTED,24),text(92,1496,`Source: ${p.filename}, sheet: plots. Original file preserved in the source ZIP.`,MUTED,22),'</svg>');
  return parts.join('');
}
