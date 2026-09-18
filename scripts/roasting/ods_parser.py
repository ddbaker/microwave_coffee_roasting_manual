"""Read ODS cached values without executing formulas, macros, or links.

Adapted from the supplied local dashboard's import_database.py. Conversion
assumptions follow the reference PNG and note_interpret.md. No source is edited.
"""
from pathlib import Path
from io import BytesIO
from datetime import date, datetime, timezone
import collections, hashlib, json, math, re, sqlite3, unicodedata, zipfile
import xml.etree.ElementTree as ET

NS = {'t':'urn:oasis:names:tc:opendocument:xmlns:table:1.0',
      'o':'urn:oasis:names:tc:opendocument:xmlns:office:1.0',
      'x':'urn:oasis:names:tc:opendocument:xmlns:text:1.0'}
def tag(p, n): return '{'+NS[p]+'}'+n
def norm(s): return unicodedata.normalize('NFKC', str(s or '')).strip()
def colname(n):
    s=''
    while n: n,a=divmod(n-1,26); s=chr(65+a)+s
    return s
def content(e):
    if e.tag==tag('x','s'): return ' '*int(e.get(tag('x','c'),'1'))
    if e.tag==tag('x','tab'): return '\t'
    if e.tag==tag('x','line-break'): return '\n'
    return (e.text or '')+''.join(content(c)+(c.tail or '') for c in e)
def extract(blob):
    with zipfile.ZipFile(BytesIO(blob)) as z: root=ET.fromstring(z.read('content.xml'))
    sheets=[]
    for table in root.findall('./o:body/o:spreadsheet/t:table',NS):
        cells=[]; rn=1
        for row in table.iter(tag('t','table-row')):
            nr=int(row.get(tag('t','number-rows-repeated'),'1')); cn=1; current=[]
            for c in row:
                if c.tag not in (tag('t','table-cell'),tag('t','covered-table-cell')): continue
                nc=int(c.get(tag('t','number-columns-repeated'),'1'))
                txt='\n'.join(content(e) for e in c.findall('./x:p',NS))
                attrs={k.rsplit('}',1)[-1]:v for k,v in c.attrib.items()}
                typ=attrs.get('value-type'); value=attrs.get('value')
                if value is not None:
                    try: value=float(value)
                    except ValueError: pass
                elif typ=='time': value=attrs.get('time-value')
                elif typ=='date': value=attrs.get('date-value')
                elif typ=='boolean': value=attrs.get('boolean-value')
                else: value=attrs.get('string-value') or txt or None
                annotations=['\n'.join(content(e) for e in a.findall('.//x:p',NS)) for a in c.findall('./o:annotation',NS)]
                if txt or value is not None or attrs.get('formula') or annotations:
                    if nc*nr>10000: raise ValueError('Excessive nonempty repeated cells')
                    for cc in range(cn,cn+nc):
                        current.append(dict(col=cc,text=txt,value=value,type=typ,formula=attrs.get('formula'),annotations=annotations))
                cn+=nc
            for rr in range(rn,rn+nr) if current else []:
                cells.extend(dict(c,row=rr,address=colname(c['col'])+str(rr)) for c in current)
            rn+=nr
        sheets.append({'name':table.get(tag('t','name')),'cells':cells})
    return sheets
def number(v):
    if isinstance(v,(int,float)): return float(v) if math.isfinite(v) else None
    s=norm(v)
    return float(s) if re.fullmatch(r'-?\d+(?:\.\d+)?',s) else None
def seconds(v):
    n=number(v)
    if n is not None:return n
    s=norm(v)
    m=re.fullmatch(r'PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?',s)
    if m:return sum(float(x or 0)*u for x,u in zip(m.groups(),[3600,60,1]))
    m=re.fullmatch(r'(\d+):(\d{2})',s)
    if m:return int(m[1])*60+int(m[2])
    m=re.fullmatch(r'(?:(\d+)\s*m(?:in)?)?\s*(?:(\d+)\s*s)?',s)
    if m and s:return int(m[1] or 0)*60+int(m[2] or 0)
    return None
MONTHS={m:i+1 for i,m in enumerate('jan feb mar apr may jun jul aug sep oct nov dec'.split())}
def roastdate(path):
    raw=Path(path).stem.lower(); s=raw.replace('jfeb','feb').replace('june','jun').replace('july','jul')
    s=re.sub(r'(?<=\d)une','jun',s)
    m=re.search(r'(\d{2})?('+'|'.join(MONTHS)+r')(\d{1,2})',s)
    if not m:return None,'unparsed'
    folder=re.search(r'(?:^|/)((?:19|20)\d{2})/',path)
    y=2000+int(m[1]) if m[1] else int(folder[1]) if folder else None
    if y is None:return None,'unparsed'
    try:return date(y,MONTHS[m[2]],int(m[3])).isoformat(),('filename' if m[1] and raw==s else 'normalized_filename' if m[1] else 'filename_month_day_and_folder_year')
    except ValueError:return None,'unparsed'
def volume(v):
    raw=norm(v); s=re.sub(r'[↑↓→\s]','',raw)
    m=re.fullmatch(r'(\d{3}(?:\.\d+)?)(?:/(\d{3}(?:\.\d+)?))?([+\-=]?)',s)
    if not m:return None,'missing' if not raw else 'unparsed'
    a=float(m[1]);b=float(m[2]) if m[2] else a
    if not (100<=a<=600 and 100<=b<=600):return None,'unparsed'
    # Reject transposed marks and ambiguous ranges; retain the original text.
    if a%25 or b%25 or (m[2] and abs(a-b)!=25):return None,'unparsed'
    val=(a+b)/2
    if m[3]=='+':val+=5
    if m[3]=='-':val-=5
    return val,'midpoint' if m[2] else 'plus_5' if m[3]=='+' else 'minus_5' if m[3]=='-' else 'mark'
COUNTRIES={'bolivia':'Bolivia','brazil':'Brazil','cameroon':'Cameroon','costarica':'Costa Rica','ecuador':'Ecuador','ecuardor':'Ecuador','ethiopia':'Ethiopia','guatemala':'Guatemala','haiti':'Haiti','kenya':'Kenya','myanmar':'Myanmar','pngi':'Papua New Guinea','venezuela':'Venezuela','yemen':'Yemen'}
def origin_fields(lot):
    tokens=lot.split('_'); country=COUNTRIES.get(tokens[0].lower(),tokens[0].title())
    rest=[]
    for t in tokens[1:]:
        if re.search(r'^\d{2}(?:-|[A-Za-z]{3})|crop',t,re.I) or t.lower() in ['natural','natual','washed','wash','sundry','anaerobic']:break
        rest.append(t)
    aliases={'gesha-villedge':'Gesha Village','soldemanana':'Sol de la Mañana','soldelamanana':'Sol de la Mañana','shidama':'Shidama','yirgacheffe':'Yirgacheffe','jaguarhoney':'Jaguar','s-rafa':'Santa Rafaela','qcho':'Qcho','g4':'G4','typica-mejorado':'Typica Mejorado'}
    words=[aliases.get(t.lower(),t.replace('-',' ').title()) for t in rest]
    origin=words[0] if words else '記載なし'
    suborigin=' / '.join(words[1:]) if len(words)>1 else '指定なし'
    return country,origin,suborigin
def normalize_book(path,sheets):
    rid='roast-'+hashlib.sha256(path.encode()).hexdigest()[:16]
    lot=path.rsplit('/',2)[-2]; d,date_basis=roastdate(path)
    country,origin,suborigin=origin_fields(lot)
    byname={s['name']:s['cells'] for s in sheets}; cells=byname.get('plots',[])
    grid={(c['row'],c['col']):c for c in cells}
    def cell(r,c):return grid.get((r,c),{})
    def val(r,c):return cell(r,c).get('value')
    def tx(r,c):return cell(r,c).get('text','')
    heads={norm(c['text']).replace(' ',''):c['col'] for c in cells if c['row']<=3}
    pc=heads.get('W数'); vc=heads.get('体積'); nc=heads.get('Note')
    ec=heads.get('経過実時間s'); standard=bool(pc and heads.get('照射間隔'))
    flags=[]
    def flag(code,row,detail):flags.append(dict(roast_id=rid,code=code,source_row=row,detail=detail))
    if date_basis!='filename':flag('date_normalization',None,date_basis+' → '+str(d))
    steps=[]; elapsed=0.; heat=0.
    if standard:
        for rr in sorted({c['row'] for c in cells}):
            duration=seconds(val(rr,4))
            if rr<=3 or duration is None or duration<=0:continue
            sid=number(val(rr,2)); power=number(val(rr,pc)); pause=seconds(val(rr,5)); cached=number(val(rr,ec)); note=tx(rr,nc)
            energy=None
            if power is not None and 0<power<=2000: energy=power*duration/1000
            else:flag('power_missing_or_zero',rr,'照射時間は記録あり。出力が空白・0のためエネルギーは未確定。')
            # Only a per-row elapsed cache is eligible. SUM totals sometimes occupy
            # the same row as the final heating pulse; these are not step durations.
            elapsed_formula=cell(rr,ec).get('formula') or ''
            is_total='SUM(' in elapsed_formula.upper() or (cached is not None and cached>duration+600)
            if cached is not None and cached>=duration and not is_total:
                used_pause=cached-duration; basis='elapsed_cache'
                if pause is None:flag('pause_from_elapsed',rr,f'休止欄は空白。経過実時間 {cached:g}s − 照射 {duration:g}s = {used_pause:g}s。')
                elif abs(used_pause-pause)>.01:flag('pause_cache_conflict',rr,f'休止欄 {pause:g}s / 経過実時間からの休止 {used_pause:g}s。参照図と同じく後者を使用。')
            elif pause is not None and pause>=0:used_pause=pause; basis='duration_plus_pause'
            else:used_pause=None; basis='unknown'; flag('elapsed_unknown',rr,'休止時間と有効な経過実時間が未記録。以降の実時間位置は確定できません。')
            start=elapsed; end_on=None if start is None else start+duration
            elapsed=None if end_on is None or used_pause is None else end_on+used_pause
            heat+=duration
            vraw=tx(rr,vc) if vc else ''
            volume_source=f'{colname(vc)}{rr}' if vc else None
            if not vc:
                vm=re.search(r'(?:体積|容積)\s*(\d{3}(?:/\d{3})?[+\-=]?)',norm(note))
                if vm:vraw=vm[1];volume_source=f'{colname(nc)}{rr} (Note)'
            vol,vkind=volume(vraw)
            if vkind=='unparsed':flag('volume_unparsed',rr,'換算を確定できない体積表記: '+vraw)
            cached_energy=number(val(rr,pc+1)); ef=cell(rr,pc+1).get('formula') or ''
            if energy is not None and cached_energy is not None and 'SUM(' not in ef.upper() and cached_energy<100000 and abs(energy*1000-cached_energy)>.01:
                flag('energy_cache_conflict',rr,f'出力×秒={energy:g}kJ / キャッシュ={cached_energy/1000:g}kJ。前者を使用。')
            steps.append(dict(roast_id=rid,step=len(steps)+1,step_id=sid,source_row=rr,duration_s=duration,power_w=power,energy_kj=energy,pause_recorded_s=pause,pause_used_s=used_pause,pause_basis=basis,elapsed_start_s=start,irradiation_end_s=end_on,elapsed_end_s=elapsed,cumulative_irradiation_s=heat,volume_raw=vraw,volume_ml=vol,volume_conversion=vkind,volume_source=volume_source,note_ja=note,recorded_cumulative=tx(rr,3),elapsed_cached_s=cached,elapsed_formula=elapsed_formula,energy_cached_j=cached_energy))
    else:flag('legacy_layout',None,'初期の書式には照射・休止・出力のステップ列が揃っていません。原記録を保存し、確定できない系列は描画しません。')
    if steps:
        last=steps[-1]
        cumulative_cache=seconds(val(last['source_row'],3))
        if cumulative_cache is not None and abs(cumulative_cache-heat)>.5:
            flag('cumulative_time_difference',last['source_row'],f'元の照射累計欄は {cumulative_cache:g}s、全ステップの照射秒合計は {heat:g}s。作図は全ステップの合計を使用。')
        totals=[c for c in cells if c['col']==pc+1 and 'SUM(' in (c['formula'] or '').upper() and '/' not in (c['formula'] or '') and (number(c['value']) or 0)>100000 and '1ハゼ' not in norm(tx(c['row'],pc))]
        if totals and all(s['energy_kj'] is not None for s in steps):
            c=min(totals,key=lambda c:c['row']);calc=sum(s['energy_kj'] for s in steps)
            if abs(c['value']/1000-calc)>.01:flag('total_energy_difference',c['row'],f'元の合計セル {c["address"]} は {c["value"]/1000:g}kJ、全ステップ合計は {calc:g}kJ。作図・概要は全ステップを使用。元の数式は保存。')
    initial_raw=tx(3,vc) if vc else ''; initial,initial_kind=volume(initial_raw)
    if initial_kind=='unparsed':flag('volume_unparsed',3,'初期体積: '+initial_raw)
    if not any(s['volume_ml'] is not None for s in steps):flag('volume_missing',None,'換算できるステップ別の体積記録がありません。')
    base={(c['row'],c['col']):c for c in byname.get('base figures',[])}
    orig_title=' '.join(norm(base.get((r,4),{}).get('text')) for r in [6,7,8]).strip()
    if not orig_title:orig_title=' '.join(x for x in [country,origin,suborigin] if x not in ['指定なし','記載なし'])
    notes='\n'.join(c['address']+': '+c['text'] for c in byname.get('consideration',[]) if c['text'])
    p=dict(roast_id=rid,archive_entry=path,filename=Path(path).name,lot=lot,roast_date=d,date_basis=date_basis,month=d[:7] if d else '日付不明',day=d[8:] if d else '日付不明',country=country,origin=origin,suborigin=suborigin,profile_label=f'{d or "日付不明"} · {origin}'+(' / '+suborigin if suborigin!='指定なし' else '')+' · '+lot,coffee_title=orig_title,step_count=len(steps),sheet_count=len(sheets),schema='pulse_log' if standard else 'legacy',initial_volume_raw=initial_raw,initial_volume_ml=initial,heating_seconds=heat if steps else None,elapsed_seconds=elapsed if steps else None,energy_kj=sum(s['energy_kj'] for s in steps) if steps and all(s['energy_kj'] is not None for s in steps) else None,volume_points=sum(s['volume_ml'] is not None for s in steps),missing_pause_count=sum(s['pause_basis']=='unknown' for s in steps),recovered_pause_count=sum(s['pause_recorded_s'] is None and s['pause_used_s'] is not None for s in steps),issue_count=len(flags),notes_ja=notes)
    if standard and number(val(3,4)):
        flag('initial_row_duration',3,'ID 0（初期状態）の照射欄にも秒数があります。参照形式どおり ID 1以降をステップとして描画。')
        p['issue_count']=len(flags)
    return p,steps,flags
